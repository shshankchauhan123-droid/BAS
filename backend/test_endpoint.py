import httpx
import json

response = httpx.get("http://127.0.0.1:8000/api/v1/bank-transactions/case/38/counterparty-analysis?file_ids=194,195,196", headers={"Authorization": "Bearer fake_token"})
print(response.status_code)
print(response.text)
