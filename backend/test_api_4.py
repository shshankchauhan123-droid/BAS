import sys
import os
import json

sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.main import app
from fastapi.testclient import TestClient
from app.user.user_model import User
from app.core.database import SessionLocal
from app.core.security import create_access_token

db = SessionLocal()
user = db.query(User).first()
token = create_access_token(user_id=user.id, role=user.role)
db.close()

client = TestClient(app)
response = client.get("/api/v1/bank-transactions/case/37/search?file_ids=181,185,187&mode=NEFT&page=1&page_size=2", headers={"Authorization": f"Bearer {token}"})
print(json.dumps(response.json(), indent=2))
