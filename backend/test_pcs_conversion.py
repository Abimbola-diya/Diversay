import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Delete existing test DB before engine creation if any
if os.path.exists("./test_conversion.db"):
    try:
        os.remove("./test_conversion.db")
    except Exception:
        pass

from database import Base, get_db
from main import app
from models import User, UserRole, Store, Product, StoreInventory, Customer, UnitType, ProductCategory
from auth import create_access_token, hash_password
from routes.orders import get_conversion_factor

# Test database settings
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_conversion.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True, scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Create a test admin user if not exists
    existing_user = db.query(User).filter(User.email == "test_op@example.com").first()
    if not existing_user:
        test_user = User(
            email="test_op@example.com",
            full_name="Test Operator",
            password_hash=hash_password("testpassword123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(test_user)
        db.commit()
    
    # 2. Create products
    p1 = Product(name="Normal Product 100g", category=ProductCategory.POULTRY, unit_price=10.0, default_unit=UnitType.PIECES)
    p2 = Product(name="Special Product 50g Extra", category=ProductCategory.POULTRY, unit_price=15.0, default_unit=UnitType.PIECES)
    p3 = Product(name="Special Product 50gram Super", category=ProductCategory.EQUINE, unit_price=20.0, default_unit=UnitType.PIECES)
    db.add_all([p1, p2, p3])
    db.commit()
    
    # 3. Create stores
    s_src = Store(name="Source Store", city="Lagos", state="Lagos", is_central=False)
    s_dest = Store(name="Dest Store", city="Abuja", state="FCT", is_central=False)
    db.add_all([s_src, s_dest])
    db.commit()
    
    # 4. Initialize store inventory (stock starts at 1000 pieces each)
    inv1 = StoreInventory(store_id=s_src.id, product_id=p1.id, stock=1000.0)
    inv2 = StoreInventory(store_id=s_src.id, product_id=p2.id, stock=1000.0)
    inv3 = StoreInventory(store_id=s_src.id, product_id=p3.id, stock=1000.0)
    db.add_all([inv1, inv2, inv3])
    db.commit()
    
    # 5. Create a customer
    cust = Customer(name="John Doe", contact_number="08012345678", email="john@example.com")
    db.add(cust)
    db.commit()
    
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_conversion.db"):
        try:
            os.remove("./test_conversion.db")
        except Exception:
            pass

def get_auth_headers():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "test_op@example.com").first()
    token = create_access_token({"sub": user.id})
    db.close()
    return {"Authorization": f"Bearer {token}"}

def test_conversion_factors():
    # Test helper directly
    assert get_conversion_factor("Normal Product 100g") == 96.0
    assert get_conversion_factor("Special Product 50g Extra") == 192.0
    assert get_conversion_factor("Special Product 50gram Super") == 192.0
    assert get_conversion_factor("Another 50 gm Product") == 192.0
    assert get_conversion_factor("Some 50 gr Item") == 192.0

def test_order_creation_pcs_vs_cartons():
    headers = get_auth_headers()
    db = TestingSessionLocal()
    
    p1 = db.query(Product).filter(Product.name == "Normal Product 100g").first()
    p2 = db.query(Product).filter(Product.name == "Special Product 50g Extra").first()
    p3 = db.query(Product).filter(Product.name == "Special Product 50gram Super").first()
    s_src = db.query(Store).filter(Store.name == "Source Store").first()
    s_dest = db.query(Store).filter(Store.name == "Dest Store").first()
    cust = db.query(Customer).first()
    db.close()
    
    order_data = {
        "customer_id": cust.id,
        "source_store_id": s_src.id,
        "destination_store_id": s_dest.id,
        "payment_status": "Paid",
        "dispatch_time": "2026-07-15T12:00:00",
        "expected_delivery_time": "2026-07-16T12:00:00",
        "waybills": [],
        "line_items": [
            {
                "product_id": p1.id,
                "quantity": 2.0,
                "unit": "Carton" # should deduct 2 * 96 = 192 pieces
            },
            {
                "product_id": p2.id,
                "quantity": 3.0,
                "unit": "Pieces" # should deduct 3 pieces
            },
            {
                "product_id": p3.id,
                "quantity": 1.0,
                "unit": "Carton" # should deduct 1 * 192 = 192 pieces
            }
        ]
    }
    
    response = client.post("/orders", headers=headers, json=order_data)
    assert response.status_code == 201, response.text
    
    # Check inventory stock deduction
    db = TestingSessionLocal()
    inv_p1 = db.query(StoreInventory).filter(StoreInventory.store_id == s_src.id, StoreInventory.product_id == p1.id).first()
    inv_p2 = db.query(StoreInventory).filter(StoreInventory.store_id == s_src.id, StoreInventory.product_id == p2.id).first()
    inv_p3 = db.query(StoreInventory).filter(StoreInventory.store_id == s_src.id, StoreInventory.product_id == p3.id).first()
    
    # P1 started at 1000 pieces. Deducted 2 Cartons = 2 * 96 = 192 pieces. Remaining should be 808 pieces.
    assert inv_p1.stock == 1000.0 - 192.0
    
    # P2 started at 1000 pieces. Deducted 3 Pieces. Remaining should be 997 pieces.
    assert inv_p2.stock == 1000.0 - 3.0
    
    # P3 started at 1000 pieces. Deducted 1 Carton = 1 * 192 = 192 pieces. Remaining should be 808 pieces.
    assert inv_p3.stock == 1000.0 - 192.0
    db.close()
