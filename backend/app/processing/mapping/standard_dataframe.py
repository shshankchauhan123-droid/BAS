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
        "description",
        "balance"
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
