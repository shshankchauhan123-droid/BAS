import sys
import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn
import threading
import time

app = FastAPI()

@app.get("/test")
def test():
    return {"val": float('nan')}

def run():
    uvicorn.run(app, host="127.0.0.1", port=8006, log_level="error")

t = threading.Thread(target=run, daemon=True)
t.start()
time.sleep(2)

try:
    response = httpx.get("http://127.0.0.1:8006/test")
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
except Exception as e:
    print("ERROR:", e)
