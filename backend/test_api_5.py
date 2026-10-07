import sys
import os

sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.main import app
from fastapi.testclient import TestClient
from app.user.user_model import User
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.case_management.case_service import get_case_files

db = SessionLocal()
user = db.query(User).first()
token = create_access_token(user_id=user.id, role=user.role)

# get valid files
case_files = get_case_files(db=db, case_id=37, user=user)
file_ids_list = [str(f.id) for f in case_files]
file_ids_str = ",".join(file_ids_list)
print("Valid file_ids array:", file_ids_list)

db.close()

client = TestClient(app)
response = client.get(f"/api/v1/bank-transactions/case/37/search?file_ids={file_ids_str}&mode=NEFT&page=1&page_size=20", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", response.status_code)
print("TOTAL:", response.json().get("total"))
