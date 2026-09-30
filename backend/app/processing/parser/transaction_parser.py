import re
from copy import deepcopy
from datetime import datetime
from decimal import Decimal, InvalidOperation

from app.processing.pdf.column_detector import (
    DetectedTable,
    detect_transaction_table,
)
from app.processing.pdf.pdf_table_extractor import PDFPageContent
from app.processing.schemas.bank_statement import BankTransaction


# ============================================================
# Date helpers
# ============================================================

DATE_PATTERN = re.compile(
    r"^\d{2}[-/]\d{2}[-/]\d{4}$"
)


def _is_date(value: str) -> bool:
    """
    Check whether a value looks like a supported date.
    """

    if not value:
        return False

    return bool(
        DATE_PATTERN.match(value.strip())
    )


def _parse_date(value: str):
    """
    Convert supported date formats into a Python date.
    """

    if not value:
        return None

    value = value.strip()

    for fmt in (
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d/%m/%y",
    ):
        try:
            return datetime.strptime(
                value,
                fmt,
            ).date()

        except ValueError:
            continue

    return None


# ============================================================
# Decimal helpers
# ============================================================

def _parse_decimal(value: str) -> Decimal | None:
    """
    Convert a PDF text value into Decimal.

    Supports:
        1,234.50
        ₹1234.50
        (1234.50)
        -1234.50
    """

    if not value:
        return None

    value = value.strip()

    if not value:
        return None

    negative = False

    if (
        value.startswith("(")
        and value.endswith(")")
    ):
        negative = True
        value = value[1:-1].strip()

    value = (
        value
        .replace(",", "")
        .replace("₹", "")
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .strip()
    )

    if not value:
        return None

    try:
        result = Decimal(value)

        if negative:
            result = -result

        return result

    except (
        InvalidOperation,
        ValueError,
    ):
        return None


def _is_numeric(value: str) -> bool:
    """
    Check whether a PDF word represents
    a numeric value.
    """

    return _parse_decimal(value) is not None


# ============================================================
# Word grouping
# ============================================================

def _group_words_by_y(
    page: PDFPageContent,
    y_tolerance: float = 3.0,
):
    """
    Group PDF words into visual lines using
    their Y position.

    Words with approximately the same Y
    coordinate belong to the same visual line.
    """

    groups = []

    words = sorted(
        page.words,
        key=lambda word: (
            word.y0,
            word.x0,
        ),
    )

    for word in words:

        placed = False

        for group in groups:

            if (
                abs(
                    word.y0 - group[0].y0
                )
                <= y_tolerance
            ):
                group.append(word)
                placed = True
                break

        if not placed:
            groups.append([word])

    for group in groups:
        group.sort(
            key=lambda word: word.x0
        )

    return groups


# ============================================================
# Word X-coordinate helper
# ============================================================

def _get_word_x_position(word) -> float:
    """
    Get the horizontal center position of a PDF word.

    Using the center instead of only x0 makes column
    classification more stable when a word is close
    to a column boundary.
    """

    x0 = float(
        getattr(word, "x0", 0.0)
    )

    x1 = getattr(
        word,
        "x1",
        None,
    )

    if x1 is not None:
        try:
            return (
                x0 + float(x1)
            ) / 2.0
        except (
            TypeError,
            ValueError,
        ):
            pass

    return x0


# ============================================================
# Generic column lookup
# ============================================================

def _get_column_for_x(
    x_position: float,
    detected_table: DetectedTable,
):
    """
    Find which detected column owns a PDF X position.

    The parser does not know anything about:

        Axis
        PNB
        SBI
        HDFC
        ICICI
        etc.

    It only uses the detected column boundaries.
    """

    if not detected_table:
        return None

    if not detected_table.columns:
        return None

    has_boundaries = any(
        col.left_boundary is not None or col.right_boundary is not None
        for col in detected_table.columns
    )
    if not has_boundaries:
        return min(
            detected_table.columns,
            key=lambda c: abs(c.x_position - x_position),
        )

    for column in detected_table.columns:

        left_boundary = column.left_boundary
        right_boundary = column.right_boundary

        # ----------------------------------------------------
        # First column
        # ----------------------------------------------------

        if left_boundary is None:

            if (
                right_boundary is None
                or x_position < right_boundary
            ):
                return column

        # ----------------------------------------------------
        # Last column
        # ----------------------------------------------------

        elif right_boundary is None:

            if x_position >= left_boundary:
                return column

        # ----------------------------------------------------
        # Middle column
        # ----------------------------------------------------

        else:

            if (
                x_position >= left_boundary
                and x_position < right_boundary
            ):
                return column

    return None


