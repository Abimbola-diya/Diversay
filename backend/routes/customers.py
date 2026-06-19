from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Customer
from schemas import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerSearchResponse
from auth import get_current_user, check_admin
from utils import fuzzy_search_customers, parse_excel_customers
from typing import List

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("/", response_model=dict)
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all non-deleted customers with pagination."""
    query = db.query(Customer).filter(Customer.is_deleted == False)
    total = query.count()
    
    customers = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "address": c.address,
                "city": c.city,
                "state": c.state,
                "contact_number": c.contact_number,
                "email": c.email,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }
            for c in customers
        ]
    }

@router.get("/search", response_model=List[CustomerSearchResponse])
def search_customers(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fuzzy search customers by name."""
    all_customers = db.query(Customer).filter(Customer.is_deleted == False).all()
    
    customers_list = [
        {
            "id": c.id,
            "name": c.name,
            "address": c.address,
            "city": c.city,
            "state": c.state,
            "contact_number": c.contact_number,
            "email": c.email
        }
        for c in all_customers
    ]
    
    results = fuzzy_search_customers(q, customers_list, threshold=0.5)
    
    return results[:20]

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Create a new customer (admin only)."""
    existing = db.query(Customer).filter(
        Customer.name == customer.name,
        Customer.is_deleted == False
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer with this name already exists"
        )
    
    new_customer = Customer(
        name=customer.name,
        address=customer.address,
        city=customer.city,
        state=customer.state,
        contact_number=customer.contact_number,
        email=customer.email,
        created_by_id=current_user.id
    )
    
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    
    return {
        "id": new_customer.id,
        "name": new_customer.name,
        "address": new_customer.address,
        "city": new_customer.city,
        "state": new_customer.state,
        "contact_number": new_customer.contact_number,
        "email": new_customer.email,
        "created_at": new_customer.created_at,
        "updated_at": new_customer.updated_at
    }

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    customer_update: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Update customer (admin only)."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.is_deleted == False
    ).first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    update_data = customer_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)
    
    db.commit()
    db.refresh(customer)
    
    return {
        "id": customer.id,
        "name": customer.name,
        "address": customer.address,
        "city": customer.city,
        "state": customer.state,
        "contact_number": customer.contact_number,
        "email": customer.email,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at
    }

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Soft delete customer (admin only)."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.is_deleted == False
    ).first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    customer.is_deleted = True
    db.commit()
    
    return None

@router.post("/upload-excel", status_code=status.HTTP_200_OK)
def upload_customers_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    """Upload customers from Excel file (admin only)."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be Excel format (.xlsx or .xls)"
        )
    
    try:
        file_content = file.file.read()
        customers_data = parse_excel_customers(file_content)
        
        if not customers_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid customer data found in Excel file"
            )
        
        created_count = 0
        skipped_count = 0
        
        for customer_data in customers_data:
            existing = db.query(Customer).filter(
                Customer.name == customer_data.get('name'),
                Customer.is_deleted == False
            ).first()
            
            if existing:
                skipped_count += 1
            else:
                new_customer = Customer(
                    name=customer_data.get('name'),
                    address=customer_data.get('address'),
                    city=customer_data.get('city'),
                    state=customer_data.get('state'),
                    contact_number=customer_data.get('contact_number'),
                    email=customer_data.get('email'),
                    created_by_id=current_user.id
                )
                db.add(new_customer)
                created_count += 1
        
        db.commit()
        
        return {
            "message": "Excel file processed successfully",
            "created": created_count,
            "skipped": skipped_count,
            "total_processed": created_count + skipped_count
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Excel file"
        )
