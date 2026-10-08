import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_repository import get_counterparty_analysis
from fastapi.encoders import jsonable_encoder
import json

db = SessionLocal()
try:
    data = get_counterparty_analysis(db, case_id=38, file_ids=[194])
    encoded = jsonable_encoder(data)
    json_str = json.dumps(encoded)
    print("Serialization OK!")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
