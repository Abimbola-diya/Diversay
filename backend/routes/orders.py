from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from database import get_db
from models import User, Order, OrderLineItem, Product, Customer, AuditLog, OrderStatus, ActionType
from schemas import OrderCreate, OrderUpdate, OrderStatusUpdate, OrderResponse, OrderDetailResponse, AuditLogResponse, MarkDeliveredRequest
from auth import get_current_user, check_admin
from utils import calculate_order_status, calculate_delivery_duration, generate_order_number, get_order_with_details, calculate_hours_overdue
from datetime import datetime, timedelta
from typing import List, Optional
import json

router = APIRouter(prefix="/orders", tags=["orders"])

def create_audit_log(db: Session, user_id: int, action: ActionType, table_name: str, record_id: int, details: Optional[dict] = None):
    """Helper to create audit log entry."""
    audit = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        details=json.dumps(details) if details else None
    )
    db.add(audit)

def update_order_status(order: Order):
    """Update order status based on current state."""
    order.order_status = calculate_order_status(order)
    if order.actual_delivery_time and order.dispatch_time:
        order.delivery_duration = calculate_delivery_duration(order)

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_create: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Create a new order (admin only)."""
    customer = db.query(Customer).filter(
        Customer.id == order_create.customer_id,
        Customer.is_deleted == False
    ).first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    product_ids = [item.product_id for item in order_create.line_items]
    products = db.query(Product).filter(
        Product.id.in_(product_ids),
        Product.is_deleted == False
    ).all()
    
    if len(products) != len(product_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more products not found"
        )
    
    # Create a map of product ID to product for quick lookup
    products_map = {p.id: p for p in products}
    
    order_number = generate_order_number(db)
    
    new_order = Order(
        order_number=order_number,
        waybill_number=order_create.waybill_number,
        invoice_number=order_create.invoice_number,
        customer_id=order_create.customer_id,
        dispatch_time=order_create.dispatch_time,
        expected_delivery_time=order_create.expected_delivery_time,
        notes=order_create.notes,
        driver_name=order_create.driver_name,
        vehicle_number=order_create.vehicle_number,
        created_by_id=current_user.id
    )
    
    update_order_status(new_order)
    
    db.add(new_order)
    db.flush()
    
    for item in order_create.line_items:
        product = products_map.get(item.product_id)
        line_item = OrderLineItem(
            order_id=new_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit=item.unit,
            unit_price=product.unit_price if product else 0.0
        )
        db.add(line_item)
    
    create_audit_log(
        db, current_user.id, ActionType.CREATE, "orders", new_order.id,
        {"action": "Order created", "order_number": order_number}
    )
    
    db.commit()
    db.refresh(new_order)
    
    return get_order_with_details(new_order)

@router.get("/", response_model=dict)
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    product_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    order_number: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
    product_name: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List orders with advanced filtering."""
    query = db.query(Order).filter(Order.is_deleted == False).options(
        joinedload(Order.customer),
        joinedload(Order.created_by_user),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    )
    
    if state:
        query = query.join(Customer).filter(Customer.state == state)
    
    if city:
        query = query.join(Customer).filter(Customer.city == city)
    
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    
    if customer_name:
        query = query.join(Customer).filter(Customer.name.ilike(f"%{customer_name}%"))
    
    if product_name:
        query = query.join(OrderLineItem).join(Product).filter(
            Product.name.ilike(f"%{product_name}%")
        )
    
    if product_id:
        query = query.join(OrderLineItem).filter(OrderLineItem.product_id == product_id)
    
    if order_number:
        search_val = order_number.strip()
        customer_exists = db.query(Customer.id).filter(
            Customer.name.ilike(f"%{search_val}%"),
            Customer.is_deleted == False
        ).subquery()
        product_exists = db.query(OrderLineItem.order_id).join(Product).filter(
            Product.name.ilike(f"%{search_val}%"),
            Product.is_deleted == False
        ).subquery()
        query = query.filter(
            or_(
                Order.order_number.ilike(f"%{search_val}%"),
                Order.waybill_number.ilike(f"%{search_val}%"),
                Order.invoice_number.ilike(f"%{search_val}%"),
                Order.driver_name.ilike(f"%{search_val}%"),
                Order.customer_id.in_(customer_exists),
                Order.id.in_(product_exists)
            )
        )
    
    if status:
        query = query.filter(Order.order_status == status)
    
    if start_date:
        query = query.filter(Order.dispatch_time >= start_date)
    
    if end_date:
        query = query.filter(Order.dispatch_time <= end_date)
    
    total = query.count()
    
    orders = query.offset(skip).limit(limit).all()
    
    for order in orders:
        update_order_status(order)
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [get_order_with_details(order) for order in orders]
    }

