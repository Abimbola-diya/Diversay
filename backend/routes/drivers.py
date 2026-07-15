from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Driver
from auth import get_current_user, check_write_access
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/drivers", tags=["drivers"])

class DriverCreate(BaseModel):
    name: str

class DriverResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

@router.get("/", response_model=List[DriverResponse])
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all drivers."""
    return db.query(Driver).order_by(Driver.name.asc()).all()

@router.post("/", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
def create_driver(
    driver: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Create a new driver (requires write access)."""
    clean_name = driver.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver name cannot be empty"
        )
    existing = db.query(Driver).filter(Driver.name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver with this name already exists"
        )
    new_driver = Driver(name=clean_name)
    db.add(new_driver)
    db.commit()
    db.refresh(new_driver)
    return new_driver
