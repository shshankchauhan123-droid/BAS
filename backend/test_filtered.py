import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_repository import get_filtered_transactions_by_case

db = SessionLocal()
try:
    data = get_filtered_transactions_by_case(db, case_id=38, page=1, page_size=20, counterparty_name="UPI")
    print("SUCCESS", len(data))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
