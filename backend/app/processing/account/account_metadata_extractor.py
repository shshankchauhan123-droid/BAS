from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, List, Tuple
import re

import pdfplumber


@dataclass
class AccountMetadata:
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc: Optional[str] = None
    micr: Optional[str] = None
    account_type: Optional[str] = None
    statement_start_date: Optional[date] = None
    statement_end_date: Optional[date] = None


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_line(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_text(lines: List[str]) -> List[str]:
    result = []

    for line in lines:
        line = normalize_line(line)
        if line:
            result.append(line)

    return result


def clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    value = normalize_line(value)
    value = value.strip(" :.-|")

    return value or None


# ============================================================
# GENERIC LABEL MATCHING
# ============================================================

def label_regex(labels: List[str]) -> str:
    return r"(?:" + "|".join(labels) + r")"


def find_label_value(
    lines: List[str],
    labels: List[str],
    value_regex: Optional[str] = None,
) -> Optional[str]:
    """
    Generic extraction.

    Handles both:

        Account Number: 1234567890

    and:

        Account Number:
        1234567890
    """

    label = label_regex(labels)

    for index, line in enumerate(lines):

        # ----------------------------------------------------
        # Label + value on same line
        # ----------------------------------------------------
        if value_regex:
            match = re.search(
                rf"{label}\s*[:.\-]?\s*({value_regex})",
                line,
                re.IGNORECASE,
            )

            if match:
                return clean_value(match.group(1))

        else:
            match = re.search(
                rf"{label}\s*[:.\-]?\s*(.+)$",
                line,
                re.IGNORECASE,
            )

            if match:
                value = clean_value(match.group(1))

                if value:
                    return value

        # ----------------------------------------------------
        # Label only -> value on next line
        # ----------------------------------------------------
        label_only = re.fullmatch(
            rf"{label}\s*[:.\-]?",
            line,
            re.IGNORECASE,
        )

        if label_only and index + 1 < len(lines):

            next_line = normalize_line(lines[index + 1])

            if not next_line:
                continue

            if value_regex:
                value_match = re.search(
                    rf"\b({value_regex})\b",
                    next_line,
                    re.IGNORECASE,
                )

                if value_match:
                    return clean_value(value_match.group(1))
            else:
                return clean_value(next_line)

    return None


# ============================================================
# ACCOUNT NUMBER
# ============================================================

def extract_account_number(lines: List[str]) -> Optional[str]:
    """
    Bank-independent account number extraction.

    Supports common labels:
        Account No
        Account No.
        Account Number
        A/c No
        A/C Number
        Account #
        Account ID

    Does NOT depend on a particular bank.
    """

    labels = [
        r"account\s+no\.?",
        r"account\s+number",
        r"a\s*/\s*c\s+no\.?",
        r"a\s*/\s*c\s+number",
        r"account\s*#",
        r"account\s+id",
        r"acct\.?\s+no\.?",
        r"acct\.?\s+number",
    ]

    # Most account numbers are numeric. The second pattern allows
    # alphanumeric account IDs used by some institutions.
    patterns = [
        r"\d{9,20}",
        r"[A-Z0-9]{9,20}",
    ]

    for line in lines:

        for label in labels:

            for value_pattern in patterns:

                match = re.search(
                    rf"{label}\s*[:.\-]?\s*({value_pattern})(?![A-Z0-9])",
                    line,
                    re.IGNORECASE,
                )

                if match:
                    value = match.group(1).upper()

                    if 9 <= len(value) <= 20:
                        return value

    # Label/value on separate lines.
    label_pattern = label_regex(labels)

    for index, line in enumerate(lines):

        if re.fullmatch(
            rf"{label_pattern}\s*[:.\-]?",
            line,
            re.IGNORECASE,
        ):

            if index + 1 < len(lines):

                next_line = normalize_line(lines[index + 1])

                # Prefer a numeric account number.
                numeric = re.search(r"\b\d{9,20}\b", next_line)

                if numeric:
                    return numeric.group(0)

                alpha_numeric = re.search(
                    r"\b[A-Z0-9]{9,20}\b",
                    next_line,
                    re.IGNORECASE,
                )

                if alpha_numeric:
                    return alpha_numeric.group(0).upper()

    return None


# ============================================================
# IFSC
# ============================================================

def extract_ifsc(lines: List[str]) -> Optional[str]:
    """
    Generic IFSC extraction.

    IFSC normally follows the Indian IFSC structure:
        4 letters + 0 + 6 alphanumeric characters
    """

    labels = [
        r"IFSC",
        r"IFSC\s+Code",
        r"IFSC\s+Number",
        r"IFSC\s+No\.?",
    ]

    # Search anywhere in the line first. This handles:
    # IFSC Code: ABCD0123456
    for line in lines:

        match = re.search(
            r"\b([A-Z]{4}0[A-Z0-9]{6})\b",
            line,
            re.IGNORECASE,
        )

        if match:
            return match.group(1).upper()

    # Then handle:
    # IFSC:
    # ABCD0123456
    return find_label_value(
        lines,
        labels,
        r"[A-Z]{4}0[A-Z0-9]{6}",
    )


# ============================================================
# MICR
# ============================================================

def extract_micr(lines: List[str]) -> Optional[str]:
    labels = [
        r"MICR",
        r"MICR\s+Code",
        r"MICR\s+Number",
        r"MICR\s+No\.?",
    ]

    # First search for a 9 digit MICR near the label.
    for index, line in enumerate(lines):

        if re.search(r"\bMICR\b", line, re.IGNORECASE):

            match = re.search(r"\b(\d{9})\b", line)

            if match:
                return match.group(1)

            if index + 1 < len(lines):

                match = re.search(
                    r"\b(\d{9})\b",
                    lines[index + 1],
                )

                if match:
                    return match.group(1)

    return find_label_value(
        lines,
        labels,
        r"\d{9}",
    )


# ============================================================
# ACCOUNT NAME
# ============================================================

def is_bad_name(value: str) -> bool:
    value = normalize_line(value)

    if len(value) < 2 or len(value) > 180:
        return True

    # Do not use obvious metadata as account name.
    bad = [
        r"^customer\s+id\b",
        r"^customer\s+number\b",
        r"^account\s+(no|number|type|id)\b",
        r"^a\s*/\s*c\s+(no|number)\b",
        r"^ifsc\b",
        r"^micr\b",
        r"^pan\b",
        r"^ckyc\b",
        r"^currency\b",
        r"^mobile\b",
        r"^phone\b",
        r"^email\b",
        r"^branch\b",
        r"^address\b",
        r"^statement\b",
        r"^period\b",
        r"^from\b",
        r"^to\b",
        r"^joint\s+holder\b",
        r"^nominee\b",
        r"^scheme\b",
        r"^account\s+type\b",
    ]

    for pattern in bad:
        if re.search(pattern, value, re.IGNORECASE):
            return True

    if not re.search(r"[A-Za-z]", value):
        return True

    return False


def extract_account_name(lines: List[str], disable_fallback: bool = False) -> Optional[str]:
    """
    Generic customer/account-holder name extraction.

    Supports many common labels and both same-line and next-line
    layouts.

    It does not assume a specific bank.
    """

    labels = [
        r"customer\s+name",
        r"customer\s+full\s+name",
        r"account\s+holder\s+name",
        r"account\s+holder",
        r"account\s+name",
        r"name\s+of\s+(?:the\s+)?account\s+holder",
        r"name\s+of\s+account\s+holder",
        r"name\s+of\s+customer",
        r"customer",
        r"holder\s+name",
    ]

    label = label_regex(labels)

    for index, line in enumerate(lines):

        # Same line.
        match = re.search(
            rf"{label}\s*[:.\-]\s*(.+)$",
            line,
            re.IGNORECASE,
        )

        if match:

            value = clean_value(match.group(1))

            if value and not is_bad_name(value):
                return value

        # Next line.
        if re.fullmatch(
            rf"{label}\s*[:.\-]?",
            line,
            re.IGNORECASE,
        ):

            if index + 1 < len(lines):

                value = clean_value(lines[index + 1])

                if value and not is_bad_name(value):
                    return value

    # --------------------------------------------------------
    # Generic fallback.
    #
    # Some statements have no "Customer Name" label.
    # The account-holder/company name is often one of the first
    # meaningful text lines before address/contact information.
    #
    # We only use this as a fallback after all labels fail.
    # --------------------------------------------------------
    
    if disable_fallback:
        return None

    for line in lines[:40]:

        value = normalize_line(line)

        if is_bad_name(value):
            continue

        # Skip obvious bank/header lines.
        if re.search(
            r"\b(bank|statement|branch|customer\s+id|ifsc|micr|"
            r"pan|ckyc|currency|account\s+no|account\s+number)\b",
            value,
            re.IGNORECASE,
        ):
            continue

        # Skip address-like lines.
        if re.search(
            r"\b(road|street|st\.|rd\.|lane|nagar|building|"
            r"floor|near|opposite|district|state|pin|pincode|"
            r"india|mobile|email|phone)\b",
            value,
            re.IGNORECASE,
        ):
            continue

        # A likely name should contain letters and should not be
        # an excessively long paragraph.
        if (
            re.search(r"[A-Za-z]", value)
            and len(value) <= 100
            and not re.search(r"\d{4,}", value)
        ):
            return value

    return None


# ============================================================
# BANK NAME
# ============================================================

def extract_bank_name(lines: List[str]) -> Optional[str]:
    """
    Bank-independent approach.

    First looks for explicit labels:
        Bank Name: XXXXX

    Then looks for common wording:
        Bank: XXXXX

    If no label exists, it does NOT hard-code a bank list.
    Instead it tries to identify a line containing "BANK".
    """

    explicit = find_label_value(
        lines,
        [
            r"bank\s+name",
            r"bank",
            r"banking\s+institution",
        ],
    )

    if explicit:
        # Avoid returning unrelated values.
        if len(explicit) <= 100:
            return explicit

    # Search for a line that itself contains "BANK".
    for line in lines[:40]:

        value = normalize_line(line)

        if re.search(r"\bBANK\b", value, re.IGNORECASE):

            # Do not return transaction/header text.
            if re.search(
                r"\b(statement|transaction|account\s+number|"
                r"account\s+no|branch\s+code)\b",
                value,
                re.IGNORECASE,
            ):
                continue

            if 3 <= len(value) <= 100:
                return value

    return None


# ============================================================
# BRANCH
# ============================================================

def extract_branch_name(lines: List[str]) -> Optional[str]:
    labels = [
        r"branch\s+name",
        r"branch\s+office",
        r"branch",
        r"branch\s+location",
    ]

    value = find_label_value(lines, labels)

    if value:
        # Don't return a branch code as branch name.
        if re.fullmatch(r"\d{3,10}", value):
            return None

        return value

    return None


# ============================================================
# ACCOUNT TYPE
# ============================================================

def extract_account_type(lines: List[str]) -> Optional[str]:
    labels = [
        r"account\s+type",
        r"account\s+category",
        r"account\s+class",
        r"scheme",
        r"product\s+type",
        r"product",
        r"type\s+of\s+account",
    ]

    stop_labels = (
        r"CKYC|"
        r"currency|"
        r"PAN|"
        r"customer\s+ID|"
        r"customer\s+number|"
        r"account\s+number|"
        r"account\s+no|"
        r"IFSC|"
        r"MICR"
    )

    label = label_regex(labels)

    # Same-line value.
    for line in lines:

        match = re.search(
            rf"{label}\s*[:.\-]?\s*(.+?)(?=\s+(?:{stop_labels})\b|$)",
            line,
            re.IGNORECASE,
        )

        if match:

            value = clean_value(match.group(1))

            if value and not is_bad_name(value):
                return value

    # Next-line value.
    value = find_label_value(lines, labels)

    if value:
        value = re.split(
            rf"\s+(?:{stop_labels})\b",
            value,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]

        return clean_value(value)

    return None


# ============================================================
# DATE PARSING
# ============================================================

def parse_date(value: str) -> Optional[date]:
    value = value.strip()

    formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%d.%m.%y",
        "%d %b %Y",
        "%d %B %Y",
        "%d-%b-%Y",
        "%d-%B-%Y",
        "%d/%b/%Y",
        "%d/%B/%Y",
    ]

    for fmt in formats:

        try:
            return datetime.strptime(value, fmt).date()

        except ValueError:
            continue

    return None


def extract_statement_period(
    lines: List[str],
) -> Tuple[Optional[date], Optional[date]]:

    text = " ".join(lines)
    text = normalize_line(text)

    date_pattern = (
        r"(?:"
        r"\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}"
        r"|"
        r"\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}"
        r")"
    )

    separators = r"(?:to|until|upto|up\s+to|-|–|—)"

    patterns = [
        # From 01-10-2024 To 31-03-2025
        rf"(?:from|period)\s*[:\-]?\s*"
        rf"({date_pattern})\s*"
        rf"{separators}\s*"
        rf"({date_pattern})",

        # 01-10-2024 to 31-03-2025
        rf"({date_pattern})\s*"
        rf"{separators}\s*"
        rf"({date_pattern})",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE,
        )

        if match:

            start = parse_date(match.group(1))
            end = parse_date(match.group(2))

            if start and end:
                return start, end

    return None, None


# ============================================================
# MAIN GENERIC EXTRACTION
# ============================================================

def extract_account_metadata(pdf_path: str) -> AccountMetadata:
    """
    Bank-independent account metadata extraction.

    IMPORTANT:
    This function does not decide:
        "If Axis -> use Axis extractor"
        "If PNB -> use PNB extractor"

    Instead it uses field labels and document structure.

    This makes it suitable for statements from many different
    banks and different PDF layouts.
    """

    # Five pages gives more coverage while avoiding scanning the
    # entire transaction statement.
    MAX_PAGES = 5

    all_lines: List[str] = []

    with pdfplumber.open(pdf_path) as pdf:

        page_count = min(
            len(pdf.pages),
            MAX_PAGES,
        )

        for page_index in range(page_count):

            page = pdf.pages[page_index]

            page_text = page.extract_text()

            if not page_text:
                continue

            for line in page_text.split("\n"):

                line = normalize_line(line)

                if line:
                    all_lines.append(line)

    lines = normalize_text(all_lines)

    meta = AccountMetadata()

    # --------------------------------------------------------
    # Extract every field independently.
    # One missing field must NOT prevent the other fields
    # from being extracted.
    # --------------------------------------------------------

    meta.account_number = extract_account_number(lines)

    meta.ifsc = extract_ifsc(lines)

    meta.micr = extract_micr(lines)

    meta.account_name = extract_account_name(lines)

    meta.bank_name = extract_bank_name(lines)

    meta.branch_name = extract_branch_name(lines)

    meta.account_type = extract_account_type(lines)

    (
        meta.statement_start_date,
        meta.statement_end_date,
    ) = extract_statement_period(lines)

    return meta


