import subprocess
import time
import httpx
import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')

from app.core.security import create_access_token
token = create_access_token(subject="1", role="superadmin", custom_claims={"user_id": 1, "sub": "1"})

process = subprocess.Popen(
    [r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend\venv\Scripts\python.exe", "-m", "uvicorn", "app.main:app", "--port", "8005"],
    cwd=r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

time.sleep(5)

try:
    response = httpx.get("http://127.0.0.1:8005/api/v1/bank-transactions/case/38/counterparty-analysis?file_ids=194", headers={"Authorization": f"Bearer {token}"}, timeout=5)
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
except Exception as e:
    print("HTTPX ERROR:", e)

process.terminate()
stdout, stderr = process.communicate()
print("STDOUT:", stdout.decode(errors='replace'))
print("STDERR:", stderr.decode(errors='replace'))
