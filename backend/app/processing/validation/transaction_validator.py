import pandas as pd
import re
import numpy as np

def normalize_financial_value(val):
    if pd.isna(val):
        return None
    
    s = str(val).strip().lower()
    if not s or s in ["none", "nan"]:
        return None
        
    is_negative = False
    
    # Handle accounting negative format (1,000)
    if s.startswith('(') and s.endswith(')'):
        is_negative = True
        s = s[1:-1].strip()
        
    # Remove harmless formatting
    s = re.sub(r'[₹,]', '', s)
    s = re.sub(r'^rs\.?\s*', '', s)
    s = re.sub(r'^inr\s*', '', s)
    s = s.strip()
    
    # Sometimes we see explicit minus sign
    if s.startswith('-'):
        is_negative = True
        s = s[1:].strip()
        
    # Dr / Cr suffixes
    # Use non-word boundary tolerant regex to strip cr/dr at the exact end of string
    s = re.sub(r'(?i)\s*cr\.?\s*$', '', s).strip()
    s = re.sub(r'(?i)\s*dr\.?\s*$', '', s).strip()

    # Detect multiplier
    multiplier = 1.0
    if re.search(r'\blakhs?\b', s) or re.search(r'\blacs?\b', s):
        multiplier = 100000.0
        s = re.sub(r'\blakhs?\b|\blacs?\b', '', s).strip()
    elif re.search(r'\bcrores?\b', s) or re.search(r'\bcr\b', s):
        multiplier = 10000000.0
        s = re.sub(r'\bcrores?\b|\bcr\b', '', s).strip()
    elif s.endswith('k') and not s.endswith('ok'):
        multiplier = 1000.0
        s = s[:-1].strip()
    elif s.endswith('m'):
        multiplier = 1000000.0
        s = s[:-1].strip()
    elif s.endswith('b'):
        multiplier = 1000000000.0
        s = s[:-1].strip()
    
    # Strip any remaining Dr/Cr that weren't at the end just to be safe
    s = re.sub(r'\bcr\.?\b', '', s).strip()
    s = re.sub(r'\bdr\.?\b', '', s).strip()
    
    if not s:
        return "invalid"
        
    try:
        num = float(s)
        num = num * multiplier
        if is_negative:
            num = -num
        return round(num, 2)
    except ValueError:
        return "invalid"


def validate_transactions(df: pd.DataFrame) -> pd.DataFrame:
    print("============================================================")
    print("STAGE 7 - TRANSACTION VALIDATION")
    print("============================================================")
    print(f"\nINPUT ROWS:\n{len(df)}\n")
    print("INPUT COLUMNS:")
    print(list(df.columns))
    print()
    
    required_columns = [
        "transaction_date",
        "description",
        "cheque_number",
        "debit",
        "credit",
        "balance"
    ]
    
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required standard column for validation: {col}")
            
    vdf = df.copy()
    
    # 2. Remove completely empty rows
    all_cols = required_columns + (["mode"] if "mode" in vdf.columns else [])
    
    # Check if a row is completely empty across ALL standard fields
    def is_row_empty(row):
        for col in all_cols:
            val = row[col]
            if pd.notna(val) and str(val).strip() != "":
                return False
        return True
        
    empty_mask = vdf.apply(is_row_empty, axis=1)
    vdf = vdf[~empty_mask].copy()
    vdf.reset_index(drop=True, inplace=True)
    
    vdf["_is_valid"] = True
    vdf["_validation_errors"] = [[] for _ in range(len(vdf))]
    
    def add_error(idx, msg):
        vdf.at[idx, "_is_valid"] = False
        vdf.at[idx, "_validation_errors"].append(msg)
    
    # 3. Text cleaning
    for text_col in ["description", "cheque_number", "mode"]:
        if text_col in vdf.columns:
            vdf[text_col] = vdf[text_col].apply(lambda x: None if pd.isna(x) or str(x).strip() == "" else re.sub(r'\s+', ' ', str(x).strip()))
            
    # 4. Date validation
    print("VALIDATING TRANSACTION DATES...\n")
    dates = pd.to_datetime(vdf["transaction_date"], errors="coerce", dayfirst=True)
    for idx, (orig, parsed) in enumerate(zip(vdf["transaction_date"], dates)):
        if pd.isna(parsed) and pd.notna(orig) and str(orig).strip() != "":
            add_error(idx, "Invalid transaction_date")
        elif pd.isna(parsed):
            add_error(idx, "Missing required transaction value (date)")
            
    # 5 & 6. Financial value normalization
    print("NORMALIZING FINANCIAL VALUES...\n")
    for col in ["debit", "credit", "balance"]:
        vdf[col] = vdf[col].astype(object)
        for idx, val in enumerate(vdf[col]):
            norm = normalize_financial_value(val)
            if norm == "invalid":
                add_error(idx, f"Invalid {col} value")
                vdf.at[idx, col] = None
            else:
                vdf.at[idx, col] = norm
                
    # 8. Debit/Credit Consistency
    print("VALIDATING DEBIT/CREDIT...\n")
    for idx, row in vdf.iterrows():
        d = row["debit"]
        c = row["credit"]
        has_debit = pd.notna(d) and d != 0
        has_credit = pd.notna(c) and c != 0
        
        if has_debit and has_credit:
            add_error(idx, "Both debit and credit contain values")
        elif not has_debit and not has_credit:
            add_error(idx, "Both debit and credit are empty/null")
            
    # 9. Balance Validation
    print("VALIDATING BALANCE...\n")
    # Balance must be numeric (which is already enforced by the normalization step)
    
    valid_count = vdf["_is_valid"].sum()
    invalid_count = len(vdf) - valid_count
    
    # Tally up all validation errors
    from collections import Counter
    error_tally = Counter()
    invalid_rows_sample = []
    
    for idx, row in vdf.iterrows():
        if not row["_is_valid"]:
            for err in row["_validation_errors"]:
                error_tally[err] += 1
            if len(invalid_rows_sample) < 10:
                invalid_rows_sample.append(row)
    
    print("============================================================")
    print("STAGE 7 VALIDATION SUMMARY")
    print("============================================================")
    print(f"\nInput rows: {len(vdf)}")
    print(f"Valid rows: {valid_count}")
    print(f"Invalid rows: {invalid_count}\n")
    
    print("Validation errors:")
    if not error_tally:
        print("  None")
    else:
        for err, count in error_tally.most_common():
            print(f"  {err}: {count}")
    print()
    
    if invalid_rows_sample:
        print("Sample invalid rows (max 10):")
        for r in invalid_rows_sample:
            print(f"  row={r.name}")
            print(f"    date={r.get('transaction_date')}")
            print(f"    description={r.get('description')}")
            print(f"    debit={r.get('debit')}")
            print(f"    credit={r.get('credit')}")
            print(f"    balance={r.get('balance')}")
            print(f"    errors={r.get('_validation_errors')}")
            print("")
    
    # Format output correctly
    final_columns = [
        "transaction_date",
        "description",
        "cheque_number",
        "debit",
        "credit",
        "balance",
        "mode",
        "_is_valid",
        "_validation_errors"
    ]
    
    # Reorder
    vdf = vdf[final_columns]
    
    print("STAGE 7 VALIDATION COMPLETED")
    print("============================================================")
    
    return vdf
