import os
import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Bypass auth for testing
app.dependency_overrides = {}
from app.api.deps import get_current_user
def override_get_current_user():
    class MockUser:
        id = 1
    return MockUser()
app.dependency_overrides[get_current_user] = override_get_current_user

response = client.get('/api/v1/bank-transactions/case/38/summary?file_ids=194')
print("Status Code:", response.status_code)
print("Response JSON:", response.json() if response.status_code != 500 else response.text)
