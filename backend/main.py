from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth, customers, products, orders, analytics
from config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

from sqlalchemy import text
from database import SessionLocal
from models import User, UserRole
from auth import hash_password

def seed_admin_user():
    db = SessionLocal()
    try:
        admin_email = "diversaysolutions@gmail.com"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            logger.info("Seeding permanent admin user...")
            new_admin = User(
                email=admin_email,
                full_name="Grace",
                password_hash=hash_password("diversaysolutions@2025"),
                role=UserRole.ADMIN,
                is_active=True,
                requesting_admin=False
            )
            db.add(new_admin)
            db.commit()
            logger.info("Permanent admin user seeded successfully!")
        else:
            # Ensure they are an Admin, Active, and details match requested values
            updated = False
            if admin_user.full_name != "Grace":
                admin_user.full_name = "Grace"
                updated = True
            if admin_user.role != UserRole.ADMIN:
                admin_user.role = UserRole.ADMIN
                updated = True
            if not admin_user.is_active:
                admin_user.is_active = True
                updated = True
            
            # Verify and update password hash if it doesn't match
            from auth import verify_password
            if not verify_password("diversaysolutions@2025", admin_user.password_hash):
                admin_user.password_hash = hash_password("diversaysolutions@2025")
                updated = True
                
            if updated:
                db.commit()
                logger.info("Permanent admin user details updated/restored.")
    except Exception as e:
        logger.error(f"Error seeding admin user: {e}")
    finally:
        db.close()

def seed_products():
    from models import Product, ProductCategory, UnitType
    db = SessionLocal()
    try:
        products_list = [
            "Quinrocin", "Megadox", "Kolin plus", "Stodi", "Phytocee", "Zigbir", 
            "Ds-viracid-s", "Terminator- iii", "Biokleen", "Wyldox", "Neodine", 
            "Amprolium", "coxstop", "Divercipro", "Divercool-c", "DiverGen D", 
            "Divermer", "Ds livorton", "Ds-ultr-tm plus", "Dsl biokleen", 
            "Dsl citramax", "Dsl neodine", "gentylo", "levastar dewormer", 
            "viracid", "zigbir liquid"
        ]
        
        for name in products_list:
            existing = db.query(Product).filter(
                Product.name.ilike(name),
                Product.is_deleted == False
            ).first()
            if not existing:
                logger.info(f"Seeding product: {name}")
                new_product = Product(
                    name=name,
                    category=ProductCategory.OTHER,
                    default_unit=UnitType.CARTON,
                    unit_price=0.0
                )
                db.add(new_product)
        db.commit()
        logger.info("Products seeded successfully!")
    except Exception as e:
        logger.error(f"Error seeding products: {e}")
        db.rollback()
    finally:
        db.close()

# Create tables (with error handling in case DB is unavailable)
try:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS requesting_admin BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("UPDATE users SET is_active = TRUE;"))
        conn.commit()
    seed_admin_user()
    seed_products()
except Exception as e:
    logger.warning(f"Could not create tables or run migrations on startup: {e}. Database may be unavailable.")

# Create FastAPI app
app = FastAPI(
    title="Diversay Logistics Portal API",
    description="Backend API for Diversay Solutions logistics management",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # Automatically allow any Vercel deployment URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(analytics.router)

@app.get("/")
def root():
    return {
        "message": "Diversay Logistics Portal API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
