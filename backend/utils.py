from datetime import datetime, timezone
from models import Order, OrderStatus
from sqlalchemy.orm import Session
from difflib import SequenceMatcher
from openpyxl import load_workbook
from typing import List, Tuple
import io
import json

def calculate_order_status(order: Order) -> OrderStatus:
    """Calculate order status based on timestamps and delivery status."""
    if order.actual_delivery_time:
        if order.actual_delivery_time <= order.expected_delivery_time:
            return OrderStatus.DELIVERED_ON_TIME
        else:
            return OrderStatus.DELIVERED_LATE
    else:
        if not order.dispatch_time:
            return OrderStatus.DRAFT
        
        # Dynamically match timezone awareness of order.expected_delivery_time
        now = datetime.now(timezone.utc) if (order.expected_delivery_time and order.expected_delivery_time.tzinfo) else datetime.utcnow()
        if now <= order.expected_delivery_time:
            return OrderStatus.IN_TRANSIT
        else:
            return OrderStatus.DELAYED

def calculate_delivery_duration(order: Order) -> int:
    """Calculate delivery duration in hours between dispatch and actual delivery."""
    if order.dispatch_time and order.actual_delivery_time:
        delta = order.actual_delivery_time - order.dispatch_time
        return int(delta.total_seconds() / 3600)
    return None

def generate_order_number(db: Session) -> str:
    """Generate unique order number in format: DSL-YYYY-XXXX"""
    year = datetime.utcnow().year
    
    last_order = db.query(Order).filter(
        Order.order_number.ilike(f"DSL-{year}-%")
    ).order_by(Order.id.desc()).first()
    
    if last_order:
        seq = int(last_order.order_number.split("-")[-1])
        seq += 1
    else:
        seq = 1
    
    order_number = f"DSL-{year}-{seq:04d}"
    return order_number

def _trigram_similarity(a: str, b: str) -> float:
    """Calculate trigram (3-gram) overlap between two strings."""
    if len(a) < 3 or len(b) < 3:
        # Fall back to bigrams for short strings
        n = 2
    else:
        n = 3
    
    def ngrams(s, n):
        return set(s[i:i+n] for i in range(len(s) - n + 1))
    
    grams_a = ngrams(a, n)
    grams_b = ngrams(b, n)
    
    if not grams_a or not grams_b:
        return 0.0
    
    intersection = grams_a & grams_b
    union = grams_a | grams_b
    return len(intersection) / len(union)  # Jaccard similarity


def fuzzy_search_customers(query: str, customers: List[dict], threshold: float = 0.15) -> List[dict]:
    """
    Smart search customers by name using multi-signal scoring:
      1. Exact prefix match (name starts with query)        → +5.0
      2. Any word in the name starts with the query          → +3.0
      3. Substring containment (query found inside name)     → +2.0
      4. Trigram similarity for typo tolerance                → 0.0–1.0
    Results are sorted by total score descending.
    """
    if not query:
        return []
    
    query_lower = query.lower().strip()
    results = []
    
    for customer in customers:
        name_lower = customer['name'].lower()
        score = 0.0
        
        # Signal 1: Name starts with the query (strongest signal)
        if name_lower.startswith(query_lower):
            score += 5.0
        
        # Signal 2: Any word in the name starts with the query
        words = name_lower.split()
        if any(w.startswith(query_lower) for w in words):
            score += 3.0
        
        # Signal 3: Substring containment
        if query_lower in name_lower:
            score += 2.0
        
        # Signal 4: Trigram similarity (catches typos)
        tri_sim = _trigram_similarity(query_lower, name_lower)
        score += tri_sim
        
        if score >= threshold:
            results.append((customer, score))
    
    results.sort(key=lambda x: (-x[1], x[0]['name']))
    return [r[0] for r in results]

def parse_excel_customers(file_content: bytes) -> List[dict]:
    """Parse customers from Excel file."""
    try:
        workbook = load_workbook(io.BytesIO(file_content))
        sheet = workbook.active
        
        headers = {}
        for col_idx, cell in enumerate(sheet[1], 1):
            if cell.value:
                headers[cell.value.lower().strip()] = col_idx
        
        expected_cols = {
            'name': ['name', 'customer name', 'customer_name'],
            'address': ['address', 'delivery address'],
            'city': ['city'],
            'state': ['state'],
            'contact_number': ['contact', 'contact number', 'contact_number', 'phone'],
            'email': ['email', 'email address']
        }
        
        col_mapping = {}
        for field, alternatives in expected_cols.items():
            for header_key, col_idx in headers.items():
                if any(alt in header_key for alt in alternatives):
                    col_mapping[field] = col_idx
                    break
        
        customers = []
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=False), 2):
            customer = {}
            
            for field, col_idx in col_mapping.items():
                cell_value = sheet.cell(row=row_idx, column=col_idx).value
                customer[field] = cell_value if cell_value else None
            
            if customer.get('name'):
                customers.append(customer)
        
        return customers
    
    except Exception as e:
        raise ValueError(f"Error parsing Excel file: {str(e)}")

def get_order_with_details(order: Order) -> dict:
    """Convert order object to dict with calculated fields and related data."""
    status = calculate_order_status(order)
    duration = calculate_delivery_duration(order)
    
    # Calculate total amount
    total_amount = sum(item.unit_price * item.quantity for item in order.line_items)
    
    return {
        "id": order.id,
        "order_number": order.order_number,
        "waybill_number": order.waybill_number,
        "invoice_number": order.invoice_number,
        "customer_id": order.customer_id,
        "customer_name": order.customer.name if order.customer else None,
        "customer_state": order.customer.state if order.customer else None,
        "dispatch_time": order.dispatch_time,
        "expected_delivery_time": order.expected_delivery_time,
        "actual_delivery_time": order.actual_delivery_time,
        "delivery_duration": duration,
        "order_status": status,
        "notes": order.notes,
        "driver_name": order.driver_name,
        "vehicle_number": order.vehicle_number,
        "created_by_id": order.created_by_id,
        "created_by_name": order.created_by_user.full_name if order.created_by_user else None,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "total_amount": total_amount,
        "line_items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit": item.unit.value,
                "unit_price": item.unit_price,
                "total_price": item.unit_price * item.quantity,
                "created_at": item.created_at
            }
            for item in order.line_items
        ]
    }

def calculate_hours_overdue(expected_time: datetime) -> int:
    """Calculate how many hours past expected delivery time."""
    # Dynamically match timezone awareness of expected_time
    now = datetime.now(timezone.utc) if (expected_time and expected_time.tzinfo) else datetime.utcnow()
    delta = now - expected_time
    return int(delta.total_seconds() / 3600)
