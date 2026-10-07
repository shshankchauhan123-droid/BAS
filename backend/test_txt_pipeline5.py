import os
import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.core.database import SessionLocal, Base, engine
from app.files.file_model import File
from app.user.user_model import User
from app.case.case_model import Case
from app.bank_transactions.bank_transaction_model import BankTransaction

from app.processing.processing_service import process_bank_statement_first_stage

db = SessionLocal()
try:
    process_bank_statement_first_stage(db, 190)
    print("Success! TXT file processed.")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed: {e}")
finally:
    db.close()
