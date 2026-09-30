import os
import pandas as pd

def read_raw_excel(file_id: int, excel_path: str) -> pd.DataFrame:
    """
    Reads the raw Excel file into a pandas DataFrame and prints Stage 2 logs.
    """
    print("============================================================")
    print("STAGE 2 - RAW EXCEL READING")
    print("============================================================")
    
    if not excel_path:
        raise ValueError(f"Raw Excel path is not available for file ID: {file_id}")
        
    print("\nReading raw Excel...\n")
    print(f"Input:\n{excel_path}\n")
    
    exists = os.path.exists(excel_path)
    
    if not exists:
        raise FileNotFoundError(f"Raw Excel file not found at path: {excel_path}")
        
    df = pd.read_excel(excel_path)
    
    print(f"Rows read: {len(df)}")
    print(f"Columns read: {len(df.columns)}\n")
    
    print("Preview:")
    print(df.head(10).to_string())
    
    print("\nSTAGE 2 SUCCESS\n")
    
    return df
