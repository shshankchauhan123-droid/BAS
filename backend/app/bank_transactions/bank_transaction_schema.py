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
    account_name: Optional[str] = None
    account_number: Optional[str] = None
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
    
    mode_counts: list[dict] = []

    data: list[BankTransactionData]


class TransactionSummaryData(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_transactions: int = 0
    total_debits: Decimal = Decimal("0.0")
    total_credits: Decimal = Decimal("0.0")
    available_modes: list[dict] = []
    all_db_modes: list[str] = []
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None


class TransactionSummaryResponse(BaseModel):
    success: bool
    message: str
    data: Optional[TransactionSummaryData] = None


class TimelineBucket(BaseModel):
    bucket_start: date | str
    bucket_end: date | str
    debit_count: int
    credit_count: int
    debit_amount: float
    credit_amount: float
    mode_counts: dict[str, int]
    transaction_count: int


class TimelineResponse(BaseModel):
    success: bool
    message: str
    interval: str
    data: list[TimelineBucket]
class GraphNode(BaseModel):
    id: str
    file_id: int
    file_name: str
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    matching_transaction_count: int = 0
    total_debit_amount: float = 0.0
    total_credit_amount: float = 0.0

class GraphTransaction(BaseModel):
    id: int
    file_id: int
    transaction_date: Optional[date] = None
    amount: float
    debit: float
    credit: float
    mode: Optional[str] = None
    reference_number: Optional[str] = None
    description: Optional[str] = None

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    transaction_count: int
    total_amount: float
    transactions: list[GraphTransaction]

class TransactionRelationshipData(BaseModel):
    case_id: int
    filters: dict
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    transactions: list[GraphTransaction] = []
    summary: dict = {}

class TransactionRelationshipResponse(BaseModel):
    success: bool
    message: str
    data: Optional[TransactionRelationshipData] = None

class ModeWiseItem(BaseModel):
    mode: str
    transaction_count: int
    debit_count: int
    credit_count: int
    debit_amount: float
    credit_amount: float

class ModeWiseResponse(BaseModel):
    success: bool
    message: str
    total_transactions: int
    data: list[ModeWiseItem]
