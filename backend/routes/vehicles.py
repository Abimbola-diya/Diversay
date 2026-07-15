from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, Vehicle
from auth import get_current_user, check_write_access
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

class VehicleCreate(BaseModel):
    plate_number: str

class VehicleResponse(BaseModel):
    id: int
    plate_number: str

    class Config:
        from_attributes = True

def format_plate_number(val: str) -> str:
    # Remove all spaces and capitalize
    clean = "".join(val.split()).upper()
    # Chunk by every 3 characters
    chunks = [clean[i:i+3] for i in range(0, len(clean), 3)]
    return " ".join(chunks)

@router.get("/", response_model=List[VehicleResponse])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all vehicles."""
    return db.query(Vehicle).order_by(Vehicle.plate_number.asc()).all()

@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_driver(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Create a new vehicle (requires write access)."""
    formatted = format_plate_number(vehicle.plate_number)
    if not formatted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle license number cannot be empty"
        )
    existing = db.query(Vehicle).filter(Vehicle.plate_number == formatted).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle with this plate number already exists"
        )
    new_vehicle = Vehicle(plate_number=formatted)
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle
