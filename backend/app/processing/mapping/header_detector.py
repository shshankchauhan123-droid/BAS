from __future__ import annotations

import re

import pandas as pd


# ============================================================
# INTERNAL / METADATA COLUMNS
# ============================================================

IGNORED_COLUMNS = {
    "__source_page",
    "__source_table",
}


# ============================================================
# HEADER CLEANING
# ============================================================

def clean_header(header) -> str:
    """
    Clean one DataFrame column name.

    This function does NOT decide what the column means.

    Example:

        " Transaction Date " -> "Transaction Date"
        "  Withdrawal  "     -> "Withdrawal"
        "Narration\n"        -> "Narration"
    """

    if header is None:
        return ""

    header = str(header)

    # Replace newlines/tabs/multiple spaces
    header = " ".join(header.split())

    # Remove leading/trailing spaces
    header = header.strip()

    return header


# ============================================================
# HEADER KEY
# ============================================================

def create_header_key(header: str) -> str:
    """
    Create a normalized comparison key for a header.

    This is only for comparison.

    Example:

        "Transaction Date" -> "transaction_date"
        "TRANSACTION DATE" -> "transaction_date"
        "Transaction-Date" -> "transaction_date"
        "Transaction_Date" -> "transaction_date"
    """

    header = clean_header(header)

    header = header.lower()

    # Replace non-alphanumeric characters with spaces
    header = re.sub(
        r"[^a-z0-9]+",
        " ",
        header,
    )

    # Remove repeated spaces
    header = " ".join(header.split())

    # Convert spaces to underscore
    header = header.replace(
        " ",
        "_",
    )

    return header


# ============================================================
# DETECT DATAFRAME HEADERS
# ============================================================

def detect_headers(
    df: pd.DataFrame,
) -> list[str]:
    """
    Detect the column headers available in a DataFrame.

    This function only reads the DataFrame structure.

    It does NOT:
    - map Debit/Credit
    - detect transactions
    - validate data
    - use coordinates
    - access the database
    """

    if df is None:
        raise ValueError(
            "DataFrame cannot be None."
        )

    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "Expected a pandas DataFrame."
        )

    if df.empty and len(df.columns) == 0:
        return []

    detected_headers = []

    for column in df.columns:

        column = clean_header(column)

        if not column:
            continue

        if column in IGNORED_COLUMNS:
            continue

        detected_headers.append(column)

    return detected_headers


# ============================================================
# HEADER INFORMATION
# ============================================================

def inspect_headers(
    df: pd.DataFrame,
) -> list[dict]:
    """
    Return detailed information about each detected header.

    Example output:

        [
            {
                "original": "Date",
                "cleaned": "Date",
                "key": "date",
            },
            {
                "original": "Withdrawal",
                "cleaned": "Withdrawal",
                "key": "withdrawal",
            },
        ]
    """

    if df is None:
        raise ValueError(
            "DataFrame cannot be None."
        )

    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "Expected a pandas DataFrame."
        )

    results = []

    for column in df.columns:

        original = str(column)

        cleaned = clean_header(
            column
        )

        if not cleaned:
            continue

        if cleaned in IGNORED_COLUMNS:
            continue

        key = create_header_key(
            cleaned
        )

        results.append(
            {
                "original": original,
                "cleaned": cleaned,
                "key": key,
            }
        )

    return results


# ============================================================
# PRINT HEADER INFORMATION
# ============================================================

def print_headers(
    df: pd.DataFrame,
) -> None:
    """
    Print detected DataFrame headers.

    Used mainly for development/debugging.
    """

    headers = inspect_headers(df)

    print("\n" + "=" * 70)
    print("HEADER DETECTION")
    print("=" * 70)

    if not headers:

        print("No headers detected.")

        return

    print(
        f"HEADERS FOUND: {len(headers)}"
    )

    print()

    for index, header in enumerate(
        headers,
        start=1,
    ):

        print(
            f"{index}. "
            f"Original: {header['original']}"
        )

        print(
            f"   Cleaned: {header['cleaned']}"
        )

        print(
            f"   Key:     {header['key']}"
        )


# ============================================================
# DETECT HEADER ROW
# ============================================================

def detect_header_row(df: pd.DataFrame) -> dict:
    """
    Inspects a raw DataFrame to detect the header row of the transaction table.
    Looks for keywords like Date, Chq, Particulars, Debit, Credit, Balance.
    """
    if df is None or df.empty:
        raise ValueError("DataFrame is empty or None.")

    expected_keywords = [
        "date", 
        "chq", 
        "cheque", 
        "particulars", 
        "narration", 
        "description", 
        "debit", 
        "withdrawal", 
        "credit", 
        "deposit", 
        "balance",
        "dr",
        "cr",
        "bal"
    ]
    
    # We only check up to the first 50 rows to find the header
    max_rows_to_check = min(50, len(df))
    
    best_row_index = -1
    best_match_count = 0
    best_matched_columns = []
    
    # We also check the columns themselves (row -1 conceptually)
    # just in case pandas parsed them correctly.
    # But usually, they are in the rows.
    
    # First, let's check columns
    col_match_count = 0
    col_matched_columns = []
    for col in df.columns:
        val_str = str(col).lower().replace('\n', ' ').strip()
        val_words = val_str.split()
        for keyword in expected_keywords:
            if keyword in ["dr", "cr", "bal"]:
                if keyword in val_words:
                    col_match_count += 1
                    col_matched_columns.append(str(col).strip())
                    break
            else:
                if keyword in val_str:
                    col_match_count += 1
                    col_matched_columns.append(str(col).strip())
                    break
                
    if col_match_count >= 3:
        best_match_count = col_match_count
        best_row_index = "columns"  # Special identifier if it's in columns
        best_matched_columns = col_matched_columns

    # Now check rows
    for i in range(max_rows_to_check):
        row_values = df.iloc[i].values
        
        match_count = 0
        matched_columns = []
        
        for val in row_values:
            if pd.isna(val):
                continue
                
            val_str = str(val).lower().replace('\n', ' ').strip()
            val_words = val_str.split()
            
            # Check if this cell matches any of our expected concepts
            for keyword in expected_keywords:
                if keyword in ["dr", "cr", "bal"]:
                    if keyword in val_words:
                        match_count += 1
                        matched_columns.append(str(val).strip())
                        break
                else:
                    if keyword in val_str:
                        match_count += 1
                        matched_columns.append(str(val).strip())
                        break
        
        if match_count > best_match_count:
            best_match_count = match_count
            best_row_index = i
            best_matched_columns = matched_columns
            
    # We require at least 3 matching concepts to confidently call it a header
    if best_match_count >= 3:
        confidence = "high" if best_match_count >= 4 else "medium"
        return {
            "header_row_index": best_row_index,
            "matched_columns": best_matched_columns,
            "confidence": confidence
        }
        
    raise ValueError("Failed to detect a valid transaction table header in the document.")