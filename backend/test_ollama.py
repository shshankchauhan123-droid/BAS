import os
import sys
import pandas as pd
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

from app.services.ollama_counterparty_service import extract_counterparties_batch

def test_ollama():
    examples = [
        "RTGS/CBINR1202410010036598/M/S TRIDENT DRUGS/CENTRAL BANK OF INDIA",
        "INB/RTGS/UTIBR62024100275836915/Giriwar marketin/PUNJAB NATIONAL BANK",
        "INB/IFT/Vishalfreight/TPARTY TRANSFER",
        "INB/IFT/Brand hub/TPARTY TRANSFER",
        "UPI/P2M/194098501628/Rehman Fruits 2/Paymen/YES BANK LIMITED YBS",
        "UPI/P2A/663766766141/ANSHUMAN/PUNB/UPI/",
        "IMPS/P2A/123456789012/GAURI GANESH PHARMA/",
        "NEFT/RAHUL SHARMA/TRANSFER",
        "ATM CASH WITHDRAWAL",
        "CASH DEPOSIT",
        "CHEQUE DEPOSIT",
        "UNKNOWN/SOME RANDOM STRING"
    ]
    
    # Create DataFrame to simulate pipeline
    df = pd.DataFrame([{"description": desc, "mode": desc.split("/")[0] if "/" in desc else "UNKNOWN"} for desc in examples])
    
    start_time = time.time()
    results = extract_counterparties_batch(df)
    elapsed = time.time() - start_time
    
    print("\n" + "="*50)
    print(f"OLLAMA BATCH EXTRACTION COMPLETE IN {elapsed:.2f}s")
    print("="*50)
    
    for idx, row in df.iterrows():
        desc = row["description"]
        res = results[idx]
        print(f"DESC: {desc}")
        print(f"NAME: {res.get('counterparty_name')} (Type: {res.get('counterparty_type')}) [Source: {res.get('counterparty_source')}]")
        print("-" * 50)
        
if __name__ == "__main__":
    test_ollama()
