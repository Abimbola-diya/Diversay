from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, Store, StoreInventory, Product
from schemas import StoreCreate, StoreUpdate, StoreResponse, StoreInventoryResponse, StoreInventoryUpdate
from auth import get_current_user, check_write_access
from typing import List

router = APIRouter(prefix="/stores", tags=["stores"])

@router.get("/", response_model=List[StoreResponse])
def list_stores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all active stores."""
    stores = db.query(Store).filter(Store.is_deleted == False).order_by(Store.is_central.desc(), Store.name).all()
    return stores

@router.get("/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single store by ID."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store

@router.post("/", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    store: StoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Create a new store (admin only)."""
    existing = db.query(Store).filter(
        Store.name == store.name,
        Store.is_deleted == False
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A store with this name already exists"
        )
    
    new_store = Store(
        name=store.name,
        city=store.city,
        state=store.state,
        address=store.address,
        is_central=store.is_central,
        phone=store.phone,
        manager_name=store.manager_name
    )
    
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

@router.put("/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: int,
    store_update: StoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Update a store (admin only)."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    
    update_data = store_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(store, field, value)
    
    db.commit()
    db.refresh(store)
    return store

@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Soft delete a store (admin only)."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    
    store.is_deleted = True
    db.commit()
    return None

@router.get("/{store_id}/inventory", response_model=List[StoreInventoryResponse])
def get_store_inventory(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all product stock levels for a given store."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
        
    products = db.query(Product).filter(Product.is_deleted == False).all()
    
    inventory_list = []
    for p in products:
        inv = db.query(StoreInventory).filter(
            StoreInventory.store_id == store_id,
            StoreInventory.product_id == p.id
        ).first()
        
        if not inv:
            # Dynamically initialize on the fly if not found
            inv = StoreInventory(store_id=store_id, product_id=p.id, stock=0.0)
            db.add(inv)
            db.commit()
            db.refresh(inv)
            
        inventory_list.append({
            "id": inv.id,
            "store_id": store_id,
            "product_id": p.id,
            "product_name": p.name,
            "product_category": p.category.value,
            "default_unit": p.default_unit.value,
            "stock": inv.stock,
            "unit_price": p.unit_price
        })
        
    return inventory_list

@router.put("/{store_id}/inventory/{product_id}", response_model=StoreInventoryResponse)
def update_store_inventory(
    store_id: int,
    product_id: int,
    inventory_update: StoreInventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Update stock level for a product at a specific store (admin only)."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
        
    product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    inv = db.query(StoreInventory).filter(
        StoreInventory.store_id == store_id,
        StoreInventory.product_id == product_id
    ).first()
    
    if not inv:
        inv = StoreInventory(store_id=store_id, product_id=product_id, stock=inventory_update.stock)
        db.add(inv)
    else:
        inv.stock = inventory_update.stock
        
    db.commit()
    db.refresh(inv)
    
    return {
        "id": inv.id,
        "store_id": store_id,
        "product_id": product_id,
        "product_name": product.name,
        "product_category": product.category.value,
        "default_unit": product.default_unit.value,
        "stock": inv.stock,
        "unit_price": product.unit_price
    }
