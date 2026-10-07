import json
import logging
import pandas as pd
from dotenv import load_dotenv
load_dotenv()
from app.services.counterparty_service import extract_counterparties_batch

logging.basicConfig(level=logging.INFO)

def test_gliner_extraction():
    test_cases = [
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
        "CHEQUE DEPOSIT"
    ]
    
    # Create DataFrame to match expected input
    df = pd.DataFrame([{"description": desc} for desc in test_cases])
    
    print("\nStarting GLiNER extraction test...\n")
    final_mapping = extract_counterparties_batch(df)
    
    for i, desc in enumerate(test_cases):
        print("=" * 80)
        print(f"DESCRIPTION: {desc}")
        
        # The entities and rejected entities are printed during extract_counterparties_batch
        
        result = final_mapping.get(i, {})
        
        counterparty_name = result.get("counterparty_name")
        print(f"SELECTED COUNTERPARTY: {counterparty_name if counterparty_name else 'NULL'}")
        
        c_type = result.get("counterparty_type")
        print(f"TYPE: {c_type if c_type else 'NULL'}")
        
        c_conf = result.get("counterparty_confidence")
        print(f"CONFIDENCE: {c_conf if c_conf else 'NULL'}")
        
        c_source = result.get("counterparty_source")
        print(f"SOURCE: {c_source if c_source else 'NULL'}")
        
        c_status = result.get("counterparty_status")
        print(f"STATUS: {c_status if c_status else 'NULL'}")
        print()

if __name__ == "__main__":
    test_gliner_extraction()
