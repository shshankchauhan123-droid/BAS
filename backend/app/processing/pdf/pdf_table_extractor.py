import os
import re

import camelot
import pandas as pd


def clean_cell(value):
    """
    Clean text extracted from a PDF table cell.
    """

    if value is None:
        return ""

    value = str(value)

    # Replace line breaks with spaces
    value = value.replace("\n", " ")

    # Remove multiple spaces
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def extract_tables_from_pdf(pdf_path: str) -> pd.DataFrame:
    """
    Extract all tables from a PDF using Camelot.

    Returns:
        pandas.DataFrame containing the raw extracted tables.

    This function ONLY extracts data.

    It does NOT:
        - detect headers
        - map columns
        - validate transactions
        - call Qwen
        - save to database
    """

    print("=" * 60)
    print("PDF TABLE EXTRACTION")
    print("=" * 60)

    # ------------------------------------------------------------
    # STEP 1: CHECK PDF
    # ------------------------------------------------------------

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(
            f"PDF file not found: {pdf_path}"
        )

    print(f"Input PDF: {pdf_path}")
    print()

    # ------------------------------------------------------------
    # STEP 2: EXTRACT TABLES
    # ------------------------------------------------------------

    print("Detecting tables...")

    tables = camelot.read_pdf(
        pdf_path,
        pages="all",
        flavor="lattice",
    )

    if len(tables) == 0:
        print("No tables detected with 'lattice' flavor. Falling back to 'stream' flavor...")
        tables = camelot.read_pdf(
            pdf_path,
            pages="all",
            flavor="stream",
        )

    print(f"Tables detected: {len(tables)}")
    print()

    if len(tables) == 0:
        raise ValueError(
            "No tables were detected in the PDF."
        )

    # ------------------------------------------------------------
    # STEP 3: CLEAN EACH TABLE
    # ------------------------------------------------------------

    extracted_tables = []

    for index, table in enumerate(tables, start=1):

        df = table.df.copy()

        # Clean every cell
        df = df.map(clean_cell)

        # Remove completely empty rows
        df = df[
            df.apply(
                lambda row: any(
                    str(value).strip()
                    for value in row
                ),
                axis=1,
            )
        ]

        df = df.reset_index(drop=True)

        # Keep source page information for debugging
        df["_source_page"] = table.page

        print(
            f"Table {index}: "
            f"Page={table.page}, "
            f"Rows={len(df)}, "
            f"Columns={len(df.columns) - 1}"
        )

        extracted_tables.append(df)

    # ------------------------------------------------------------
    # STEP 4: COMBINE ALL TABLES
    # ------------------------------------------------------------

    combined_df = pd.concat(
        extracted_tables,
        ignore_index=True,
    )

    print()
    print("=" * 60)
    print("EXTRACTION RESULT")
    print("=" * 60)

    print(f"Total rows: {len(combined_df)}")
    print(
        f"Total columns: "
        f"{len(combined_df.columns) - 1}"
    )

    print()
    print("RAW DATA PREVIEW:")
    print(combined_df.head(10).to_string())

    print("=" * 60)

    return combined_df