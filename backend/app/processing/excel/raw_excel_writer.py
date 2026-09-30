import pandas as pd
from pathlib import Path

def save_raw_excel(df: pd.DataFrame, output_path: str) -> str:
    """
    Saves a raw extracted pandas DataFrame to an Excel file.
    Does not modify, format, or map the data.
    """
    output_file = Path(output_path)
    
    # Ensure the parent directory exists just in case
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Write DataFrame to .xlsx
    df.to_excel(
        output_file,
        index=False,
    )
    
    return str(output_file)
