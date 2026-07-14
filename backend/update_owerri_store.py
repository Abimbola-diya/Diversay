import logging
from database import SessionLocal
from models import Product, Store, StoreInventory, UnitType, ProductCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User provided inventory data for Owerri Store (as of 29/06/2026)
owerri_inventory_data = [
    # DSL Brand
    {"name": "Avertin 100ml", "unit": UnitType.PCS, "stock": 92.0, "brand": "DSL"},
    {"name": "Neodine 1L", "unit": UnitType.PCS, "stock": 79.0, "brand": "DSL"},
    {"name": "Ultracal-D 500ml", "unit": UnitType.PCS, "stock": 84.0, "brand": "DSL"},
    {"name": "KOLIN plus(25kg)", "unit": UnitType.BAG, "stock": 9.0, "brand": "DSL"},
    {"name": "Stodi (25kg)", "unit": UnitType.BAG, "stock": 3.0, "brand": "DSL"},
    {"name": "Phytocee powder (25kg)", "unit": UnitType.BAG, "stock": 1.0, "brand": "DSL"},
    {"name": "Wyldox tablet", "unit": UnitType.PCS, "stock": 483.0, "brand": "DSL"},
    {"name": "A gee mix forte", "unit": UnitType.BAG, "stock": 2.0, "brand": "DSL"},
    {"name": "Topicure 250ml", "unit": UnitType.PCS, "stock": 50.0, "brand": "DSL"},
    {"name": "Zigbir 1L", "unit": UnitType.PCS, "stock": 102.0, "brand": "DSL"},
    
    # DSLPHARMA Brand (stored as "DSLP" in db)
    {"name": "Amprolium30 100gm", "unit": UnitType.PCS, "stock": 507.0, "brand": "DSLP"},
    {"name": "Gentylo 100gm", "unit": UnitType.PCS, "stock": 558.0, "brand": "DSLP"},
    {"name": "Coxstop 100gm", "unit": UnitType.PCS, "stock": 685.0, "brand": "DSLP"},
    {"name": "Levastar 100gm", "unit": UnitType.PCS, "stock": 343.0, "brand": "DSLP"},
    {"name": "Diverflox 100gm", "unit": UnitType.PCS, "stock": 396.0, "brand": "DSLP"},
    {"name": "Divertamin 100gm", "unit": UnitType.PCS, "stock": 330.0, "brand": "DSLP"},
    {"name": "Doxineo 50gm", "unit": UnitType.PCS, "stock": 864.0, "brand": "DSLP"},
    {"name": "Doxineo 100grm", "unit": UnitType.PCS, "stock": 630.0, "brand": "DSLP"},
    {"name": "Dlsultrim 100gm", "unit": UnitType.PCS, "stock": 624.0, "brand": "DSLP"},
    {"name": "Divercal-d 1L", "unit": UnitType.PCS, "stock": 54.0, "brand": "DSLP"},
    {"name": "Divergen-d 100gm", "unit": UnitType.PCS, "stock": 268.0, "brand": "DSLP"},
    {"name": "Divermectin 1L", "unit": UnitType.PCS, "stock": 40.0, "brand": "DSLP"},
    {"name": "Diversel-e 1L", "unit": UnitType.PCS, "stock": 56.0, "brand": "DSLP"},
    {"name": "Enrol 1L", "unit": UnitType.PCS, "stock": 65.0, "brand": "DSLP"},
    {"name": "Divercipro 1L", "unit": UnitType.PCS, "stock": 36.0, "brand": "DSLP"},
    {"name": "Divervite 1L", "unit": UnitType.PCS, "stock": 90.0, "brand": "DSLP"},
    {"name": "Divercox 1L", "unit": UnitType.PCS, "stock": 30.0, "brand": "DSLP"}
]

def update_owerri_store():
    db = SessionLocal()
    try:
        # Find Owerri Store
        owerri_store = db.query(Store).filter(
            Store.name.ilike("%Owerri Store%"),
            Store.is_deleted == False
        ).first()
        
        if not owerri_store:
            logger.error("Owerri Store not found in database!")
            return
            
        logger.info(f"Found Owerri Store with ID: {owerri_store.id}")
        
        updated_product_ids = []
        
        for item in owerri_inventory_data:
            # 1. Get or create product
            product = db.query(Product).filter(
                Product.name.ilike(item["name"])
            ).first()
            
            if product:
                if product.is_deleted:
                    logger.info(f"Undeleting existing product: {product.name}")
                    product.is_deleted = False
                # Update brand and default_unit if necessary
                if product.brand != item["brand"]:
                    product.brand = item["brand"]
                db.commit()
            else:
                logger.info(f"Creating product: {item['name']} with default unit: {item['unit']} and brand: {item['brand']}")
                product = Product(
                    name=item["name"],
                    category=ProductCategory.OTHER,
                    default_unit=item["unit"],
                    brand=item["brand"],
                    unit_price=0.0
                )
                db.add(product)
                db.commit()
                db.refresh(product)
                
            updated_product_ids.append(product.id)
            
            # 2. Update stock for Owerri Store
            inv = db.query(StoreInventory).filter(
                StoreInventory.store_id == owerri_store.id,
                StoreInventory.product_id == product.id
            ).first()
            
            if not inv:
                logger.info(f"Creating inventory record for {product.name} at Owerri Store with stock {item['stock']}")
                inv = StoreInventory(
                    store_id=owerri_store.id,
                    product_id=product.id,
                    stock=item["stock"]
                )
                db.add(inv)
            else:
                logger.info(f"Updating stock for {product.name} at Owerri Store: {inv.stock} -> {item['stock']}")
                inv.stock = item["stock"]
                
        # 3. Reset stock to 0.0 for any products NOT in the new list for Owerri Store
        other_invs = db.query(StoreInventory).filter(
            StoreInventory.store_id == owerri_store.id,
            ~StoreInventory.product_id.in_(updated_product_ids)
        ).all()
        
        for other_inv in other_invs:
            logger.info(f"Resetting stock for {other_inv.product.name} at Owerri Store to 0.0 (not in current stock taking)")
            other_inv.stock = 0.0
            
        db.commit()
        logger.info("Owerri Store inventory updated successfully!")
    except Exception as e:
        logger.error(f"Error updating Owerri Store inventory: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_owerri_store()
