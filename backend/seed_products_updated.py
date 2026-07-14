"""
Script to consolidate and update the products database to match the official catalog of 38 products.
Maps old/typo product names to the clean catalog names.
Consolidates duplicate products in the database, merging their inventory stock
and redirecting any existing order line items to the new unified product records.
Soft-deletes products not in the catalog to hide them from the dropdown list.
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal
from models import Product, OrderLineItem, StoreInventory, ProductCategory, UnitType
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Official catalogs
dsl_products = [
    "Avertin Oral Solution 1% 100ml",
    "Ds-LivorTon Liquid 500ml",
    "DS-Siproxin 10% 100gm",
    "Megadox-N 100gm",
    "Oxy-100-FS 10kg",
    "Quinrocin Oral 1 Ltr",
    "Tyloton-100G",
    "Ultracal-D 500ml",
    "Ultra-TM Plus 500ml",
    "Ultravite-M/WS 100gm"
]

dslp_products = [
    "Amprolium 30 - 100grm",
    "Coxstop 100grm",
    "Coxstop 30grm",
    "Disultrim 100grm",
    "Disultrim 50grm",
    "Divercal-D",
    "Divercipro 1 Ltr",
    "Divercool C 1 Ltr",
    "Divercool C 25Litres",
    "Divercox 1 Litre",
    "Diverdazole 1 Ltr",
    "Diverflox 100grm",
    "Diverfume 1KG",
    "Divergen D 100grm",
    "Divertamin",
    "Divervite 1 Ltre",
    "Doxineo 100grm",
    "Doxineo 50grm",
    "Enro 1 Ltr",
    "Gentylo 100 grm",
    "Ivertmectin 1 Ltr",
    "Diversel E 1 Litre",
    "Diversel E 25 Litres",
    "Levastar 100grm",
    "Levastar 50grm",
    "Trusan Liquid Soap 25Ltr",
    "Vetodine 1 Ltr",
    "Vetodine 25 Ltr"
]

# Mapping from lowercase variations in database to official names
name_mapping = {
    # DSL
    "quinrocin": "Quinrocin Oral 1 Ltr",
    "quinrocin 1l": "Quinrocin Oral 1 Ltr",
    "quinrocin oral 1 ltr": "Quinrocin Oral 1 Ltr",
    
    "megadox": "Megadox-N 100gm",
    "megadox-n 100gm": "Megadox-N 100gm",
    
    "ds livorton": "Ds-LivorTon Liquid 500ml",
    "ds livorton 500ml": "Ds-LivorTon Liquid 500ml",
    "ds-livorton liquid 500ml": "Ds-LivorTon Liquid 500ml",
    
    "ds-ultr-tm plus": "Ultra-TM Plus 500ml",
    "ultra-tm plus 500ml": "Ultra-TM Plus 500ml",
    
    "ultravite-m/ws 100gm": "Ultravite-M/WS 100gm",
    
    "avertin 100ml": "Avertin Oral Solution 1% 100ml",
    "avertin oral solution 1% 100ml": "Avertin Oral Solution 1% 100ml",
    
    "ds-siproxin 10% 100gm": "DS-Siproxin 10% 100gm",
    "oxy-100-fs 10kg": "Oxy-100-FS 10kg",
    "tyloton 100gm": "Tyloton-100G",
    "tyloton-100g": "Tyloton-100G",
    "ultracal-d 500ml": "Ultracal-D 500ml",
    
    # DSLP
    "amprolium": "Amprolium 30 - 100grm",
    "amprolium30 100gm": "Amprolium 30 - 100grm",
    "amprolium 30 - 100grm": "Amprolium 30 - 100grm",
    
    "coxstop": "Coxstop 100grm",
    "coxstop 100gm": "Coxstop 100grm",
    "coxstop 100grm": "Coxstop 100grm",
    
    "coxstop 30gm": "Coxstop 30grm",
    "coxstop 30grm": "Coxstop 30grm",
    
    "dlsultrim 100gm": "Disultrim 100grm",
    "disultrim 100grm": "Disultrim 100grm",
    
    "dlsultrim 50gm": "Disultrim 50grm",
    "disultrim 50grm": "Disultrim 50grm",
    
    "divercal-d 1l": "Divercal-D",
    "divercal-d": "Divercal-D",
    
    "divercipro": "Divercipro 1 Ltr",
    "divercipro 1l": "Divercipro 1 Ltr",
    "divercipro 1 ltr": "Divercipro 1 Ltr",
    
    "divercool-c": "Divercool C 1 Ltr",
    "divercool-c 1l": "Divercool C 1 Ltr",
    "divercool c 1 ltr": "Divercool C 1 Ltr",
    
    "divercool-c 25l": "Divercool C 25Litres",
    "divercool c 25litres": "Divercool C 25Litres",
    
    "divercox 1l": "Divercox 1 Litre",
    "divercox 1 litre": "Divercox 1 Litre",
    
    "diverdazole 1l": "Diverdazole 1 Ltr",
    "diverdazole 1 ltr": "Diverdazole 1 Ltr",
    
    "diverflox 100gm": "Diverflox 100grm",
    "diverflox 100grm": "Diverflox 100grm",
    
    "diverfume 1kg": "Diverfume 1KG",
    "diverfume 1kg": "Diverfume 1KG",
    
    "divergen d": "Divergen D 100grm",
    "divergen-d 100gm": "Divergen D 100grm",
    "divergen d 100grm": "Divergen D 100grm",
    
    "divertamin 100gm": "Divertamin",
    "divertamin": "Divertamin",
    
    "divervite 1l": "Divervite 1 Ltre",
    "divervite 1 ltre": "Divervite 1 Ltre",
    
    "doxineo 100gm": "Doxineo 100grm",
    "doxineo 100grm": "Doxineo 100grm",
    
    "doxineo 50gm": "Doxineo 50grm",
    "doxineo 50grm": "Doxineo 50grm",
    
    "enrol 1l": "Enro 1 Ltr",
    "enro 1 ltr": "Enro 1 Ltr",
    
    "gentylo": "Gentylo 100 grm",
    "gentylo 100gm": "Gentylo 100 grm",
    "gentylo 100 grm": "Gentylo 100 grm",
    
    "divermectin 1l": "Ivertmectin 1 Ltr",
    "divermec 1l": "Ivertmectin 1 Ltr",
    "ivertmectin 1 ltr": "Ivertmectin 1 Ltr",
    
    "diversel-e 1l": "Diversel E 1 Litre",
    "diversel e 1 litre": "Diversel E 1 Litre",
    
    "diversel-e 25l": "Diversel E 25 Litres",
    "diversel e 25 litres": "Diversel E 25 Litres",
    
    "levastar 100gm": "Levastar 100grm",
    "levastar 100grm": "Levastar 100grm",
    
    "levastar 50gm": "Levastar 50grm",
    "levastar dewormer": "Levastar 50grm",
    "levastar 50grm": "Levastar 50grm",
    
    "trusan 25l": "Trusan Liquid Soap 25Ltr",
    "trusan liquid soap 25ltr": "Trusan Liquid Soap 25Ltr",
    
    "vetodine 1l": "Vetodine 1 Ltr",
    "vetodine 1 ltr": "Vetodine 1 Ltr",
    
    "vetodine 25l": "Vetodine 25 Ltr",
    "vetodine 25 ltr": "Vetodine 25 Ltr"
}

def sync_products():
    db = SessionLocal()
    try:
        # Load all existing active or inactive products
        db_products = db.query(Product).all()
        db_products_by_name = {p.name.upper(): p for p in db_products}
        
        catalog_matches = {} # official_name -> Product object
        db_ids_to_merge = {} # old_id -> new_id
        
        # 1. Match catalog items
        all_catalog = []
        for name in dsl_products:
            all_catalog.append((name, "DSL"))
        for name in dslp_products:
            all_catalog.append((name, "DSLP"))
            
        for name, brand in all_catalog:
            name_upper = name.upper()
            
            # Try to match by exact name first
            if name_upper in db_products_by_name:
                main_prod = db_products_by_name[name_upper]
                main_prod.name = name
                main_prod.brand = brand
                main_prod.is_deleted = False
                catalog_matches[name] = main_prod
                logger.info(f"Exact Match: Catalog item '{name}' matched with existing DB product ID {main_prod.id}.")
                continue
                
            # Try to match by mappings
            mapped_prods = []
            for db_p in db_products:
                db_p_lower = db_p.name.lower()
                if name_mapping.get(db_p_lower) == name:
                    mapped_prods.append(db_p)
            
            if mapped_prods:
                # Select one as the main product
                # Try to choose one that is already referenced, or just the first one
                main_prod = mapped_prods[0]
                main_prod.name = name
                main_prod.brand = brand
                main_prod.is_deleted = False
                catalog_matches[name] = main_prod
                logger.info(f"Mapped Match: Catalog item '{name}' matched with DB product ID {main_prod.id} (originally '{main_prod.name}').")
                
                # Any other DB products that map to this catalog name are duplicates and should be merged
                for dup in mapped_prods[1:]:
                    db_ids_to_merge[dup.id] = main_prod.id
                    logger.info(f"Duplicate Mark: DB product ID {dup.id} ('{dup.name}') will merge into main ID {main_prod.id}.")
            else:
                # No match found, create a new product
                new_prod = Product(
                    name=name,
                    brand=brand,
                    category=ProductCategory.OTHER,
                    default_unit=UnitType.CARTON,
                    unit_price=0.0,
                    is_deleted=False
                )
                db.add(new_prod)
                db.flush() # get the ID
                catalog_matches[name] = new_prod
                logger.info(f"Created Product: '{name}' (Brand: {brand}) as ID {new_prod.id}.")

        # 2. Merge Duplicate Products
        if db_ids_to_merge:
            logger.info(f"Merging {len(db_ids_to_merge)} duplicate product records...")
            
            # Direct order line items
            for old_id, new_id in db_ids_to_merge.items():
                # Update order line items
                updated_items = db.query(OrderLineItem).filter(OrderLineItem.product_id == old_id).update(
                    {OrderLineItem.product_id: new_id},
                    synchronize_session=False
                )
                if updated_items:
                    logger.info(f"Merged OrderLineItems: redirected {updated_items} lines from product ID {old_id} to ID {new_id}.")
                
                # Merge store inventories
                old_invs = db.query(StoreInventory).filter(StoreInventory.product_id == old_id).all()
                for old_inv in old_invs:
                    # Check if new inventory record exists in this store
                    new_inv = db.query(StoreInventory).filter(
                        StoreInventory.store_id == old_inv.store_id,
                        StoreInventory.product_id == new_id
                    ).first()
                    
                    if new_inv:
                        new_inv.stock += old_inv.stock
                        db.delete(old_inv)
                        logger.info(f"Merged StoreInventory: combined stock from product {old_id} into {new_id} for store {old_inv.store_id}.")
                    else:
                        old_inv.product_id = new_id
                        logger.info(f"Merged StoreInventory: updated product ID to {new_id} for store {old_inv.store_id}.")
                
                # Physical delete of duplicate product, since it is fully unreferenced now
                dup_prod = db.query(Product).filter(Product.id == old_id).first()
                if dup_prod:
                    db.delete(dup_prod)
                    logger.info(f"Deleted duplicate DB product record ID {old_id}.")

        # 3. Soft-delete other products in DB that are NOT part of the official catalog
        catalog_ids = {p.id for p in catalog_matches.values()}
        other_active_prods = db.query(Product).filter(
            Product.id.not_in(list(catalog_ids)),
            Product.is_deleted == False
        ).all()
        
        soft_deleted_count = 0
        for p in other_active_prods:
            p.is_deleted = True
            soft_deleted_count += 1
            
        logger.info(f"Soft-deleted {soft_deleted_count} products not present in the 38-product official catalog.")

        db.commit()
        logger.info("Product database synchronization complete!")
        
    except Exception as e:
        logger.error(f"Error during product synchronization: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    sync_products()
