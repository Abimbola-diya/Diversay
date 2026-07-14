from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
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
        
    # Query only inventories that exist for non-deleted products
    existing_inv = db.query(StoreInventory).join(Product).filter(
        StoreInventory.store_id == store_id,
        Product.is_deleted == False
    ).options(
        joinedload(StoreInventory.product)
    ).all()
    
    inventory_list = []
    for inv in existing_inv:
        inventory_list.append({
            "id": inv.id,
            "store_id": store_id,
            "product_id": inv.product_id,
            "product_name": inv.product.name,
            "product_category": inv.product.category.value,
            "default_unit": inv.product.default_unit.value,
            "product_brand": inv.product.brand,
            "stock": inv.stock,
            "reorder_level": inv.reorder_level,
            "unit_price": inv.product.unit_price
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
    """Update stock level or reorder level for a product at a specific store (admin only)."""
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
        inv = StoreInventory(
            store_id=store_id, 
            product_id=product_id, 
            stock=inventory_update.stock if inventory_update.stock is not None else 0.0,
            reorder_level=inventory_update.reorder_level if inventory_update.reorder_level is not None else 15.0
        )
        db.add(inv)
    else:
        if inventory_update.stock is not None:
            inv.stock = inventory_update.stock
        if inventory_update.reorder_level is not None:
            inv.reorder_level = inventory_update.reorder_level
        
    db.commit()
    db.refresh(inv)
    
    return {
        "id": inv.id,
        "store_id": store_id,
        "product_id": product_id,
        "product_name": product.name,
        "product_category": product.category.value,
        "default_unit": product.default_unit.value,
        "product_brand": product.brand,
        "stock": inv.stock,
        "reorder_level": inv.reorder_level,
        "unit_price": product.unit_price
    }

@router.delete("/{store_id}/inventory/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store_inventory(
    store_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_write_access)
):
    """Delete a product's inventory record from a specific store (admin only)."""
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
        
    inv = db.query(StoreInventory).filter(
        StoreInventory.store_id == store_id,
        StoreInventory.product_id == product_id
    ).first()
    
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product inventory record not found in this store"
        )
        
    db.delete(inv)
    db.commit()
    return None

@router.get("/{store_id}/analytics")
def get_store_analytics(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get store-specific analytics."""
    from models import Order, OrderLineItem
    from datetime import datetime, timedelta
    
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
        
    incoming_orders = db.query(Order).filter(
        Order.destination_store_id == store_id, 
        Order.is_deleted == False
    ).options(
        joinedload(Order.line_items)
    ).all()
    
    outgoing_orders = db.query(Order).filter(
        Order.source_store_id == store_id, 
        Order.is_deleted == False
    ).options(
        joinedload(Order.line_items)
    ).all()
    
    total_incoming = len(incoming_orders)
    total_outgoing = len(outgoing_orders)
    
    all_order_ids = [o.id for o in incoming_orders] + [o.id for o in outgoing_orders]
    
    trending = {}
    if all_order_ids:
        items = db.query(OrderLineItem).filter(
            OrderLineItem.order_id.in_(all_order_ids)
        ).options(
            joinedload(OrderLineItem.product)
        ).all()
        for item in items:
            product_name = item.product.name if item.product else f"Product #{item.product_id}"
            trending[product_name] = trending.get(product_name, 0) + item.quantity
            
    top_products = [
        {"name": name, "quantity": qty}
        for name, qty in sorted(trending.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    inv_items = db.query(StoreInventory).filter(
        StoreInventory.store_id == store_id
    ).options(
        joinedload(StoreInventory.product)
    ).all()
    dsl_count = 0
    dslp_count = 0
    dsl_stock = 0
    dslp_stock = 0
    for item in inv_items:
        product = item.product
        if product and not product.is_deleted:
            brand = (product.brand or "").upper()
            if brand == "DSL":
                dsl_count += 1
                dsl_stock += item.stock
            elif brand == "DSLP":
                dslp_count += 1
                dslp_stock += item.stock
                
    movement_dates = {}
    now = datetime.utcnow()
    for i in range(7):
        d = (now - timedelta(days=i)).date().isoformat()
        movement_dates[d] = {"incoming": 0, "outgoing": 0}
        
    for o in incoming_orders:
        if o.dispatch_time:
            d_str = o.dispatch_time.date().isoformat()
            if d_str in movement_dates:
                qty = sum(item.quantity for item in o.line_items)
                movement_dates[d_str]["incoming"] += qty
                
    for o in outgoing_orders:
        if o.dispatch_time:
            d_str = o.dispatch_time.date().isoformat()
            if d_str in movement_dates:
                qty = sum(item.quantity for item in o.line_items)
                movement_dates[d_str]["outgoing"] += qty
                
    movement_data = [
        {"date": d, "incoming": val["incoming"], "outgoing": val["outgoing"]}
        for d, val in sorted(movement_dates.items())
    ]
    
    return {
        "total_incoming": total_incoming,
        "total_outgoing": total_outgoing,
        "top_products": top_products,
        "dsl_count": dsl_count,
        "dslp_count": dslp_count,
        "dsl_stock": dsl_stock,
        "dslp_stock": dslp_stock,
        "movement_data": movement_data
    }
