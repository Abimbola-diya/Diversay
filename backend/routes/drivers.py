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
    from sqlalchemy.exc import IntegrityError
    existing = db.query(Driver).filter(Driver.name.ilike(clean_name)).first()
    if existing:
        return existing
    try:
        new_driver = Driver(name=clean_name)
        db.add(new_driver)
        db.commit()
        db.refresh(new_driver)
        return new_driver
    except IntegrityError:
        db.rollback()
        existing = db.query(Driver).filter(Driver.name.ilike(clean_name)).first()
        if existing:
            return existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver with this name already exists"
        )

@router.put("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: int,
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Update driver's name."""
    clean_name = driver_in.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver name cannot be empty"
        )
    
    # Check if there is another driver with the same name
    existing = db.query(Driver).filter(
        Driver.name.ilike(clean_name),
        Driver.id != driver_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver with this name already exists"
        )
        
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
        
    driver.name = clean_name
    db.commit()
    db.refresh(driver)
    return driver

@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Delete a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    db.delete(driver)
    db.commit()
    return None
