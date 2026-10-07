import sys
import os

sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_model import BankTransaction

db = SessionLocal()
txs = db.query(BankTransaction).filter(BankTransaction.case_id == 37, BankTransaction.mode.ilike('%NEFT%')).count()
print(f"Count with ilike %NEFT%: {txs}")

txs_exact = db.query(BankTransaction).filter(BankTransaction.case_id == 37, BankTransaction.mode == 'NEFT').count()
print(f"Count with exact 'NEFT': {txs_exact}")

modes = db.query(BankTransaction.mode).filter(BankTransaction.case_id == 37).distinct().all()
print(f"Distinct modes: {modes}")

db.close()
