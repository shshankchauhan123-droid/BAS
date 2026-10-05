import os
import shutil
import pandas as pd
import sys

# Ensure we can import from app
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.processing.mapping.qwen_header_mapper import map_headers_with_qwen
from app.processing.mapping.standard_dataframe import create_standard_dataframe
from app.processing.validation.transaction_validator import validate_transactions

def test_pipeline():
    test_excel = "storage/test_files/test_with_metadata.xlsx"
    temp_excel = "storage/test_files/test_with_metadata_temp.xlsx"
    shutil.copy(test_excel, temp_excel)
    
    df = pd.read_excel(temp_excel)
    print("INITIAL COLUMNS:", list(df.columns))
    
    # Just grab a mock normalized headers list for the test file
    normalized_headers = ["date", "particulars", "chq", "withdrawal amt.", "deposit amt.", "balance"]
    
    # Check if the file has these columns, if not update the mock
    actual_cols = [str(c).lower().strip() for c in df.columns]
    print("ACTUAL COLS:", actual_cols)
    
    print("\n--- RUNNING MAPPING ---")
    map_headers_with_qwen(actual_cols, temp_excel, "columns")
    
    df_mapped = pd.read_excel(temp_excel)
    print("\nMAPPED COLUMNS:", list(df_mapped.columns))
    
    print("\n--- RUNNING STANDARD DATAFRAME ---")
    std_df = create_standard_dataframe(df_mapped)
    print("STANDARD DATAFRAME HEAD:")
    print(std_df.head(2).to_string())
    
    print("\n--- RUNNING VALIDATION ---")
    val_df = validate_transactions(std_df)
    
    valid_count = val_df["_is_valid"].sum()
    print(f"\nVALID ROWS: {valid_count} / {len(val_df)}")
    
    has_debits = val_df["debit"].notna().sum()
    has_credits = val_df["credit"].notna().sum()
    print(f"DEBIT ROWS: {has_debits}")
    print(f"CREDIT ROWS: {has_credits}")

if __name__ == "__main__":
    test_pipeline()
