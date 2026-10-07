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
headers = {"Authorization": f"Bearer {token}"}

print("A. No date:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&transaction_mode=UPI&min_amount=50000", headers=headers)
print("STATUS:", response.status_code)

print("\nB. Start date only:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-01", headers=headers)
print("STATUS:", response.status_code)

print("\nC. End date only:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&end_date=2021-10-31", headers=headers)
print("STATUS:", response.status_code)

print("\nD. Both dates:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-01&end_date=2021-10-31", headers=headers)
print("STATUS:", response.status_code)

print("\nE. Both dates + transaction mode:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-01&end_date=2021-10-31&transaction_mode=UPI", headers=headers)
print("STATUS:", response.status_code)

print("\nF. Both dates + min amount:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-01&end_date=2021-10-31&min_amount=50000", headers=headers)
print("STATUS:", response.status_code)

print("\nG. Both dates + transaction mode + min amount + multiple file_ids:")
response = client.get(f"/api/v1/bank-transactions/case/37/transaction-relationships?file_ids={file_ids_str}&start_date=2021-10-01&end_date=2021-10-31&transaction_mode=UPI&min_amount=50000", headers=headers)
print("STATUS:", response.status_code)