@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get order details with audit log."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.is_deleted == False
    ).options(
        joinedload(Order.customer),
        joinedload(Order.created_by_user),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    update_order_status(order)
    
    return get_order_with_details(order)

@router.get("/{order_id}/audit-log", response_model=List[AuditLogResponse])
def get_order_audit_log(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit log for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    logs = db.query(AuditLog).filter(
        AuditLog.table_name == "orders",
        AuditLog.record_id == order_id
    ).order_by(AuditLog.timestamp.desc()).all()
    
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.full_name if log.user else None,
            "action": log.action.value,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "details": log.details,
            "timestamp": log.timestamp
        }
        for log in logs
    ]

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_update: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Update order (admin only)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.is_deleted == False
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order_update.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == order_update.customer_id,
            Customer.is_deleted == False
        ).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        order.customer_id = order_update.customer_id
    
    if order_update.waybill_number:
        order.waybill_number = order_update.waybill_number
    if order_update.invoice_number:
        order.invoice_number = order_update.invoice_number
    if order_update.dispatch_time:
        order.dispatch_time = order_update.dispatch_time
    if order_update.expected_delivery_time:
        order.expected_delivery_time = order_update.expected_delivery_time
    if order_update.actual_delivery_time:
        order.actual_delivery_time = order_update.actual_delivery_time
    if order_update.notes:
        order.notes = order_update.notes
    if order_update.driver_name:
        order.driver_name = order_update.driver_name
    if order_update.vehicle_number:
        order.vehicle_number = order_update.vehicle_number
    
    if order_update.line_items is not None:
        db.query(OrderLineItem).filter(OrderLineItem.order_id == order_id).delete()
        
        for item in order_update.line_items:
            product = db.query(Product).filter(
                Product.id == item.product_id,
                Product.is_deleted == False
            ).first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {item.product_id} not found"
                )
            
            line_item = OrderLineItem(
                order_id=order_id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit=item.unit
            )
            db.add(line_item)
    
    update_order_status(order)
    
    create_audit_log(
        db, current_user.id, ActionType.EDIT, "orders", order_id,
        {"action": "Order updated"}
    )
    
    db.commit()
    db.refresh(order)
    
    return get_order_with_details(order)

@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status_endpoint(
    order_id: int,
    status_update: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Update order status manually (admin only)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.is_deleted == False
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    old_status = order.order_status
    order.order_status = status_update.order_status
    
    create_audit_log(
        db, current_user.id, ActionType.STATUS_CHANGE, "orders", order_id,
        {"old_status": old_status.value, "new_status": status_update.order_status.value}
    )
    
    db.commit()
    db.refresh(order)
    
    return get_order_with_details(order)

@router.patch("/{order_id}/mark-delivered", response_model=OrderResponse)
def mark_order_delivered(
    order_id: int,
    delivered_request: MarkDeliveredRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Mark order as delivered (admin only)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.is_deleted == False
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    order.actual_delivery_time = delivered_request.actual_delivery_time
    update_order_status(order)
    
    create_audit_log(
        db, current_user.id, ActionType.STATUS_CHANGE, "orders", order_id,
        {"action": "Marked as delivered", "status": order.order_status.value}
    )
    
    db.commit()
    db.refresh(order)
    
    return get_order_with_details(order)

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Soft delete order (admin only)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.is_deleted == False
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    order.is_deleted = True
    
    create_audit_log(
        db, current_user.id, ActionType.DELETE, "orders", order_id,
        {"action": "Order deleted"}
    )
    
    db.commit()
    
    return None

@router.get("/groupby/{field}", response_model=dict)
def group_orders_by_field(
    field: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Group orders by state, customer, product, or status."""
    valid_fields = ["state", "customer", "product", "status"]
    
    if field not in valid_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field. Must be one of: {', '.join(valid_fields)}"
        )
    
    query = db.query(Order).filter(Order.is_deleted == False).options(
        joinedload(Order.customer),
        joinedload(Order.created_by_user),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    ).all()
    
    for order in query:
        update_order_status(order)
    
    grouped = {}
    
    if field == "state":
        for order in query:
            state = order.customer.state or "Unknown"
            if state not in grouped:
                grouped[state] = []
            grouped[state].append(get_order_with_details(order))
    
    elif field == "customer":
        for order in query:
            customer_name = order.customer.name
            if customer_name not in grouped:
                grouped[customer_name] = []
            grouped[customer_name].append(get_order_with_details(order))
    
    elif field == "product":
        for order in query:
            for line_item in order.line_items:
                product_name = line_item.product.name
                if product_name not in grouped:
                    grouped[product_name] = []
                if get_order_with_details(order) not in grouped[product_name]:
                    grouped[product_name].append(get_order_with_details(order))
    
    elif field == "status":
        for order in query:
            status_val = order.order_status.value
            if status_val not in grouped:
                grouped[status_val] = []
            grouped[status_val].append(get_order_with_details(order))
    
    return {
        "field": field,
        "grouped_data": grouped
    }
