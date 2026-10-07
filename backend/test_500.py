import os
import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_repository import get_case_transaction_summary

db = SessionLocal()
try:
    summary_filtered = get_case_transaction_summary(db, case_id=38, file_ids=[194])
    print("Summary for Case 38, File 194:", summary_filtered)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
