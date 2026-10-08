import subprocess
import time
import httpx

# Start the server in the background
process = subprocess.Popen(
    [r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend\venv\Scripts\python.exe", "-m", "uvicorn", "app.main:app", "--port", "8005"],
    cwd=r"C:\final bas\BAS_YASH_2_ZIP\BAS\backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

time.sleep(5)  # Wait for it to start

try:
    response = httpx.get("http://127.0.0.1:8005/api/v1/bank-transactions/case/38/counterparty-analysis?file_ids=194", timeout=5)
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
except Exception as e:
    print("HTTPX ERROR:", e)

# Stop the server
process.terminate()
stdout, stderr = process.communicate()
print("STDOUT:", stdout.decode(errors='replace'))
print("STDERR:", stderr.decode(errors='replace'))
