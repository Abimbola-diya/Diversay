import logging
from database import SessionLocal
from models import Product, Store, StoreInventory, UnitType, ProductCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User provided inventory data for Awe Store
awe_inventory_data = [
    {"name": "Enrol 1L", "unit": UnitType.PCS, "stock": 48.0},
    {"name": "Gentylo 100gm", "unit": UnitType.PCS, "stock": 6.0},
    {"name": "Divertamin 100gm", "unit": UnitType.PCS, "stock": 361.0},
    {"name": "Levastar 100gm", "unit": UnitType.PCS, "stock": 288.0},
    {"name": "Doxineo 50gm", "unit": UnitType.PCS, "stock": 266.0},
    {"name": "Divercipro 1L", "unit": UnitType.PCS, "stock": 45.0},
    {"name": "Coxstop 100gm", "unit": UnitType.PCS, "stock": 672.0},
    {"name": "Divergen-d 100gm", "unit": UnitType.PCS, "stock": 1212.0},
    {"name": "Amprolium30 100gm", "unit": UnitType.PCS, "stock": 733.0},
    {"name": "Vetodine 1L", "unit": UnitType.PCS, "stock": 162.0},
    {"name": "Diverflox 100gm", "unit": UnitType.PCS, "stock": 1350.0},
    {"name": "Dlsultrim 100gm", "unit": UnitType.PCS, "stock": 608.0},
    {"name": "Divermectin 1L", "unit": UnitType.PCS, "stock": 54.0},
    {"name": "Vetodine 25L", "unit": UnitType.KEG, "stock": 10.0},
    {"name": "Divercal-d 1L", "unit": UnitType.PCS, "stock": 35.0},
    {"name": "Divervite 1L", "unit": UnitType.PCS, "stock": 48.0},
    {"name": "Divercool-c 25L", "unit": UnitType.KEG, "stock": 6.0},
    {"name": "Diverdazole 1L", "unit": UnitType.PCS, "stock": 72.0},
    {"name": "Divercox 1L", "unit": UnitType.PCS, "stock": 109.0},
    {"name": "Diversel-e 1L", "unit": UnitType.PCS, "stock": 97.0},
    {"name": "Avertin 100ml", "unit": UnitType.PCS, "stock": 20.0},
    {"name": "Neodine 1L", "unit": UnitType.PCS, "stock": 82.0},
    {"name": "Ultracal-d 500ml", "unit": UnitType.PCS, "stock": 174.0},
    {"name": "Neodine 20L", "unit": UnitType.KEG, "stock": 10.0},
    {"name": "Curatox (25kg)", "unit": UnitType.BAG, "stock": 3.0},
    {"name": "Citramax 20L", "unit": UnitType.KEG, "stock": 15.0},
    {"name": "Citramax 1L", "unit": UnitType.PCS, "stock": 112.0},
    {"name": "Zigbir 1L", "unit": UnitType.PCS, "stock": 36.0},
    {"name": "Wyldox A and B 500gm", "unit": UnitType.PCS, "stock": 400.0},
    {"name": "KOLIN plus(25kg)", "unit": UnitType.BAG, "stock": 3.0},
    {"name": "Wyldox tablet", "unit": UnitType.PCS, "stock": 1690.0},
    {"name": "Vaccinator", "unit": UnitType.PCS, "stock": 8.0},
    {"name": "Topicure 250ml", "unit": UnitType.PCS, "stock": 888.0},
    {"name": "Maxizyme exf 25k", "unit": UnitType.DRUM, "stock": 7.0},
    {"name": "Trusan 25L", "unit": UnitType.KEG, "stock": 2.0}
]

def update_awe_store():
    db = SessionLocal()
    try:
        # Find Awe Store
        awe_store = db.query(Store).filter(
            Store.name.ilike("%Awe Store%"),
            Store.is_deleted == False
        ).first()
        
        if not awe_store:
            logger.error("Awe Store not found in database!")
            return
            
        logger.info(f"Found Awe Store with ID: {awe_store.id}")
        
        for item in awe_inventory_data:
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
                
            # 2. Update stock for Awe Store
            inv = db.query(StoreInventory).filter(
                StoreInventory.store_id == awe_store.id,
                StoreInventory.product_id == product.id
            ).first()
            
            if not inv:
                logger.info(f"Creating inventory record for {product.name} at Awe Store with stock {item['stock']}")
                inv = StoreInventory(
                    store_id=awe_store.id,
                    product_id=product.id,
                    stock=item["stock"]
                )
                db.add(inv)
            else:
                logger.info(f"Updating stock for {product.name} at Awe Store: {inv.stock} -> {item['stock']}")
                inv.stock = item["stock"]
                
        db.commit()
        logger.info("Awe Store inventory updated successfully!")
    except Exception as e:
        logger.error(f"Error updating Awe Store inventory: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_awe_store()
