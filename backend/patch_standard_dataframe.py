import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\mapping\standard_dataframe.py')
content = file_path.read_text(encoding='utf-8')

# We need to remove "balance" from required_columns and add the calculation block.

old_req = '''    required_columns = [
        "transaction_date",
        "description",
        "balance"
    ]'''

new_req = '''    required_columns = [
        "transaction_date",
        "description"
    ]'''

if old_req in content:
    content = content.replace(old_req, new_req)
    print("Replaced required_columns")
else:
    print("Could not find required_columns block")

# Find where missing columns are checked
old_missing = '''    # Check for missing strictly required columns
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required standard columns: {missing_cols}")
        
    if "debit" not in df.columns and "credit" not in df.columns:
        raise ValueError("Missing required standard columns: Must have at least 'debit' or 'credit' column.")
        
    # Do not modify in-place
    new_df = df.copy()'''

new_missing = '''    # Check for missing strictly required columns
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required standard columns: {missing_cols}")
        
    if "debit" not in df.columns and "credit" not in df.columns:
        raise ValueError("Missing required standard columns: Must have at least 'debit' or 'credit' column.")
        
    # Do not modify in-place
    new_df = df.copy()
    
    # Balance Calculation Logic
    from app.processing.validation.transaction_validator import normalize_financial_value
    
    print("BALANCE CALCULATION")
    print("-" * 19)
    if "balance" in new_df.columns:
        print("Balance source: PROVIDED")
    else:
        print("Balance source: CALCULATED_FROM_DEBIT_CREDIT")
        print("Starting balance: 0")
        print(f"Transaction rows: {len(new_df)}\n")
        
        running_balance = 0.0
        balances = []
        sample_printed = 0
        
        print("First 5 calculated balances:")
        for idx, row in new_df.iterrows():
            d_raw = row.get("debit") if "debit" in new_df.columns else None
            c_raw = row.get("credit") if "credit" in new_df.columns else None
            
            d_norm = normalize_financial_value(d_raw)
            c_norm = normalize_financial_value(c_raw)
            
            d = d_norm if isinstance(d_norm, (int, float)) else 0.0
            c = c_norm if isinstance(c_norm, (int, float)) else 0.0
            
            running_balance = running_balance + c - d
            balances.append(round(running_balance, 2))
            
            if sample_printed < 5:
                print(f"Row {sample_printed+1}: Debit {d}, Credit {c} -> Balance {round(running_balance, 2)}")
                sample_printed += 1
                
        print()
        new_df["balance"] = balances'''

if old_missing in content:
    content = content.replace(old_missing, new_missing)
    print("Injected balance calculation logic")
else:
    print("Could not find missing block")

file_path.write_text(content, encoding='utf-8')
