import sys
import os

sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.main import app
from fastapi.testclient import TestClient
from app.user.user_model import User
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.bank_transactions.bank_transaction_model import BankTransaction

db = SessionLocal()
user = db.query(User).first()
token = create_access_token(user_id=user.id, role=user.role)
print(f"Token: {token}")

# Get valid file_ids for case 37
file_ids = db.query(BankTransaction.file_id).filter(BankTransaction.case_id == 37).distinct().all()
file_ids_str = ",".join([str(f[0]) for f in file_ids])
print(f"Valid file_ids for case 37: {file_ids_str}")

db.close()

client = TestClient(app)
response = client.get(f"/api/v1/bank-transactions/case/37/search?file_ids={file_ids_str}&mode=NEFT&page=1&page_size=20", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", response.status_code)
print("RESPONSE:", response.json())
