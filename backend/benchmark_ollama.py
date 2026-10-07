import os
import sys
import pandas as pd
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

from app.services.ollama_counterparty_service import extract_counterparties_batch

def benchmark_ollama():
    # Use 3 unique descriptions to test deduplication and batching properly
    descriptions = [
        "RTGS/CBINR1202410010036598/M/S TRIDENT DRUGS/CENTRAL BANK OF INDIA",
        "UPI/P2M/194098501628/Rehman Fruits 2/Paymen/YES BANK LIMITED YBS",
        "ATM CASH WITHDRAWAL" # this should be instant due to pre-filtering
    ]
    
    sizes = [1, 10, 50, 100, 1000]
    
    for size in sizes:
        data = []
        for i in range(size):
            desc = descriptions[i % len(descriptions)]
            data.append({"description": desc, "mode": desc.split("/")[0] if "/" in desc else "UNKNOWN"})
            
        df = pd.DataFrame(data)
        
        print(f"\n--- BENCHMARK: {size} TRANSACTIONS ---")
        start_time = time.time()
        results = extract_counterparties_batch(df)
        elapsed = time.time() - start_time
        
        found = sum(1 for r in results.values() if r.get('counterparty_status') == 'FOUND')
        not_found = size - found
        
        print(f"\nResults for {size} transactions:")
        print(f"Total processing time: {elapsed:.2f}s")
        print(f"Average time per transaction: {elapsed/size:.4f}s")
        print(f"Successful results (FOUND): {found}")
        print(f"NULL results (NOT_FOUND): {not_found}")
        print("-" * 50)
            
if __name__ == "__main__":
    benchmark_ollama()
