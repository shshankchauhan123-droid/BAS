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

    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    balance: Optional[Decimal] = None

    cheque_number: Optional[str] = None
    reference_number: Optional[str] = None
    alpha: Optional[str] = None

    source_page: Optional[int] = None
    source_row: Optional[int] = None

    extraction_confidence: Optional[Decimal] = None

    raw_narration: Optional[str] = None
    raw_row: Optional[str] = None

    created_at: datetime



class BankTransactionListResponse(BaseModel):
    success: bool
    message: str

    total: int
    page: int
    page_size: int
    total_pages: int

    data: list[BankTransactionData]