# ============================================================
# Mapping integration
# ============================================================

def _normalize_header(value: str) -> str:
    """
    Normalize a source header so that mapping lookup
    is not affected by capitalization, punctuation,
    underscores, etc.
    """

    if not value:
        return ""

    value = value.strip().lower()

    value = (
        value
        .replace("_", " ")
        .replace("-", " ")
    )

    value = re.sub(
        r"[^\w\s]",
        "",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value.strip()


def _apply_statement_mapping(
    detected_table: DetectedTable,
    statement_mapping=None,
) -> DetectedTable:
    """
    Apply the universal StatementMapping to the detected
    table structure.

    The detector knows the physical position.

    The mapping tells us the semantic meaning.
    """

    if detected_table is None:
        return detected_table

    if statement_mapping is None:
        return detected_table

    if not statement_mapping.column_mappings:
        return detected_table

    mapping_lookup = {}

    for mapping in statement_mapping.column_mappings:

        source_column = (
            mapping.source_column
            if mapping.source_column
            else ""
        )

        target_field = (
            mapping.target_field
            if mapping.target_field
            else ""
        )

        if not source_column or not target_field:
            continue

        mapping_lookup[
            _normalize_header(
                source_column
            )
        ] = target_field

    if not mapping_lookup:
        return detected_table

    # Do not mutate detector result.
    mapped_table = deepcopy(
        detected_table
    )

    for column in mapped_table.columns:

        normalized_source = (
            _normalize_header(
                column.source_header
            )
        )

        mapped_target = mapping_lookup.get(
            normalized_source
        )

        if mapped_target:
            column.target_field = (
                mapped_target
            )

    return mapped_table


# ============================================================
# Find transaction-date column
# ============================================================

def _get_transaction_date_column(
    detected_table: DetectedTable,
):
    """
    Find the column whose universal target field
    is transaction_date.
    """

    if not detected_table:
        return None

    for column in detected_table.columns:

        if (
            column.target_field
            == "transaction_date"
        ):
            return column

    return None


# ============================================================
# Transaction start detection
# ============================================================

def _is_transaction_start(
    line_words,
    detected_table: DetectedTable,
):
    """
    Detect whether a visual line starts a new transaction.

    The parser checks whether the date word belongs
    to the detected transaction_date column.
    """

    transaction_date_column = (
        _get_transaction_date_column(
            detected_table
        )
    )

    for word in line_words:

        text = word.text.strip()

        if not _is_date(text):
            continue

        # ----------------------------------------------------
        # If transaction-date column exists, use it.
        # ----------------------------------------------------

        if transaction_date_column:

            x_position = (
                _get_word_x_position(word)
            )

            detected_column = (
                _get_column_for_x(
                    x_position=x_position,
                    detected_table=detected_table,
                )
            )

            if detected_column is transaction_date_column:
                return word

        # ----------------------------------------------------
        # Fallback.
        # ----------------------------------------------------

        elif word.x0 < 100:

            return word

    return None


# ============================================================
# Cheque / narration helpers
# ============================================================

def _looks_like_narration(
    value: str | None,
) -> bool:
    """
    Determine whether a value stored in the cheque-number
    column actually looks like transaction narration.

    This is generic and does not depend on any bank.

    Examples that generally look like narration:

        INDI//ATTN/rtgs///////////////////
        NEFT/ABC BANK/TRANSFER
        UPI/merchant/name
        IMPS/TRANSFER/XYZ
        BANK/NEFT
        NATIONAL BANK/////JAGDAM

    Examples that generally look like cheque numbers:

        123456
        000123
        987654321
    """

    if not value:
        return False

    value = value.strip()

    if not value:
        return False

    # Pure numeric values are strong cheque-number candidates.
    if re.fullmatch(
        r"\d{1,20}",
        value,
    ):
        return False

    normalized = value.lower()

    # Common transaction/narration indicators.
    narration_keywords = (
        "rtgs",
        "neft",
        "upi",
        "imps",
        "transfer",
        "bank",
        "cash",
        "payment",
        "deposit",
        "withdraw",
        "atm",
        "ecs",
        "nach",
        "pos",
        "card",
        "salary",
        "interest",
        "charges",
    )

    if any(
        keyword in normalized
        for keyword in narration_keywords
    ):
        return True

    # Slash-heavy values are usually narration/reference
    # strings rather than simple cheque numbers.
    slash_count = value.count("/")

    if slash_count >= 2:
        return True

    # Long values containing spaces are generally narration.
    if (
        len(value) > 20
        and " " in value
    ):
        return True

    # Long mixed strings with punctuation are more likely
    # to be narration than cheque numbers.
    if (
        len(value) > 15
        and not re.fullmatch(
            r"[A-Za-z0-9]+",
            value,
        )
    ):
        return True

    return False


def _repair_narration_from_cheque(
    values: dict,
) -> dict:
    """
    Repair a common PDF extraction problem:

    Sometimes a bank PDF places narration/reference text
    inside the physical cheque-number column.

    If the actual description is empty and the cheque-number
    value clearly looks like narration, move it into
    description.

    This is generic and does not depend on bank name.
    """

    description = values.get(
        "description",
        [],
    )

    cheque_number = values.get(
        "cheque_number"
    )

    # If description already exists, don't disturb it.
    if description:
        return values

    if not cheque_number:
        return values

    if not _looks_like_narration(
        cheque_number
    ):
        return values

    values["description"] = [
        cheque_number
    ]

    values["cheque_number"] = None

    return values


# ============================================================
# Row value extraction
# ============================================================

def _extract_row_values(
    line_words,
    detected_table: DetectedTable,
):
    """
    Extract values from a single transaction or
    continuation row.

    Generic flow:

        PDF word
            ↓
        Word center X
            ↓
        Detected column
            ↓
        Universal target field
            ↓
        BankTransaction field
    """

    values = {
        "description": [],
        "debit": None,
        "credit": None,
        "balance": None,
        "alpha": None,
        "cheque_number": None,
        "reference_number": None,
        "additional_info": [],
    }

    for word in line_words:

        text = word.text.strip()

        if not text:
            continue

        x_position = (
            _get_word_x_position(word)
        )

        column = _get_column_for_x(
            x_position=x_position,
            detected_table=detected_table,
        )

        if column is None:
            continue

        target_field = column.target_field

        # ----------------------------------------------------
        # Transaction date
        # ----------------------------------------------------

        if target_field == "transaction_date":
            continue

        # ----------------------------------------------------
        # Debit
        # ----------------------------------------------------

        if target_field == "debit":

            amount = _parse_decimal(
                text
            )

            if amount is not None:
                values["debit"] = amount

            continue

        # ----------------------------------------------------
        # Credit
        # ----------------------------------------------------

        if target_field == "credit":

            amount = _parse_decimal(
                text
            )

            if amount is not None:
                values["credit"] = amount

            continue

        # ----------------------------------------------------
        # Balance
        # ----------------------------------------------------

        if target_field == "balance":

            amount = _parse_decimal(
                text
            )

            if amount is not None:
                values["balance"] = amount

            continue

        # ----------------------------------------------------
        # Alpha / Initial Branch
        # ----------------------------------------------------

        if target_field == "alpha":

            if values["alpha"] is None:

                values["alpha"] = text

            else:

                values["alpha"] = (
                    f"{values['alpha']} {text}"
                )

            continue

        # ----------------------------------------------------
        # Cheque number
        # ----------------------------------------------------

        if target_field == "cheque_number":

            if (
                values["cheque_number"]
                is None
            ):

                values["cheque_number"] = text

            else:

                values["cheque_number"] = (
                    f"{values['cheque_number']} {text}"
                )

            continue

        # ----------------------------------------------------
        # Reference number
        # ----------------------------------------------------

        if target_field == "reference_number":

            if (
                values["reference_number"]
                is None
            ):

                values["reference_number"] = text

            else:

                values["reference_number"] = (
                    f"{values['reference_number']} {text}"
                )

            continue

        # ----------------------------------------------------
        # Additional information
        # ----------------------------------------------------

        if target_field == "additional_info":

            values["additional_info"].append(
                text
            )

            continue

        # ----------------------------------------------------
        # Description
        # ----------------------------------------------------

        if target_field == "description":

            values["description"].append(
                text
            )

            continue

        # ----------------------------------------------------
        # Unknown field
        # ----------------------------------------------------

        continue

    # --------------------------------------------------------
    # Generic narration repair
    # --------------------------------------------------------

    values = _repair_narration_from_cheque(
        values
    )

    return values


# ============================================================
# Footer detection
# ============================================================

def _is_statement_footer(
    line_words,
) -> bool:
    """
    Detect statement summary/footer sections.

    These sections can contain dates and numeric values
    that could otherwise be interpreted as transactions.
    """

    text = " ".join(
        word.text
        for word in line_words
    ).upper()

    footer_keywords = (
        "TRANSACTION TOTAL",
        "CLOSING BALANCE",
        "STATEMENT TOTAL",
        "STATEMENT SUMMARY",
        "TOTAL TRANSACTIONS",
    )

    return any(
        keyword in text
        for keyword in footer_keywords
    )


# ============================================================
# Create BankTransaction
# ============================================================

def _build_bank_transaction(
    transaction,
    page_number: int,
) -> BankTransaction:
    """
    Convert an internal transaction dictionary
    into the universal BankTransaction model.
    """

    description = " ".join(
        transaction[
            "description_parts"
        ]
    ).strip()

    additional_info = " ".join(
        transaction[
            "additional_info_parts"
        ]
    ).strip()

    return BankTransaction(

        transaction_date=transaction[
            "transaction_date"
        ],

        description=(
            description
            if description
            else None
        ),

        debit=transaction[
            "debit"
        ],

        credit=transaction[
            "credit"
        ],

        balance=transaction[
            "balance"
        ],

        alpha=transaction[
            "alpha"
        ],

        cheque_number=transaction[
            "cheque_number"
        ],

        reference_number=transaction[
            "reference_number"
        ],

        additional_info=(
            additional_info
            if additional_info
            else None
        ),

        source_page=page_number,

        source_row=transaction[
            "source_row"
        ],
    )


# ============================================================
# Merge extracted values into transaction
# ============================================================

def _merge_values_into_transaction(
    transaction: dict,
    values: dict,
):
    """
    Merge extracted row values into the current
    transaction object.
    """

    # --------------------------------------------------------
    # Description
    # --------------------------------------------------------

    if values["description"]:

        transaction[
            "description_parts"
        ].extend(
            values["description"]
        )

    # --------------------------------------------------------
    # Additional information
    # --------------------------------------------------------

    if values["additional_info"]:

        transaction[
            "additional_info_parts"
        ].extend(
            values["additional_info"]
        )

    # --------------------------------------------------------
    # Debit
    # --------------------------------------------------------

    if values["debit"] is not None:

        if transaction["debit"] is None:
            transaction["debit"] = (
                values["debit"]
            )

    # --------------------------------------------------------
    # Credit
    # --------------------------------------------------------

    if values["credit"] is not None:

        if transaction["credit"] is None:
            transaction["credit"] = (
                values["credit"]
            )

    # --------------------------------------------------------
    # Balance
    # --------------------------------------------------------

    if values["balance"] is not None:

        if transaction["balance"] is None:
            transaction["balance"] = (
                values["balance"]
            )

    # --------------------------------------------------------
    # Alpha
    # --------------------------------------------------------

    if values["alpha"] is not None:

        if transaction["alpha"] is None:
            transaction["alpha"] = (
                values["alpha"]
            )

    # --------------------------------------------------------
    # Cheque number
    # --------------------------------------------------------

    if values["cheque_number"] is not None:

        if transaction["cheque_number"] is None:
            transaction["cheque_number"] = (
                values["cheque_number"]
            )

    # --------------------------------------------------------
    # Reference number
    # --------------------------------------------------------

    if values["reference_number"] is not None:

        if transaction["reference_number"] is None:
            transaction["reference_number"] = (
                values["reference_number"]
            )


# ============================================================
# Page transaction parser
# ============================================================

def parse_page_transactions(
    page: PDFPageContent,
    detected_table: DetectedTable,
) -> list[BankTransaction]:

    if not page:
        raise ValueError(
            "PDF page is required"
        )

    if not detected_table:
        raise ValueError(
            "Detected table is required"
        )

    lines = _group_words_by_y(
        page
    )

    transactions = []

    current = None

    for line_words in lines:

        if not line_words:
            continue

        line_words.sort(
            key=lambda word: word.x0
        )

        # ----------------------------------------------------
        # Footer
        # ----------------------------------------------------

        if _is_statement_footer(
            line_words
        ):
            break

        # ----------------------------------------------------
        # New transaction
        # ----------------------------------------------------

        date_word = _is_transaction_start(
            line_words=line_words,
            detected_table=detected_table,
        )

        if date_word:

            # ------------------------------------------------
            # Save previous transaction
            # ------------------------------------------------

            if current is not None:

                transactions.append(
                    _build_bank_transaction(
                        transaction=current,
                        page_number=page.page_number,
                    )
                )

            # ------------------------------------------------
            # Start new transaction
            # ------------------------------------------------

            current = {
                "transaction_date": _parse_date(
                    date_word.text
                ),

                "description_parts": [],

                "debit": None,

                "credit": None,

                "balance": None,

                "alpha": None,

                "cheque_number": None,

                "reference_number": None,

                "additional_info_parts": [],

                "source_row": (
                    len(transactions) + 1
                ),
            }

            # ------------------------------------------------
            # Extract same-row values
            # ------------------------------------------------

            values = _extract_row_values(
                line_words=line_words,
                detected_table=detected_table,
            )

            _merge_values_into_transaction(
                transaction=current,
                values=values,
            )

            continue

        # ----------------------------------------------------
        # Continuation line
        # ----------------------------------------------------

        if current is None:
            continue

        values = _extract_row_values(
            line_words=line_words,
            detected_table=detected_table,
        )

        # ----------------------------------------------------
        # Merge continuation values
        # ----------------------------------------------------

        _merge_values_into_transaction(
            transaction=current,
            values=values,
        )

    # --------------------------------------------------------
    # Save final transaction
    # --------------------------------------------------------

    if current is not None:

        transactions.append(
            _build_bank_transaction(
                transaction=current,
                page_number=page.page_number,
            )
        )

    return transactions


# ============================================================
# Complete bank statement parser
# ============================================================

def parse_bank_statement(
    document,
    detected_table=None,
    statement_mapping=None,
) -> list[BankTransaction]:
    """
    Parse all pages of a bank statement.

    Generic flow:

        PDF
         ↓
        detected table
         ↓
        statement mapping
         ↓
        mapped columns
         ↓
        column boundaries
         ↓
        generic transaction parser
         ↓
        BankTransaction
    """

    if not document:
        raise ValueError(
            "PDF document is required"
        )

    if not document.pages:
        return []

    # ========================================================
    # Step 1
    # Detect transaction table if not already provided.
    # ========================================================

    if detected_table is None:

        for page in document.pages:

            detected_table = (
                detect_transaction_table(
                    page
                )
            )

            if detected_table is not None:
                break

    if detected_table is None:

        raise ValueError(
            "Transaction table could not be detected"
        )

    # ========================================================
    # Step 2
    # Apply statement mapping.
    # ========================================================

    detected_table = (
        _apply_statement_mapping(
            detected_table=detected_table,
            statement_mapping=statement_mapping,
        )
    )

    # ========================================================
    # Logging
    # ========================================================

    print("=" * 60)

    print(
        "MULTI-PAGE BANK STATEMENT PARSING"
    )

    print("=" * 60)

    print(
        f"Table layout detected on page "
        f"{detected_table.page_number}"
    )

    print("-" * 60)

    print(
        "DETECTED / MAPPED COLUMNS"
    )

    for column in detected_table.columns:

        print(
            f"{column.source_header} "
            f"-> {column.target_field} "
            f"| x={column.x_position} "
            f"| left={column.left_boundary} "
            f"| right={column.right_boundary}"
        )

    print("-" * 60)

    # ========================================================
    # Mapping information
    # ========================================================

    if statement_mapping is not None:

        print(
            "STATEMENT MAPPING APPLIED"
        )

        print(
            f"Mapping source: "
            f"{statement_mapping.mapping_source}"
        )

        print(
            f"Mapping confidence: "
            f"{statement_mapping.confidence}"
        )

        print(
            f"Mapping columns: "
            f"{len(statement_mapping.column_mappings)}"
        )

    else:

        print(
            "No statement mapping supplied"
        )

    print("-" * 60)

    # ========================================================
    # Step 3
    # Parse every page.
    # ========================================================

    all_transactions = []

    for page in document.pages:

        page_transactions = (
            parse_page_transactions(
                page=page,
                detected_table=detected_table,
            )
        )

        print(
            f"Page {page.page_number}: "
            f"{len(page_transactions)} "
            f"transactions"
        )

        all_transactions.extend(
            page_transactions
        )

    # ========================================================
    # Step 4
    # Re-number source rows globally.
    # ========================================================

    for row_number, transaction in enumerate(
        all_transactions,
        start=1,
    ):

        transaction.source_row = (
            row_number
        )

    # ========================================================
    # Final result
    # ========================================================

    print("-" * 60)

    print(
        f"TOTAL TRANSACTIONS: "
        f"{len(all_transactions)}"
    )

    print("=" * 60)

    return all_transactions