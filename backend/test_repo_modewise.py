import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_repository import get_mode_wise_by_case

db = SessionLocal()
try:
    data = get_mode_wise_by_case(db, case_id=38, file_ids=[195, 194])
    print("SUCCESS")
    print(data)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
