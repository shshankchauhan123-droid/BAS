import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.financial_analysis_service import get_financial_analysis

db = SessionLocal()
try:
    data = get_financial_analysis(db, case_id=38, file_ids=[195, 194])
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
