import time
import requests
import json
import sys

def run_test(size, txs):
    url = "http://localhost:11434/api/chat"
    print(f"\n--- TESTING {size} TRANSACTIONS ---")
    payload = {
        "model": "qwen3.5:0.8b",
        "messages": [
            {
                "role": "system",
                "content": "Extract the counterparty from the transaction. Return ONLY JSON like {\"results\":[{\"id\":\"1\",\"counterparty_name\":\"HIMANSHU\",\"counterparty_type\":\"PERSON\",\"confidence\":0.9}]}"
            },
            {
                "role": "user",
                "content": json.dumps(txs)
            }
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0,
            "top_p": 0.1
        }
    }
    
    print(f"Sending request to {url}...")
    start = time.time()
    try:
        response = requests.post(url, json=payload, timeout=600)
        duration = time.time() - start
        print(f"HTTP STATUS: {response.status_code}")
        print(f"RESPONSE TIME: {duration:.2f}s")
        data = response.json()
        content = data.get("message", {}).get("content", "")
        print("PARSED MESSAGE CONTENT:")
        print(content)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    tx1 = [{"id": "1", "description": "UPI/P2A/627200590286/HIMANSHU /SBIN/UPI/"}]
    run_test(1, tx1)
    
    tx3 = tx1 + [
        {"id": "2", "description": "UPI/P2A/130248650271/GAURAV TH/UBIN/UPI/"},
        {"id": "3", "description": "UPI/P2M/409825687307/Universal Petroleum /Paymen/YES BANK LIMITED YBS"}
    ]
    run_test(3, tx3)
