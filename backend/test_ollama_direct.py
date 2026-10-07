import os
import json
import requests
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_single_ollama_request():
    url = "http://localhost:11434/api/chat"
    model = "qwen3.5:0.8b"
    
    transaction = {
        "id": 1,
        "mode": "UPI",
        "description": "UPI/P2A/663523656185/AMIT THA/SBIN/UPI/",
        "debit": None,
        "credit": 2500
    }
    
    prompt = """You are a bank transaction counterparty extraction engine.

For each transaction, identify the external person, organization, merchant, or financial entity that is the counterparty.

The transaction description may contain:
- transaction reference numbers
- UPI IDs
- account numbers
- bank codes
- bank names
- transaction modes
- payment words
- technical metadata
- person names
- organization names
- merchant names

Your job is to identify the actual counterparty, not the transaction reference.

NEVER select:
- UPI transaction IDs
- IMPS reference numbers
- NEFT reference numbers
- RTGS reference numbers
- account numbers
- bank codes
- IFSC-like identifiers
- transaction IDs
- Payment
- Payment/
- Paymen
- Pay to
- Collect
- P2A
- P2M
- P2V
- UPI
- IMPS
- NEFT
- RTGS
- INB
- IFT
- ATM
- CASH
- transaction metadata
- bank names when they are only the processing bank

If a real person name exists, return the person.
If a merchant or organization exists, return it.
If there is no reliable counterparty, return null.

Do not invent a name.
Do not copy the account holder name unless the description clearly indicates that it is the external counterparty.
Do not copy values from another transaction.
Each transaction must be analyzed independently.

You must return ONLY JSON.
Expected structure:
{
    "results": [
        {
            "id": 1,
            "counterparty_name": "GAURAV TH",
            "counterparty_type": "PERSON",
            "confidence": 0.95
        }
    ]
}
Allowed counterparty_type values: PERSON, ORGANIZATION, MERCHANT, BANK, FINANCIAL_INSTITUTION, OTHER, null
"""

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": json.dumps([transaction])
            }
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "top_p": 0.1
        }
    }
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, json=payload, timeout=60)
        print(f"HTTP Status: {response.status_code}")
        response.raise_for_status()
        
        data = response.json()
        print("Raw JSON response loaded successfully.")
        
        content = data.get("message", {}).get("content", "")
        print(f"Message content: {content}")
        
        parsed = json.loads(content)
        print("Successfully parsed internal JSON!")
        print(json.dumps(parsed, indent=2))
        
    except Exception as e:
        logger.exception("Failed during test request!")

if __name__ == "__main__":
    test_single_ollama_request()
