import pandas as pd

def create_standard_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    print("=" * 60)
    print("STAGE 6 - STANDARD DATAFRAME")
    print("=" * 60)
    print()
    
    print("STAGE 6 INPUT COLUMNS:")
    print(list(df.columns))
    print()
    
    standard_columns = [
        "transaction_date",
        "description",
        "cheque_number",
        "debit",
        "credit",
        "balance",
        "mode",
        "account_number",
        "account_name"
    ]
    
    required_columns = [
        "transaction_date",
        "description"
    ]
    
    print("STANDARD COLUMNS:")
    import json
    print(json.dumps(standard_columns, indent=4))
    print()
    
    # Check for missing strictly required columns
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
        
        # We must calculate the running balance in chronological order (Date ASC, Original Index ASC).
        # This accurately maps to how the transactions will be ordered by the database and frontend.
        # We simulate the calculation order to ensure we process old transactions before new transactions,
        # without mutating the actual row order of the dataframe.
        
        calc_order = []
        for i in range(len(new_df)):
            date_val = None
            if "transaction_date" in new_df.columns:
                date_val = new_df["transaction_date"].iloc[i]
                
            try:
                if pd.notna(date_val):
                    dt = pd.to_datetime(date_val, dayfirst=True).normalize()
                else:
                    dt = pd.Timestamp.min
            except:
                dt = pd.Timestamp.min
                
            calc_order.append((dt, i))
            
        # Sort by date ASC, then original row index ASC
        calc_order.sort(key=lambda x: (x[0], x[1]))
        
        running_balance = 0.0
        balances = [0.0] * len(new_df)
        sample_printed = 0
        
        print("First 15 calculated balances:")
        for dt, i in calc_order:
            row = new_df.iloc[i]
            d_raw = row.get("debit") if "debit" in new_df.columns else None
            c_raw = row.get("credit") if "credit" in new_df.columns else None
            
            d_norm = normalize_financial_value(d_raw)
            c_norm = normalize_financial_value(c_raw)
            
            d = d_norm if isinstance(d_norm, (int, float)) else 0.0
            c = c_norm if isinstance(c_norm, (int, float)) else 0.0
            
            running_balance = running_balance + c - d
            balances[i] = round(running_balance, 2)
            
            if sample_printed < 15:
                # Use a safe date string for printing
                date_str = str(dt.date()) if isinstance(dt, pd.Timestamp) else str(dt)
                print(f"Row {sample_printed+1}: Date {date_str}, Debit {d}, Credit {c} -> Balance {round(running_balance, 2)}")
                sample_printed += 1
                
        print()
        new_df["balance"] = balances
    
    # Add optional columns if missing
    if "mode" not in new_df.columns:
        new_df["mode"] = None
        
    import re
    known_modes = ["UPI", "NEFT", "RTGS", "IMPS", "ATM", "CASH", "CHEQUE", "POS", "NACH", "ECS"]
    
    def extract_mode_from_desc(row):
        current = row.get("mode")
        if pd.isna(current) or not current:
            desc = str(row.get("description", ""))
            if desc and str(desc) != "nan":
                # Strict match first
                for m in known_modes:
                    if re.search(r'\b' + re.escape(m) + r'\b', desc, re.IGNORECASE):
                        return m
                # Prefix match (ignoring POS to avoid POSTING collisions)
                for m in known_modes:
                    if m.upper() != "POS":
                        if re.search(r'\b' + re.escape(m), desc, re.IGNORECASE):
                            return m
        return current
        
    new_df["mode"] = new_df.apply(extract_mode_from_desc, axis=1)
        
    if "cheque_number" not in new_df.columns:
        new_df["cheque_number"] = None
        
    if "account_number" not in new_df.columns:
        new_df["account_number"] = None
        
    if "account_name" not in new_df.columns:
        new_df["account_name"] = None
        
    if "debit" not in new_df.columns:
        new_df["debit"] = None
        
    if "credit" not in new_df.columns:
        new_df["credit"] = None
        
    # Identify removed columns
    removed_cols = [col for col in new_df.columns if col not in standard_columns]
    
    print("REMOVED COLUMNS:")
    print(removed_cols)
    print()
    
    # Keep only standard columns in the correct order
    new_df = new_df[standard_columns]
    
    print("STANDARD DATAFRAME CREATED\n")
    print(f"Rows: {len(new_df)}")
    print(f"Columns: {len(new_df.columns)}\n")
    
    print("FINAL COLUMNS:")
    print(json.dumps(list(new_df.columns), indent=4))
    print()
    print("=" * 60)
    print()
    
    return new_df
