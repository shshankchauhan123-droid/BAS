from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BankTransactionData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_id: int
    case_id: int

    transaction_date: Optional[date] = None
    description: Optional[str] = None
    cheque_number: Optional[str] = None

    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    balance: Optional[Decimal] = None

    mode: Optional[str] = None

    created_at: datetime


class BankTransactionListResponse(BaseModel):
    success: bool
    message: str

    total: int
    page: int
    page_size: int
    total_pages: int

    data: list[BankTransactionData]


class TransactionSummaryData(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_transactions: int = 0
    total_debits: Decimal = Decimal("0.0")
    total_credits: Decimal = Decimal("0.0")


class TransactionSummaryResponse(BaseModel):
    success: bool
    message: str
    data: Optional[TransactionSummaryData] = None