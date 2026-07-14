from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import User, Order, OrderLineItem, Customer, OrderStatus, AuditLog, NotificationAcknowledgment, StoreInventory, Product, Store
from schemas import DashboardMetrics, StatusBreakdown, StateMetrics, OrderMetrics, AuditLogResponse, AcknowledgeRequest
from auth import get_current_user, check_admin
from utils import calculate_order_status, calculate_hours_overdue
from datetime import datetime, timedelta
from typing import List

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard metrics."""
    
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=today_start.weekday())
    thirty_days_ago = today_start - timedelta(days=30)
    
    all_orders = db.query(Order).filter(Order.is_deleted == False).options(
        joinedload(Order.customer),
        joinedload(Order.source_store),
        joinedload(Order.destination_store),
        joinedload(Order.line_items).joinedload(OrderLineItem.product)
    ).all()
    
    for order in all_orders:
        order.order_status = calculate_order_status(order)
    
    orders_today = [o for o in all_orders if o.dispatch_time and o.dispatch_time.date() == today_start.date()]
    total_orders_today = len(orders_today)
    
    in_transit = [o for o in all_orders if o.order_status == OrderStatus.IN_TRANSIT]
    in_transit_count = len(in_transit)
    
    delayed = [o for o in all_orders if o.order_status == OrderStatus.DELAYED]
    delayed_count = len(delayed)
    delayed_orders = [
        {
            "order_number": o.order_number,
            "customer_name": o.customer.name,
            "hours_overdue": calculate_hours_overdue(o.expected_delivery_time)
        }
        for o in delayed
    ]
    
    delivered_week = [
        o for o in all_orders
        if o.actual_delivery_time and o.actual_delivery_time >= week_start
    ]
    delivered_this_week = len(delivered_week)
    
    customer_ids = {o.customer_id for o in all_orders}
    total_customers = len(customer_ids)
    
    status_counts = {}
    for order in all_orders:
        status_val = order.order_status.value
        status_counts[status_val] = status_counts.get(status_val, 0) + 1
    
    status_breakdown = [
        StatusBreakdown(status=status_val, count=count)
        for status_val, count in status_counts.items()
    ]
    
    on_time = len([o for o in all_orders if o.order_status == OrderStatus.DELIVERED_ON_TIME])
    late = len([o for o in all_orders if o.order_status == OrderStatus.DELIVERED_LATE])
    delayed_manifests = len([o for o in all_orders if o.order_status == OrderStatus.DELAYED])
    
    total_evaluated = on_time + late + delayed_manifests
    
    on_time_percentage = (on_time / total_evaluated * 100) if total_evaluated > 0 else 0
    late_percentage = ((late + delayed_manifests) / total_evaluated * 100) if total_evaluated > 0 else 0
    
    state_counts = {}
    for order in all_orders:
        state = order.customer.state or "Unknown"
        state_counts[state] = state_counts.get(state, 0) + 1
    
    top_5_states = [
        StateMetrics(state=state, count=count)
        for state, count in sorted(state_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    orders_30_days = {}
    for order in all_orders:
        if order.dispatch_time and order.dispatch_time >= thirty_days_ago:
            date_key = order.dispatch_time.date().isoformat()
            orders_30_days[date_key] = orders_30_days.get(date_key, 0) + 1
    
    orders_last_30_days = [
        OrderMetrics(date=date, count=count)
        for date, count in sorted(orders_30_days.items())
    ]
    
    # Calculate 30 day volume and growth vs previous 30 days
    sixty_days_ago = today_start - timedelta(days=60)
    orders_current_30 = [o for o in all_orders if o.dispatch_time and o.dispatch_time >= thirty_days_ago]
    total_orders_30_days = len(orders_current_30)
    
    orders_prev_30 = [o for o in all_orders if o.dispatch_time and sixty_days_ago <= o.dispatch_time < thirty_days_ago]
    total_orders_prev_30_days = len(orders_prev_30)
    
    if total_orders_prev_30_days > 0:
        orders_growth_percentage = ((total_orders_30_days - total_orders_prev_30_days) / total_orders_prev_30_days) * 100
    elif total_orders_30_days > 0:
        orders_growth_percentage = 100.0
    else:
        orders_growth_percentage = 0.0
    
    return {
        "total_orders_today": total_orders_today,
        "in_transit_count": in_transit_count,
        "delayed_count": delayed_count,
        "delayed_orders": delayed_orders,
        "delivered_this_week": delivered_this_week,
        "total_customers": total_customers,
        "status_breakdown": status_breakdown,
        "on_time_percentage": round(on_time_percentage, 2),
        "late_percentage": round(late_percentage, 2),
        "top_5_states": top_5_states,
        "orders_last_30_days": orders_last_30_days,
        "total_orders_30_days": total_orders_30_days,
        "orders_growth_percentage": round(orders_growth_percentage, 2)
    }


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system-wide recent audit logs."""
    logs = db.query(AuditLog).options(
        joinedload(AuditLog.user)
    ).order_by(AuditLog.timestamp.desc()).limit(100).all()
    
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


@router.get("/acknowledged", response_model=List[str])
def get_acknowledged_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of acknowledged notification/activity IDs for current user."""
    acks = db.query(NotificationAcknowledgment).filter(
        NotificationAcknowledgment.user_id == current_user.id
    ).all()
    return [ack.notification_id for ack in acks]


@router.post("/acknowledge")
def acknowledge_notification(
    req: AcknowledgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Acknowledge a notification/activity by ID."""
    existing = db.query(NotificationAcknowledgment).filter(
        NotificationAcknowledgment.user_id == current_user.id,
        NotificationAcknowledgment.notification_id == req.notification_id
    ).first()
    
    if not existing:
        ack = NotificationAcknowledgment(
            user_id=current_user.id,
            notification_id=req.notification_id
        )
        db.add(ack)
        db.commit()
    
    return {"status": "success"}


@router.get("/low-stock")
def get_low_stock_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all store inventory items that are below their reorder level."""
    low_stock = db.query(StoreInventory).join(Product).join(Store).filter(
        StoreInventory.stock < StoreInventory.reorder_level,
        Product.is_deleted == False,
        Store.is_deleted == False
    ).all()
    
    return [
        {
            "id": f"lowstock-{item.store_id}-{item.product_id}",
            "store_id": item.store_id,
            "store_name": item.store.name,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "stock": item.stock,
            "reorder_level": item.reorder_level,
            "unit": item.product.default_unit.value,
            "updated_at": item.store.updated_at.isoformat() if item.store.updated_at else datetime.utcnow().isoformat()
        }
        for item in low_stock
    ]

