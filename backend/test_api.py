import requests

url = "http://localhost:8000/api/v1/bank-transactions/case/37/search?mode=NEFT&page=1&page_size=20"
headers = {
    "accept": "application/json"
}

# The backend requires auth. Let me just use the FastAPI test client directly!
import sys
import os

sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.main import app
from fastapi.testclient import TestClient
from app.user.user_model import User
from app.core.database import SessionLocal
from app.core.security import create_access_token

db = SessionLocal()
user = db.query(User).first()
token = create_access_token(data={"sub": str(user.id)})
db.close()

client = TestClient(app)
response = client.get("/api/v1/bank-transactions/case/37/search?mode=NEFT&page=1&page_size=20", headers={"Authorization": f"Bearer {token}"})
print(response.json())
