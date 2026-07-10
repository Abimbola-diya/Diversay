import logging
from database import SessionLocal
from models import Product, Store, StoreInventory, UnitType, ProductCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User provided inventory data for Owerri Store
owerri_inventory_data = [
    # General section
    {"name": "Avertin 100ml", "unit": UnitType.PCS, "stock": 92.0},
    {"name": "Neodine 1L", "unit": UnitType.PCS, "stock": 79.0},
    {"name": "Ultracal-d 500ml", "unit": UnitType.PCS, "stock": 84.0},
    {"name": "KOLIN plus(25kg)", "unit": UnitType.BAG, "stock": 9.0},
    {"name": "Stodi (25kg)", "unit": UnitType.BAG, "stock": 3.0},
    {"name": "Phytocee powder (25kg)", "unit": UnitType.BAG, "stock": 1.0},
    {"name": "Wyldox tablet", "unit": UnitType.PCS, "stock": 483.0},
    {"name": "A gee mix forte", "unit": UnitType.BAG, "stock": 2.0},
    {"name": "Topicure 250ml", "unit": UnitType.PCS, "stock": 50.0},
    {"name": "Zigbir 1L", "unit": UnitType.PCS, "stock": 102.0},

    # DSLPHARMA section
    {"name": "Amprolium30 100gm", "unit": UnitType.PCS, "stock": 507.0},
    {"name": "Gentylo 100gm", "unit": UnitType.PCS, "stock": 558.0},
    {"name": "Coxstop 100gm", "unit": UnitType.PCS, "stock": 685.0},
    {"name": "Levastar 100gm", "unit": UnitType.PCS, "stock": 343.0},
    {"name": "Diverflox 100gm", "unit": UnitType.PCS, "stock": 396.0},
    {"name": "Divertamin 100gm", "unit": UnitType.PCS, "stock": 330.0},
    {"name": "Doxineo 50gm", "unit": UnitType.PCS, "stock": 864.0},
    {"name": "Doxineo 100gm", "unit": UnitType.PCS, "stock": 630.0},
    {"name": "Dlsultrim 100gm", "unit": UnitType.PCS, "stock": 624.0},
    {"name": "Divercal-d 1L", "unit": UnitType.PCS, "stock": 54.0},
    {"name": "Divergen-d 100gm", "unit": UnitType.PCS, "stock": 268.0},
    {"name": "Divermec 1L", "unit": UnitType.PCS, "stock": 40.0},
    {"name": "Diversel-e 1L", "unit": UnitType.PCS, "stock": 56.0},
    {"name": "Enrol 1L", "unit": UnitType.PCS, "stock": 65.0},
    {"name": "Divercipro 1L", "unit": UnitType.PCS, "stock": 36.0},
    {"name": "Divervite 1L", "unit": UnitType.PCS, "stock": 90.0},
    {"name": "Divercox 1L", "unit": UnitType.PCS, "stock": 30.0},
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
        
        for item in owerri_inventory_data:
            # 1. Get or create product
            product = db.query(Product).filter(
                Product.name.ilike(item["name"]),
                Product.is_deleted == False
            ).first()
            
            if not product:
                logger.info(f"Creating product: {item['name']} with default unit: {item['unit']}")
                product = Product(
                    name=item["name"],
                    category=ProductCategory.OTHER,
                    default_unit=item["unit"],
                    unit_price=0.0
                )
                db.add(product)
                db.commit()
                db.refresh(product)
                
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
                
        db.commit()
        logger.info("Owerri Store inventory updated successfully!")
    except Exception as e:
        logger.error(f"Error updating Owerri Store inventory: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_owerri_store()
