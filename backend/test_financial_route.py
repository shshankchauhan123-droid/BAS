import sys
import httpx
from fastapi import FastAPI
import uvicorn
import threading
import time
import subprocess

process = subprocess.Popen(
    [r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend\venv\Scripts\python.exe", "-m", "uvicorn", "app.main:app", "--port", "8010"],
    cwd=r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(5)

try:
    response = httpx.get("http://127.0.0.1:8010/api/v1/bank-transactions/case/38/financial-analysis?file_ids=194,195", timeout=15)
    print("STATUS:", response.status_code)
except Exception as e:
    print("HTTPX ERROR:", e)

process.terminate()
stdout, stderr = process.communicate()
print("STDOUT:", stdout.decode(errors='replace'))
print("STDERR:", stderr.decode(errors='replace'))
