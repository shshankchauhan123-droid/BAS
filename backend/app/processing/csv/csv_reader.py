import csv
import pandas as pd
from typing import List
from pathlib import Path

def load_csv_dataframe(file_path: str) -> pd.DataFrame:
    """
    Robustly reads a CSV file into a pandas DataFrame.
    Handles encoding issues, detects delimiters, and recovers malformed rows.
    """
    encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin1']
    
    sample = ""
    used_encoding = "utf-8"
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                sample = f.read(8192)
                used_encoding = enc
                break
        except UnicodeDecodeError:
            continue
            
    try:
        # csv.Sniffer can sometimes fail or guess wrong if the sample is tricky.
        dialect = csv.Sniffer().sniff(sample, delimiters=[',', ';', '\t', '|'])
        delimiter = dialect.delimiter
    except Exception:
        # Safe fallback based on counts
        counts = {d: sample.count(d) for d in [',', ';', '\t', '|']}
        delimiter = max(counts, key=counts.get) if any(counts.values()) else ','
            
    print(f"\n========== CSV INGESTION ==========")
    print(f"File: {Path(file_path).name}")
    print(f"Encoding: {used_encoding}")
    print(f"Delimiter: {repr(delimiter)}")
    
    rows = []
    malformed_rows = 0
    
    with open(file_path, 'r', encoding=used_encoding, errors='replace') as f:
        reader = csv.reader(f, delimiter=delimiter)
        for row in reader:
            # Skip completely empty rows
            if not row or not any(str(cell).strip() for cell in row):
                continue
            rows.append(row)
            
    print(f"Raw line count (non-empty): {len(rows)}")
    
    if not rows:
        raise ValueError("CSV is empty or could not be read.")
        
    # Determine the expected maximum number of columns across all rows to prevent dropping anything
    max_cols = max(len(r) for r in rows)
    print(f"Detected max columns: {max_cols}")
    
    # Pad all rows to max_cols so pandas forms a clean DataFrame without erroring on uneven rows
    padded_rows = []
    for r in rows:
        if len(r) < max_cols:
            padded_rows.append(r + [''] * (max_cols - len(r)))
            if len(r) != max_cols and max_cols > 1: # only warn if we expected more
                 malformed_rows += 1
        else:
            padded_rows.append(r)
            
    if len(padded_rows) > 0:
        # Deduplicate and handle empty columns
        raw_cols = [str(col) if str(col).strip() else f"Unnamed_{i}" for i, col in enumerate(padded_rows[0])]
        seen = {}
        columns = []
        for c in raw_cols:
            if c in seen:
                seen[c] += 1
                columns.append(f"{c}.{seen[c]}")
            else:
                seen[c] = 0
                columns.append(c)
                
        if len(padded_rows) > 1:
            df = pd.DataFrame(padded_rows[1:], columns=columns)
        else:
            df = pd.DataFrame([], columns=columns)
    else:
        df = pd.DataFrame()
        
    print(f"Parsed rows: {len(df)}")
    print(f"Malformed/padded rows: {malformed_rows}")
    print(f"DataFrame shape: {df.shape}")
    print("====================================\n")
    
    if df.shape[1] <= 1 and len(df) > 1:
        print(f"WARNING: CSV appears to contain a single column. Possible delimiter detection failure.")
        
    return df
