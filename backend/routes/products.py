from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Product
from ..schemas import ProductCreate, ProductUpdate, ProductResponse
from ..auth import get_current_user, check_admin, check_write_access
from typing import List

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/", response_model=dict)
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all products with pagination."""
    query = db.query(Product).filter(Product.is_deleted == False)
    total = query.count()
    
    products = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category.value,
                "default_unit": p.default_unit.value,
                "brand": p.brand,
                "unit_price": p.unit_price,
                "created_at": p.created_at
            }
            for p in products
        ]
    }

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Create a new product (admin only)."""
    existing = db.query(Product).filter(
        Product.name == product.name,
        Product.is_deleted == False
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product with this name already exists"
        )
    
    new_product = Product(
        name=product.name,
        category=product.category,
        default_unit=product.default_unit,
        brand=product.brand,
        unit_price=product.unit_price
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return {
        "id": new_product.id,
        "name": new_product.name,
        "category": new_product.category,
        "default_unit": new_product.default_unit,
        "brand": new_product.brand,
        "unit_price": new_product.unit_price,
        "created_at": new_product.created_at
    }

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Update product (admin only)."""
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_deleted == False
    ).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    update_data = product_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "default_unit": product.default_unit,
        "brand": product.brand,
        "unit_price": product.unit_price,
        "created_at": product.created_at
    }

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Soft delete product (admin only)."""
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_deleted == False
    ).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    product.is_deleted = True
    db.commit()
    
    return None
