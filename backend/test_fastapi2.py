import os
import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from fastapi.testclient import TestClient
from app.main import app

# Bypass auth for testing
from app.dependencies.auth import get_current_user
def override_get_current_user():
    class MockUser:
        id = 1
    return MockUser()
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)
try:
    response = client.get('/api/v1/bank-transactions/case/38/summary?file_ids=194')
    print("Status Code:", response.status_code)
    if response.status_code == 500:
        print("Response JSON:", response.text)
    else:
        print("Response JSON:", response.json())
except Exception as e:
    import traceback
    traceback.print_exc()
