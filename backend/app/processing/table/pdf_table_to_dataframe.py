from pathlib import Path

import pandas as pd
import pdfplumber


# ============================================================
# CELL CLEANING
# ============================================================

def _clean_cell(value):
    """
    Clean a single extracted PDF table cell.

    Responsibilities:
    - Convert values to strings
    - Remove extra whitespace
    - Convert empty values to None
    """

    if value is None:
        return None

    value = str(value)

    # Replace repeated whitespace/newlines with one space
    value = " ".join(value.split())

    value = value.strip()

    return value if value else None


# ============================================================
# DATAFRAME CLEANING
# ============================================================

def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean an extracted DataFrame.

    This function does NOT:
    - map bank columns
    - detect debit/credit
    - validate transactions
    - use coordinates
    - modify transaction values

    It only performs basic table cleanup.
    """

    if df.empty:
        return df

    # Clean every cell
    df = df.map(_clean_cell)

    # Remove completely empty rows
    df = df.dropna(how="all")

    # Remove completely empty columns
    df = df.dropna(axis=1, how="all")

    # Reset row numbering
    df = df.reset_index(drop=True)

    return df


# ============================================================
# TABLE → DATAFRAME
# ============================================================

def _build_dataframe(table) -> pd.DataFrame:
    """
    Convert one extracted PDF table into a Pandas DataFrame.

    The first row is treated as the table header.

    Example:

        [
            ["Date", "Debit", "Credit", "Balance"],
            ["01-01-2025", "500", None, "9500"],
            ["02-01-2025", None, "1000", "10500"],
        ]

    becomes:

        Date         Debit   Credit   Balance
        01-01-2025   500     None      9500
        02-01-2025   None    1000      10500
    """

    if not table:
        return pd.DataFrame()

    # --------------------------------------------------------
    # Clean every cell in the extracted table
    # --------------------------------------------------------

    cleaned_table = []

    for row in table:
        cleaned_row = [_clean_cell(cell) for cell in row]
        cleaned_table.append(cleaned_row)

    if not cleaned_table:
        return pd.DataFrame()

    # --------------------------------------------------------
    # First row = headers
    # --------------------------------------------------------

    headers = cleaned_table[0]

    data = cleaned_table[1:]

    # --------------------------------------------------------
    # Make sure every row has the same number of columns
    # --------------------------------------------------------

    column_count = len(headers)

    normalized_data = []

    for row in data:

        row = list(row)

        # If row has fewer cells than headers,
        # fill missing cells with None.
        if len(row) < column_count:
            row.extend(
                [None] * (column_count - len(row))
            )

        # If row has more cells than headers,
        # ignore extra cells for now.
        elif len(row) > column_count:
            row = row[:column_count]

        normalized_data.append(row)

    # --------------------------------------------------------
    # Create safe column names
    # --------------------------------------------------------

    final_headers = []

    for index, header in enumerate(headers):

        if header:
            final_headers.append(header)

        else:
            final_headers.append(
                f"Unnamed_{index}"
            )

    # --------------------------------------------------------
    # Create DataFrame
    # --------------------------------------------------------

    df = pd.DataFrame(
        normalized_data,
        columns=final_headers,
    )

    # --------------------------------------------------------
    # Basic cleanup
    # --------------------------------------------------------

    df = _clean_dataframe(df)

    return df


# ============================================================
# EXTRACT ALL TABLES FROM PDF
# ============================================================

def extract_pdf_tables(
    file_path: str,
) -> list[pd.DataFrame]:
    """
    Extract all tables from a PDF.

    Output:
        List of Pandas DataFrames.

    Important:
        This function does NOT contain custom coordinate
        logic.

        The PDF table extraction library is responsible
        for detecting the table structure.
    """

    # --------------------------------------------------------
    # Validate file path
    # --------------------------------------------------------

    pdf_path = Path(file_path)

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"PDF file not found: {file_path}"
        )

    if not pdf_path.is_file():
        raise ValueError(
            f"Path is not a file: {file_path}"
        )

    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(
            "Only PDF files are supported."
        )

    # --------------------------------------------------------
    # Store extracted DataFrames
    # --------------------------------------------------------

    dataframes = []

    # --------------------------------------------------------
    # Open PDF
    # --------------------------------------------------------

    with pdfplumber.open(pdf_path) as pdf:

        print("=" * 70)
        print("PDF TABLE EXTRACTION")
        print("=" * 70)

        print(f"FILE: {pdf_path.name}")
        print(f"PAGES: {len(pdf.pages)}")

        print("=" * 70)

        # ----------------------------------------------------
        # Process every page
        # ----------------------------------------------------

        for page_number, page in enumerate(
            pdf.pages,
            start=1,
        ):

            print(
                f"\nProcessing page {page_number}..."
            )

            # ------------------------------------------------
            # Extract tables
            # ------------------------------------------------

            tables = page.extract_tables()

            if not tables:

                print(
                    "  No table detected."
                )

                continue

            print(
                f"  Tables detected: {len(tables)}"
            )

            # ------------------------------------------------
            # Process every table on this page
            # ------------------------------------------------

            for table_index, table in enumerate(
                tables,
                start=1,
            ):

                df = _build_dataframe(table)

                # --------------------------------------------
                # Ignore empty tables
                # --------------------------------------------

                if df.empty:

                    print(
                        f"  Table {table_index}: empty"
                    )

                    continue

                # --------------------------------------------
                # Print table information
                # --------------------------------------------

                print(
                    f"  Table {table_index}: "
                    f"{len(df)} rows x "
                    f"{len(df.columns)} columns"
                )

                print("  Columns:")

                for column in df.columns:

                    print(
                        f"    - {column}"
                    )

                # --------------------------------------------
                # Add extraction metadata
                # --------------------------------------------

                df.insert(
                    0,
                    "__source_page",
                    page_number,
                )

                df.insert(
                    1,
                    "__source_table",
                    table_index,
                )

                # --------------------------------------------
                # Store DataFrame
                # --------------------------------------------

                dataframes.append(df)

    # ========================================================
    # EXTRACTION SUMMARY
    # ========================================================

    print("\n" + "=" * 70)
    print("PDF TABLE EXTRACTION COMPLETED")
    print(
        f"TABLES FOUND: {len(dataframes)}"
    )
    print("=" * 70)

    return dataframes


# ============================================================
# COMBINE ALL TABLES INTO ONE DATAFRAME
# ============================================================

def extract_pdf_dataframe(
    file_path: str,
) -> pd.DataFrame:
    """
    Extract all PDF tables and combine them into
    one Pandas DataFrame.

    This is the main function that the next processing
    stages will use.
    """

    tables = extract_pdf_tables(file_path)

    # --------------------------------------------------------
    # No tables found
    # --------------------------------------------------------

    if not tables:

        return pd.DataFrame()

    # --------------------------------------------------------
    # Combine all tables
    # --------------------------------------------------------

    combined = pd.concat(
        tables,
        ignore_index=True,
        sort=False,
    )

    # --------------------------------------------------------
    # Final basic cleanup
    # --------------------------------------------------------

    combined = _clean_dataframe(
        combined
    )

    return combined


# ============================================================
# EXPORT DATAFRAME TO CSV
# ============================================================

def save_dataframe_to_csv(
    df: pd.DataFrame,
    output_path: str,
) -> None:
    """
    Save the extracted DataFrame as CSV.

    CSV is mainly useful for:
    - debugging
    - checking extraction
    - manually inspecting data
    - development/testing

    The main application will work with the DataFrame
    directly rather than requiring a physical CSV file.
    """

    output_file = Path(output_path)

    output_file.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        output_file,
        index=False,
        encoding="utf-8-sig",
    )

    print(
        f"\nCSV SAVED: {output_file}"
    )


# ============================================================
# COMMAND LINE TEST
# ============================================================

if __name__ == "__main__":

    import sys

    # --------------------------------------------------------
    # Check command arguments
    # --------------------------------------------------------

    if len(sys.argv) != 2:

        print("Usage:")

        print(
            "python -m "
            "app.processing.table."
            "pdf_table_to_dataframe "
            "<pdf_path>"
        )

        raise SystemExit(1)

    # --------------------------------------------------------
    # PDF path
    # --------------------------------------------------------

    pdf_path = sys.argv[1]

    # --------------------------------------------------------
    # Extract DataFrame
    # --------------------------------------------------------

    df = extract_pdf_dataframe(
        pdf_path
    )

    # ========================================================
    # FINAL RESULT
    # ========================================================

    print("\n" + "=" * 70)
    print("FINAL DATAFRAME")
    print("=" * 70)

    if df.empty:

        print(
            "No table data extracted."
        )

    else:

        print(
            f"ROWS: {len(df)}"
        )

        print(
            f"COLUMNS: {len(df.columns)}"
        )

        # ----------------------------------------------------
        # Column names
        # ----------------------------------------------------

        print("\nCOLUMN NAMES:")

        for column in df.columns:

            print(
                f"  - {column}"
            )

        # ----------------------------------------------------
        # First 10 rows
        # ----------------------------------------------------

        print("\nFIRST 10 ROWS:")

        print(
            df.head(10).to_string(
                index=False
            )
        )

        # ----------------------------------------------------
        # Save CSV for inspection
        # ----------------------------------------------------

        csv_path = (
            Path(pdf_path).with_suffix(
                ".extracted.csv"
            )
        )

        save_dataframe_to_csv(
            df,
            str(csv_path),
        )

        print(
            "\n" + "=" * 70
        )