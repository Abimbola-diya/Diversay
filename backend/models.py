from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Enum, Text, Table
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class OrderStatus(str, enum.Enum):
    DRAFT = "Draft"
    IN_TRANSIT = "In Transit"
    DELAYED = "Delayed"
    DELIVERED_ON_TIME = "Delivered (On Time)"
    DELIVERED_LATE = "Delivered (Late)"

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    VIEWER = "viewer"

class ProductCategory(str, enum.Enum):
    POULTRY = "Poultry"
    EQUINE = "Equine"
    OTHER = "Other"

class UnitType(str, enum.Enum):
    CARTON = "Carton"
    KEG = "Keg"
    BAG = "Bag"
    SACHET = "Sachet"

class ActionType(str, enum.Enum):
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"
    STATUS_CHANGE = "status_change"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    created_orders = relationship("Order", back_populates="created_by_user", foreign_keys="Order.created_by_id")
    audit_logs = relationship("AuditLog", back_populates="user")

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    address = Column(String, nullable=True)
    city = Column(String, index=True, nullable=True)
    state = Column(String, index=True, nullable=True)
    contact_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
    
    orders = relationship("Order", back_populates="customer")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False, unique=True)
    category = Column(Enum(ProductCategory), default=ProductCategory.OTHER)
    default_unit = Column(Enum(UnitType), default=UnitType.CARTON)
    unit_price = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
    
    line_items = relationship("OrderLineItem", back_populates="product")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    waybill_number = Column(String, nullable=True)
    invoice_number = Column(String, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    dispatch_time = Column(DateTime, nullable=True)
    expected_delivery_time = Column(DateTime, nullable=True)
    actual_delivery_time = Column(DateTime, nullable=True)
    delivery_duration = Column(Integer, nullable=True)
    order_status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)
    driver_name = Column(String, nullable=True)
    vehicle_number = Column(String, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    customer = relationship("Customer", back_populates="orders")
    created_by_user = relationship("User", back_populates="created_orders", foreign_keys=[created_by_id])
    line_items = relationship("OrderLineItem", back_populates="order", cascade="all, delete-orphan")

class OrderLineItem(Base):
    __tablename__ = "order_line_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(Enum(UnitType), default=UnitType.CARTON)
    unit_price = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="line_items")
    product = relationship("Product", back_populates="line_items")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(ActionType), nullable=False)
    table_name = Column(String, nullable=False)
    record_id = Column(Integer, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="audit_logs")