# ============================================================
# EXCEL / CSV ACCOUNT METADATA EXTRACTION
# ============================================================

def extract_excel_account_metadata(df) -> AccountMetadata:
    """
    Bank-independent account metadata extraction for Excel/CSV dataframes.
    Converts the top rows into text lines and reuses the robust PDF extraction logic.
    """
    import pandas as pd
    lines = []
    
    # Add columns as the first line, as headers might contain metadata
    header_line = " ".join([str(c) for c in df.columns if "Unnamed" not in str(c)])
    if header_line.strip():
        lines.append(header_line.strip())
        
    for _, row in df.head(50).iterrows():
        row_strs = []
        for val in row:
            if pd.isna(val):
                continue
            val_str = str(val).strip()
            if not val_str or val_str.lower() == "nan":
                continue
            
            # Excel floats (e.g. 1234567890.0)
            if val_str.endswith(".0") and val_str[:-2].isdigit():
                val_str = val_str[:-2]
                
            row_strs.append(val_str)
            
        if row_strs:
            lines.append(" ".join(row_strs))
            
    meta = AccountMetadata()
    
    def normalize_for_match(val):
        if pd.isna(val):
            return ""
        import re
        s = str(val).lower()
        return re.sub(r'[\s\.\-\_\:\/\\#]', '', s)
        
    def clean_excel_val(val):
        if pd.isna(val):
            return None
        val_str = str(val).strip()
        if not val_str or val_str.lower() in ["nan", "none", "null", "na"]:
            return None
        if val_str.endswith(".0") and val_str[:-2].isdigit():
            val_str = val_str[:-2]
        return val_str

    acct_num_aliases = ["accountnumber", "accountno", "accountnum", "acnumber", "acno", "accountid"]
    acct_name_aliases = ["accountname", "accountholdername", "accountholder", "customername", "acname", "nameoftheaccountholder", "nameofaccountholder", "nameofcustomer", "holdername"]
    
    def is_match(cell_val, aliases):
        norm = normalize_for_match(cell_val)
        return norm in aliases

    # PHASE 1: Check Columns (Format A)
    for col_idx, col_name in enumerate(df.columns):
        if "unnamed" in str(col_name).lower():
            continue
            
        if not meta.account_number and is_match(col_name, acct_num_aliases):
            for val in df.iloc[:, col_idx]:
                c_val = clean_excel_val(val)
                if c_val and c_val.upper() != "COUNTERPARTY" and len(c_val) > 4:
                    meta.account_number = c_val
                    break
                    
        if not meta.account_name and is_match(col_name, acct_name_aliases):
            for val in df.iloc[:, col_idx]:
                c_val = clean_excel_val(val)
                if c_val and not is_bad_name(c_val) and c_val.upper() != "COUNTERPARTY":
                    meta.account_name = c_val
                    break

    # PHASE 2: Check Cells (Format B)
    if not meta.account_number or not meta.account_name:
        search_df = df.head(50)
        for r_idx in range(len(search_df)):
            for c_idx in range(len(search_df.columns)):
                cell_val = search_df.iat[r_idx, c_idx]
                if pd.isna(cell_val):
                    continue
                
                if not meta.account_number and is_match(cell_val, acct_num_aliases):
                    if c_idx + 1 < len(search_df.columns):
                        right_val = clean_excel_val(search_df.iat[r_idx, c_idx + 1])
                        if right_val and right_val.upper() != "COUNTERPARTY" and len(right_val) > 4:
                            meta.account_number = right_val
                            continue
                    if r_idx + 1 < len(search_df):
                        bottom_val = clean_excel_val(search_df.iat[r_idx + 1, c_idx])
                        if bottom_val and bottom_val.upper() != "COUNTERPARTY" and len(bottom_val) > 4:
                            meta.account_number = bottom_val
                            continue

                if not meta.account_name and is_match(cell_val, acct_name_aliases):
                    if c_idx + 1 < len(search_df.columns):
                        right_val = clean_excel_val(search_df.iat[r_idx, c_idx + 1])
                        if right_val and not is_bad_name(right_val) and right_val.upper() != "COUNTERPARTY":
                            meta.account_name = right_val
                            continue
                    if r_idx + 1 < len(search_df):
                        bottom_val = clean_excel_val(search_df.iat[r_idx + 1, c_idx])
                        if bottom_val and not is_bad_name(bottom_val) and bottom_val.upper() != "COUNTERPARTY":
                            meta.account_name = bottom_val
                            continue

    # PHASE 3: Fallback to existing text-grid extraction for anything missing
    if not meta.account_number:
        meta.account_number = extract_account_number(lines)
    if not meta.account_name:
        meta.account_name = extract_account_name(lines, disable_fallback=True)
        
    meta.ifsc = extract_ifsc(lines)
    meta.micr = extract_micr(lines)
    meta.bank_name = extract_bank_name(lines)
    meta.branch_name = extract_branch_name(lines)
    meta.account_type = extract_account_type(lines)
    
    st, en = extract_statement_period(lines)
    meta.statement_start_date = st
    meta.statement_end_date = en
    
    return meta
