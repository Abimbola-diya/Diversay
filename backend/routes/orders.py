from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from database import get_db
from models import User, Order, OrderLineItem, Product, Customer, AuditLog, OrderStatus, ActionType, Store, StoreInventory, UnitType
from schemas import OrderCreate, OrderUpdate, OrderStatusUpdate, OrderResponse, OrderDetailResponse, AuditLogResponse, MarkDeliveredRequest
from auth import get_current_user, check_admin, check_write_access
from utils import calculate_order_status, calculate_delivery_duration, generate_order_number, get_order_with_details, calculate_hours_overdue
from datetime import datetime, timedelta
from typing import List, Optional
import json

router = APIRouter(prefix="/orders", tags=["orders"])

def get_conversion_factor(product_name: str) -> float:
    name_lower = (product_name or "").lower()
    if any(x in name_lower for x in ["50g", "50 g", "50gram", "50 gram", "50gr", "50 gr", "50gm", "50 gm"]):
        return 192.0
    return 96.0

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

def get_order_snapshot(order: Order):
    """Generate a dictionary snapshot of the current state of an order."""
    line_items_snapshot = []
    for item in order.line_items:
        prod_name = item.product.name if item.product else "Unknown Product"
        prod_brand = item.product.brand if item.product else None
        line_items_snapshot.append({
            "product_id": item.product_id,
            "product_name": prod_name,
            "product_brand": prod_brand,
            "quantity": item.quantity,
            "unit": item.unit.value if hasattr(item.unit, 'value') else str(item.unit),
            "unit_price": item.unit_price
        })
        
    return {
        "waybill_number": order.waybill_number,
        "invoice_number": order.invoice_number,
        "customer_id": order.customer_id,
        "customer_name": order.customer.name if order.customer else "Unknown Customer",
        "customer_address": order.customer.address if order.customer else None,
        "customer_state": order.customer.state if order.customer else None,
        "dispatch_time": order.dispatch_time.isoformat() if order.dispatch_time else None,
        "expected_delivery_time": order.expected_delivery_time.isoformat() if order.expected_delivery_time else None,
        "actual_delivery_time": order.actual_delivery_time.isoformat() if order.actual_delivery_time else None,
        "driver_name": order.driver_name,
        "vehicle_number": order.vehicle_number,
        "fuel_cost": order.fuel_cost,
        "waybill_cost": order.waybill_cost,
        "other_costs": order.other_costs,
        "notes": order.notes,
        "line_items": line_items_snapshot
    }

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_create: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
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
        
    if order_create.source_store_id:
        source_store = db.query(Store).filter(
            Store.id == order_create.source_store_id,
            Store.is_deleted == False
        ).first()
        if not source_store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source store not found"
            )
            
    if order_create.destination_store_id:
        destination_store = db.query(Store).filter(
            Store.id == order_create.destination_store_id,
            Store.is_deleted == False
        ).first()
        if not destination_store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Destination store not found"
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
    
    if order_create.waybill_number:
        existing_waybill = db.query(Order).filter(
            Order.waybill_number == order_create.waybill_number,
            Order.is_deleted == False
        ).first()
        if existing_waybill:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Delivery No '{order_create.waybill_number}' is already in use by order {existing_waybill.order_number}."
            )
            
    if order_create.invoice_number:
        existing_invoice = db.query(Order).filter(
            Order.invoice_number == order_create.invoice_number,
            Order.is_deleted == False
        ).first()
        if existing_invoice:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice No '{order_create.invoice_number}' is already in use by order {existing_invoice.order_number}."
            )

    order_number = generate_order_number(db)
    
    new_order = Order(
        order_number=order_number,
        waybill_number=order_create.waybill_number,
        invoice_number=order_create.invoice_number,
        customer_id=order_create.customer_id,
        source_store_id=order_create.source_store_id,
        destination_store_id=order_create.destination_store_id,
        dispatch_time=order_create.dispatch_time,
        expected_delivery_time=order_create.expected_delivery_time,
        notes=order_create.notes,
        driver_name=order_create.driver_name,
        vehicle_number=order_create.vehicle_number,
        fuel_cost=order_create.fuel_cost or 0.0,
        waybill_cost=order_create.waybill_cost or 0.0,
        other_costs=order_create.other_costs or [],
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
        
        # Debiting stock from source store
        if order_create.source_store_id:
            src_inv = db.query(StoreInventory).filter(
                StoreInventory.store_id == order_create.source_store_id,
                StoreInventory.product_id == item.product_id
            ).first()
            if not src_inv:
                src_inv = StoreInventory(
                    store_id=order_create.source_store_id,
                    product_id=item.product_id,
                    stock=0.0
                )
                db.add(src_inv)
            
            factor = get_conversion_factor(product.name) if (product and item.unit == UnitType.CARTON) else 1.0
            src_inv.stock -= item.quantity * factor
            
        # Crediting/debiting stock to destination store
        if order_create.destination_store_id:
            dest_inv = db.query(StoreInventory).filter(
                StoreInventory.store_id == order_create.destination_store_id,
                StoreInventory.product_id == item.product_id
            ).first()
            if not dest_inv:
                dest_inv = StoreInventory(
                    store_id=order_create.destination_store_id,
                    product_id=item.product_id,
                    stock=0.0
                )
                db.add(dest_inv)
            
            factor = get_conversion_factor(product.name) if (product and item.unit == UnitType.CARTON) else 1.0
            # Credit the destination (regional) store
            dest_inv.stock += item.quantity * factor
            
            # If source store is central, then this is a 3-node supply: Central -> Regional -> Customer.
            # In a 3-node supply, the regional store receives it (+quantity) and then ships it to customer (-quantity).
            source_store = db.query(Store).filter(Store.id == order_create.source_store_id).first()
            if source_store and source_store.is_central:
                dest_inv.stock -= item.quantity * factor
    
    db.flush()
    
    import uuid
    commit_hash = uuid.uuid4().hex[:7]
    commit_msg = order_create.commit_message or f"Initial creation of order {order_number}"
    snapshot = get_order_snapshot(new_order)
    
    create_audit_log(
        db, current_user.id, ActionType.CREATE, "orders", new_order.id,
        {
            "action": commit_msg,
            "commit_hash": commit_hash,
            "state_snapshot": snapshot
        }
    )
    
    db.commit()
    
    db_order = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.source_store),
        joinedload(Order.destination_store),
        joinedload(Order.created_by_user),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    ).filter(Order.id == new_order.id).first()
    
    return get_order_with_details(db_order)

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
    query = db.query(Order).filter(Order.is_deleted == False)
    
    # 1. State / City / Customer Name filtering via customer ID pre-fetching
    if state or city or customer_name:
        customer_query = db.query(Customer.id).filter(Customer.is_deleted == False)
        if state:
            customer_query = customer_query.filter(Customer.state.ilike(f"%{state.strip()}%"))
        if city:
            customer_query = customer_query.filter(Customer.city.ilike(f"%{city.strip()}%"))
        if customer_name:
            customer_query = customer_query.filter(Customer.name.ilike(f"%{customer_name.strip()}%"))
        
        customer_ids = [r[0] for r in customer_query.all()]
        query = query.filter(Order.customer_id.in_(customer_ids))

    if customer_id:
        query = query.filter(Order.customer_id == customer_id)

    # 2. Product ID / Product Name filtering via order ID pre-fetching
    if product_id or product_name:
        product_query = db.query(OrderLineItem.order_id)
        if product_id:
            product_query = product_query.filter(OrderLineItem.product_id == product_id)
        if product_name:
            product_query = product_query.join(Product).filter(Product.name.ilike(f"%{product_name.strip()}%"))
        
        product_order_ids = [r[0] for r in product_query.all()]
        query = query.filter(Order.id.in_(product_order_ids))
    
    # 3. Text search (order_number/waybill/invoice/driver/customer_name/product_name) via pre-fetching
    if order_number:
        search_val = order_number.strip()
        
        # Fetch matching customer IDs
        search_customer_ids = [r[0] for r in db.query(Customer.id).filter(
            or_(
                Customer.name.ilike(f"%{search_val}%"),
                Customer.state.ilike(f"%{search_val}%"),
                Customer.city.ilike(f"%{search_val}%")
            ),
            Customer.is_deleted == False
        ).all()]
        
        # Fetch matching order IDs from product names
        order_ids_from_products = [r[0] for r in db.query(OrderLineItem.order_id).join(Product).filter(
            Product.name.ilike(f"%{search_val}%"),
            Product.is_deleted == False
        ).all()]
        
        filters = [
            Order.order_number.ilike(f"%{search_val}%"),
            Order.waybill_number.ilike(f"%{search_val}%"),
            Order.invoice_number.ilike(f"%{search_val}%"),
            Order.driver_name.ilike(f"%{search_val}%")
        ]
        if search_customer_ids:
            filters.append(Order.customer_id.in_(search_customer_ids))
        if order_ids_from_products:
            filters.append(Order.id.in_(order_ids_from_products))
            
        query = query.filter(or_(*filters))
    
    if status:
        query = query.filter(Order.order_status == status)
    
    if start_date:
        query = query.filter(Order.dispatch_time >= start_date)
    
    if end_date:
        query = query.filter(Order.dispatch_time <= end_date)
    
    # Use a lightweight count query (no joins at all, so simple and fast)
    from sqlalchemy import func as sqla_func
    count_query = query.with_entities(sqla_func.count(Order.id))
    total = count_query.scalar()
    
    # Eager load relationships on the paginated result query to optimize performance
    query_fetch = query.options(
        joinedload(Order.customer),
        joinedload(Order.created_by_user),
        joinedload(Order.source_store),
        joinedload(Order.destination_store),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    )
    
    orders = query_fetch.order_by(Order.id.desc()).offset(skip).limit(limit).all()
    
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
    ).options(
        joinedload(AuditLog.user)
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
    current_user: User = Depends(check_write_access)
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
        existing_waybill = db.query(Order).filter(
            Order.waybill_number == order_update.waybill_number,
            Order.id != order_id,
            Order.is_deleted == False
        ).first()
        if existing_waybill:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Delivery No '{order_update.waybill_number}' is already in use by order {existing_waybill.order_number}."
            )
        order.waybill_number = order_update.waybill_number

    if order_update.invoice_number:
        existing_invoice = db.query(Order).filter(
            Order.invoice_number == order_update.invoice_number,
            Order.id != order_id,
            Order.is_deleted == False
        ).first()
        if existing_invoice:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice No '{order_update.invoice_number}' is already in use by order {existing_invoice.order_number}."
            )
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
    if order_update.fuel_cost is not None:
        order.fuel_cost = order_update.fuel_cost
    if order_update.waybill_cost is not None:
        order.waybill_cost = order_update.waybill_cost
    if order_update.other_costs is not None:
        order.other_costs = order_update.other_costs
    
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
    
    db.flush()
    
    import uuid
    commit_hash = uuid.uuid4().hex[:7]
    commit_msg = order_update.commit_message or "Updated order details"
    snapshot = get_order_snapshot(order)
    
    create_audit_log(
        db, current_user.id, ActionType.EDIT, "orders", order_id,
        {
            "action": commit_msg,
            "commit_hash": commit_hash,
            "state_snapshot": snapshot
        }
    )
    
    db.commit()
    db.refresh(order)
    
    return get_order_with_details(order)

@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status_endpoint(
    order_id: int,
    status_update: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
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
    current_user: User = Depends(check_write_access)
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
    current_user: User = Depends(check_write_access)
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
