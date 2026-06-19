from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import User, Order, OrderLineItem, Customer, OrderStatus
from schemas import DashboardMetrics, StatusBreakdown, StateMetrics, OrderMetrics
from auth import get_current_user, check_admin
from utils import calculate_order_status, calculate_hours_overdue
from datetime import datetime, timedelta
from typing import List

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Get dashboard metrics (admin only)."""
    
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=today_start.weekday())
    thirty_days_ago = today_start - timedelta(days=30)
    
    all_orders = db.query(Order).filter(Order.is_deleted == False).options(
        joinedload(Order.customer),
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
    total_delivered = on_time + late
    
    on_time_percentage = (on_time / total_delivered * 100) if total_delivered > 0 else 0
    late_percentage = (late / total_delivered * 100) if total_delivered > 0 else 0
    
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
        "orders_last_30_days": orders_last_30_days
    }
