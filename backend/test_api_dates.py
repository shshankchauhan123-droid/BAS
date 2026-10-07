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

file_ids = db.query(BankTransaction.file_id).filter(BankTransaction.case_id == 37).distinct().all()
file_ids_str = ",".join([str(f[0]) for f in file_ids])

db.close()

client = TestClient(app)

print("--- Testing valid dates ---")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&transaction_mode=UPI&min_amount=50000&start_date=2021-10-01&end_date=2021-10-31", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", response.status_code)
# print("RESPONSE:", response.json())

print("\n--- Testing start_date > end_date ---")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-31&end_date=2021-10-01", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", response.status_code)
print("RESPONSE:", response.json())

print("\n--- Testing invalid date string ---")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=invalid-date", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", response.status_code)
print("RESPONSE:", response.json())
