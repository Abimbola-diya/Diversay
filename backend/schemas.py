from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from models import OrderStatus, UserRole, ProductCategory, UnitType, ActionType

# ============ User Schemas ============
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    requesting_admin: bool = False
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class SignupResponse(BaseModel):
    message: str
    user: UserResponse

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)

class UpdateUserNameRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)

# ============ Customer Schemas ============
class CustomerCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None

class CustomerResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    contact_number: Optional[str]
    email: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class CustomerSearchResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    contact_number: Optional[str]
    email: Optional[str]

# ============ Product Schemas ============
class ProductCreate(BaseModel):
    name: str
    category: ProductCategory = ProductCategory.OTHER
    default_unit: UnitType = UnitType.CARTON
    unit_price: float = 0.0

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ProductCategory] = None
    default_unit: Optional[UnitType] = None
    unit_price: Optional[float] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    category: ProductCategory
    default_unit: UnitType
    unit_price: float
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Order Line Item Schemas ============
class OrderLineItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit: UnitType

class OrderLineItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: float
    unit: UnitType
    unit_price: float
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Order Schemas ============
class OrderCreate(BaseModel):
    customer_id: int
    waybill_number: Optional[str] = None
    invoice_number: Optional[str] = None
    dispatch_time: datetime
    expected_delivery_time: datetime
    notes: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    line_items: List[OrderLineItemCreate]

class OrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    waybill_number: Optional[str] = None
    invoice_number: Optional[str] = None
    dispatch_time: Optional[datetime] = None
    expected_delivery_time: Optional[datetime] = None
    actual_delivery_time: Optional[datetime] = None
    notes: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    line_items: Optional[List[OrderLineItemCreate]] = None

class OrderStatusUpdate(BaseModel):
    order_status: OrderStatus

class MarkDeliveredRequest(BaseModel):
    actual_delivery_time: datetime

class OrderResponse(BaseModel):
    id: int
    order_number: str
    waybill_number: Optional[str]
    invoice_number: Optional[str]
    customer_id: int
    customer_name: Optional[str] = None
    customer_state: Optional[str] = None
    dispatch_time: Optional[datetime]
    expected_delivery_time: Optional[datetime]
    actual_delivery_time: Optional[datetime]
    delivery_duration: Optional[int]
    order_status: OrderStatus
    notes: Optional[str]
    driver_name: Optional[str]
    vehicle_number: Optional[str]
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    total_amount: float = 0.0
    line_items: List[OrderLineItemResponse] = []
    
    class Config:
        from_attributes = True

class OrderDetailResponse(OrderResponse):
    customer: Optional[CustomerResponse] = None
    created_by_user: Optional[UserResponse] = None

# ============ Audit Log Schemas ============
class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    action: ActionType
    table_name: str
    record_id: int
    details: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True

# ============ Analytics Schemas ============
class StatusBreakdown(BaseModel):
    status: str
    count: int

class OrderMetrics(BaseModel):
    date: str
    count: int

class StateMetrics(BaseModel):
    state: str
    count: int

class DashboardMetrics(BaseModel):
    total_orders_today: int
    in_transit_count: int
    delayed_count: int
    delayed_orders: List[dict]
    delivered_this_week: int
    total_customers: int
    status_breakdown: List[StatusBreakdown]
    on_time_percentage: float
    late_percentage: float
    top_5_states: List[StateMetrics]
    orders_last_30_days: List[OrderMetrics]
