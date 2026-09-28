import re

from app.processing.mapping.mapping_models import (
    ColumnMapping,
    StatementMapping,
)


# ============================================================
# Universal field aliases
# ============================================================

FIELD_ALIASES = {
    "transaction_date": {
        "tran date",
        "transaction date",
        "transaction_date",
        "date",
        "txn date",
        "txn_date",
        "trans date",
        "value date",
    },

    "cheque_number": {
        "chq no",
        "chq no.",
        "cheque no",
        "cheque no.",
        "cheque number",
        "cheque_number",
        "check no",
        "check number",
    },

    "description": {
        "particulars",
        "particular",
        "description",
        "narration",
        "transaction details",
        "transaction description",
        "remarks",
        "details",
    },

    "debit": {
        "debit",
        "debit amount",
        "withdrawal",
        "withdrawals",
        "withdrawal amount",
        "dr",
        "dr amount",
    },

    "credit": {
        "credit",
        "credit amount",
        "deposit",
        "deposits",
        "deposit amount",
        "cr",
        "cr amount",
    },

    "balance": {
        "balance",
        "closing balance",
        "available balance",
        "running balance",
        "account balance",
    },

    "reference_number": {
        "reference",
        "reference no",
        "reference number",
        "ref no",
        "ref number",
        "transaction reference",
        "txn reference",
    },

    "alpha": {
        "init. br",
        "init br",
        "initial branch",
        "alpha",
    },
}


# ============================================================
# Header normalization
# ============================================================

def normalize_header(header: str) -> str:
    """
    Converts a bank-specific header into a normalized form.

    Example:

        " Tran Date " -> "tran date"
        "CHEQUE NO." -> "cheque no"
        "Closing-Balance" -> "closing balance"
    """

    if not header:
        return ""

    value = header.strip().lower()

    # Replace underscores and hyphens with spaces.
    value = value.replace("_", " ")
    value = value.replace("-", " ")

    # Remove punctuation.
    value = re.sub(r"[^\w\s]", "", value)

    # Collapse multiple spaces.
    value = re.sub(r"\s+", " ", value)

    return value.strip()


# ============================================================
# Find universal field
# ============================================================

def find_target_field(source_header: str) -> str | None:
    """
    Finds which universal field a source header represents.

    Returns:
        Universal field name when recognized.
        None when the header is unknown.
    """

    normalized = normalize_header(source_header)

    if not normalized:
        return None

    for target_field, aliases in FIELD_ALIASES.items():

        normalized_aliases = {
            normalize_header(alias)
            for alias in aliases
        }

        if normalized in normalized_aliases:
            return target_field

    return None


# ============================================================
# Build mapping
# ============================================================

def build_statement_mapping(
    headers: list[str],
    bank_name: str | None = None,
) -> StatementMapping:
    """
    Build a rule-based statement mapping.

    Known headers are converted into universal fields.

    Unknown headers are preserved in `unknown_headers`
    so that the caller can later send them to Qwen.
    """

    mappings: list[ColumnMapping] = []
    unknown_headers: list[str] = []

    for header in headers:

        target_field = find_target_field(header)

        # ----------------------------------------------------
        # UNKNOWN HEADER
        # ----------------------------------------------------

        if target_field is None:

            unknown_headers.append(header)

            continue

        # ----------------------------------------------------
        # KNOWN HEADER
        # ----------------------------------------------------

        mappings.append(
            ColumnMapping(
                source_column=header,
                target_field=target_field,
                confidence=1.0,
            )
        )

    # --------------------------------------------------------
    # Calculate rule-based confidence
    # --------------------------------------------------------

    matched_count = len(mappings)

    if headers:
        confidence = matched_count / len(headers)
    else:
        confidence = 0.0

    # --------------------------------------------------------
    # Determine whether fallback is required.
    #
    # If at least one header is unknown, the mapping
    # requires fallback processing.
    # --------------------------------------------------------

    requires_fallback = len(unknown_headers) > 0

    # --------------------------------------------------------
    # Build final StatementMapping object.
    # --------------------------------------------------------

    return StatementMapping(
        bank_name=bank_name,
        source_headers=headers,
        column_mappings=mappings,
        unknown_headers=unknown_headers,
        requires_fallback=requires_fallback,
        confidence=confidence,
        mapping_source="rule",
    )