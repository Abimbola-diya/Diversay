from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth, customers, products, orders, analytics
from config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

# Create tables (with error handling in case DB is unavailable)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning(f"Could not create tables on startup: {e}. Database may be unavailable.")

# Create FastAPI app
app = FastAPI(
    title="Diversay Logistics Portal API",
    description="Backend API for Diversay Solutions logistics management",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
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

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
