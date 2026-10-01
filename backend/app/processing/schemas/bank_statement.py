from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# ACCOUNT INFORMATION
# ============================================================

class BankAccount(BaseModel):
    """
    Universal bank-account information.

    This structure is independent of any particular bank.
    """

    account_holder_name: Optional[str] = None
    joint_holder_name: Optional[str] = None

    customer_id: Optional[str] = None
    account_number: Optional[str] = None

    bank_name: Optional[str] = None

    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    branch_address: Optional[str] = None

    ifsc: Optional[str] = None
    micr: Optional[str] = None

    nominee_registered: Optional[bool] = None

    registered_mobile: Optional[str] = None
    registered_email: Optional[str] = None

    pan: Optional[str] = None
    ckyc_number: Optional[str] = None

    scheme: Optional[str] = None
    currency: Optional[str] = None

    account_address: Optional[str] = None
    account_status: Optional[str] = None

    interest_rate: Optional[Decimal] = None
    drawing_power: Optional[Decimal] = None

    cleared_balance: Optional[Decimal] = None
    uncleared_amount: Optional[Decimal] = None

    monthly_average_balance: Optional[Decimal] = None
    account_limit: Optional[Decimal] = None
    mod_balance: Optional[Decimal] = None


# ============================================================
# STATEMENT INFORMATION
# ============================================================

class BankStatement(BaseModel):
    """
    Universal statement-level information.
    """

    statement_start_date: Optional[date] = None
    statement_end_date: Optional[date] = None

    statement_date: Optional[date] = None
    generated_at: Optional[datetime] = None

    opening_balance: Optional[Decimal] = None
    opening_balance_type: Optional[str] = None

    closing_balance: Optional[Decimal] = None
    closing_balance_type: Optional[str] = None


# ============================================================
# TRANSACTION
# ============================================================

class BankTransaction(BaseModel):
    """
    Universal transaction structure.

    Every supported bank format will eventually be converted
    into this structure.
    """

    # --------------------------------------------------------
    # Identity
    # --------------------------------------------------------

    transaction_id: Optional[str] = None

    case_id: Optional[int] = None
    file_id: Optional[int] = None
    account_id: Optional[str] = None

    # --------------------------------------------------------
    # Dates
    # --------------------------------------------------------

    transaction_date: Optional[date] = None
    post_date: Optional[date] = None
    value_date: Optional[date] = None

    # --------------------------------------------------------
    # Description
    # --------------------------------------------------------

    description: Optional[str] = None
    additional_info: Optional[str] = None

    # --------------------------------------------------------
    # Transaction classification
    # --------------------------------------------------------

    transaction_type: Optional[str] = None
    transaction_category: Optional[str] = None
    payment_mode: Optional[str] = None

    # --------------------------------------------------------
    # Financial values
    # --------------------------------------------------------

    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    amount: Optional[Decimal] = None

    balance: Optional[Decimal] = None
    balance_type: Optional[str] = None

    # --------------------------------------------------------
    # Banking references
    # --------------------------------------------------------

    cheque_number: Optional[str] = None
    reference_number: Optional[str] = None

    # --------------------------------------------------------
    # Counterparty
    # --------------------------------------------------------

    counterparty_name: Optional[str] = None
    counterparty_account: Optional[str] = None
    counterparty_ifsc: Optional[str] = None
    counterparty_upi: Optional[str] = None

    # --------------------------------------------------------
    # Source / traceability
    # --------------------------------------------------------

    source_page: Optional[int] = None
    source_row: Optional[int] = None

    # --------------------------------------------------------
    # Extraction quality
    # --------------------------------------------------------

    extraction_confidence: Optional[Decimal] = Field(
        default=None,
        ge=0,
        le=1,
    )

    # --------------------------------------------------------
    # Raw source
    # --------------------------------------------------------

    raw_narration: Optional[str] = None
    raw_row: Optional[str] = None

    # --------------------------------------------------------
    # Additional bank-specific value
    # --------------------------------------------------------

    alpha: Optional[str] = None


# ============================================================
# COMPLETE BANK STATEMENT RESULT
# ============================================================

class ParsedBankStatement(BaseModel):
    """
    Final normalized representation of a bank statement.

    This is what the parser will produce regardless of
    which bank or file format was used.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    file_id: int

    bank_name: Optional[str] = None

    account: BankAccount

    statement: BankStatement

    transactions: list[BankTransaction] = Field(
        default_factory=list
    )

    # --------------------------------------------------------
    # Processing metadata
    # --------------------------------------------------------

    source_file_name: Optional[str] = None
    source_file_type: Optional[str] = None

    total_pages: Optional[int] = None
    total_transactions: int = 0

    extraction_method: Optional[str] = None

    parser_name: Optional[str] = None
    parser_version: Optional[str] = None