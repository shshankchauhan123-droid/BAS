from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, computed_field


class SheetSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sheet_name: str
    total_rows: int
    imported_rows: int
    failed_rows: int


class NcrpFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    created_by: int
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: Optional[str] = None
    sheet_count: int
    total_rows: int
    imported_rows: int
    failed_rows: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NcrpUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    original_filename: str
    stored_filename: str
    file_size: int
    sheet_count: int
    total_rows: int
    imported_rows: int
    failed_rows: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    sheets_summary: List[SheetSummaryResponse] = []
    message: str = "NCRP Statement uploaded and imported successfully."


class NcrpTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ncrp_file_id: int
    case_id: int
    sheet_name: str
    row_number: int
    acknowledgement_no: Optional[str] = None
    account_or_wallet_id: Optional[str] = None
    transaction_id_utr: Optional[str] = None
    transaction_date: Optional[datetime] = None
    transaction_amount: Optional[Decimal] = None
    disputed_amount: Optional[Decimal] = None
    bank_name: Optional[str] = None
    layer: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    @computed_field
    @property
    def source_utr(self) -> Optional[str]:
        if not self.raw_data:
            return None
        return (
            self.raw_data.get("source_utr")
            or self.raw_data.get("Transaction Id / UTR Number")
        )

    @computed_field
    @property
    def transfer_utr(self) -> Optional[str]:
        if not self.raw_data:
            return None
        return (
            self.raw_data.get("transfer_utr")
            or self.raw_data.get("Transaction ID / UTR Number")
        )

    @computed_field
    @property
    def action_taken_by_bank(self) -> Optional[str]:
        if not self.raw_data:
            return None
        return (
            self.raw_data.get("action_taken_by_bank")
            or self.raw_data.get("Action Taken By bank")
            or self.raw_data.get("Action Taken by Bank")
        )


class NcrpTransactionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_amount: Decimal = Decimal("0.00")
    total_disputed_amount: Decimal = Decimal("0.00")


class NcrpTransactionPaginatedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total: int
    skip: int
    limit: int
    page: int
    total_pages: int
    sheets: List[str] = []
    banks: List[str] = []
    layers: List[str] = []
    acknowledgements: List[str] = []
    summary: NcrpTransactionSummary
    items: List[NcrpTransactionResponse] = []


class NcrpSankeyNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    account: str
    bank: str
    layer: str
    layer_num: int
    total_in: float = 0.0
    total_out: float = 0.0
    disputed_in: float = 0.0
    disputed_out: float = 0.0
    tx_count: int = 0


class NcrpSankeyLink(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: str
    target: str
    value: float
    disputed_value: float
    layer: str
    layer_num: int
    source_acc: str
    target_acc: str
    source_bank: str
    target_bank: str
    sheet: str
    utr: Optional[str] = None
    source_utr: Optional[str] = None
    ifsc: Optional[str] = None
    ref_no: Optional[str] = None
    remarks: Optional[str] = None
    ack_no: Optional[str] = None
    date: Optional[str] = None
    tx_count: int = 1
    tx_ids: List[int] = []
    transactions: List[Dict[str, Any]] = []


class NcrpSankeyKPIs(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_transactions: int
    unique_source_accounts: int
    unique_destination_accounts: int
    total_transaction_amount: float
    total_disputed_amount: float
    total_layers: int
    layers_represented: List[str] = []
    unknown_or_hold_flow_count: int
    excluded_incomplete_count: int = 0


class NcrpLayerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    layer: str
    layer_num: int
    transaction_count: int
    unique_senders: int
    unique_receivers: int
    total_amount: float
    total_disputed: float
    distinct_accounts: int


class NcrpSankeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nodes: List[NcrpSankeyNode] = []
    links: List[NcrpSankeyLink] = []
    kpis: NcrpSankeyKPIs
    layer_summaries: List[NcrpLayerSummary] = []
    available_layers: List[str] = []
    available_acknowledgements: List[str] = []
    available_banks: List[str] = []
    available_sheets: List[str] = []


class NcrpReconciliationDiffItem(BaseModel):
    tx_id: Optional[int] = None
    sheet: str
    row: int
    diffs: Dict[str, Any]


class NcrpReconcileResponse(BaseModel):
    file_id: int
    case_id: int
    original_filename: str
    dry_run: bool
    total_source_rows: int
    total_db_rows: int
    discrepancies_count: int
    discrepancies: List[NcrpReconciliationDiffItem] = []
    repaired: bool = False
    message: str


class NcrpCategoryBreakdownItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: str
    sheet_name: str
    count: int = 0
    record_count: int = 0
    total_amount: float = 0.0
    relevant_amount: float = 0.0
    disputed_amount: float = 0.0
    hold_amount: float = 0.0
    unique_accounts: int = 0


class NcrpLayerActivityKPIs(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_records: int
    transfer_amount: float = 0.0
    withdrawal_amount: float = 0.0
    hold_amount: float = 0.0
    disputed_amount: float = 0.0
    unique_senders: int = 0
    unique_receivers: int = 0
    unique_accounts: int = 0


class NcrpLayerActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: int
    case_id: int
    layer: Optional[str] = None
    kpis: NcrpLayerActivityKPIs
    categories: List[NcrpCategoryBreakdownItem] = []


class NcrpAccountProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account: str
    masked_account: str = ""
    bank: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_role: str = "Account"
    layer_recorded: Optional[str] = None
    layer_inferred: Optional[str] = None
    ack_no: Optional[str] = None
    total_in_amount: float = 0.0
    total_out_amount: float = 0.0
    inflow_amount: float = 0.0
    outflow_amount: float = 0.0
    net_flow: float = 0.0
    total_withdrawal_amount: float = 0.0
    withdrawal_amount: float = 0.0
    total_hold_amount: float = 0.0
    hold_amount: float = 0.0
    total_disputed_amount: float = 0.0
    disputed_amount: float = 0.0
    recovery_amount: float = 0.0
    incoming_count: int = 0
    outgoing_count: int = 0
    withdrawal_count: int = 0
    hold_count: int = 0
    distinct_utr_count: int = 0
    distinct_linked_accounts_count: int = 0
    first_observed_date: Optional[str] = None
    last_observed_date: Optional[str] = None
    has_hold: bool = False
    hold_status: Optional[str] = None
    layers: List[str] = []
    senders: List[Dict[str, Any]] = []
    beneficiaries: List[Dict[str, Any]] = []
    receivers: List[Dict[str, Any]] = []
    connected_accounts: List[Dict[str, Any]] = []
    withdrawals: List[Dict[str, Any]] = []
    holds: List[Dict[str, Any]] = []
    transactions: List[Dict[str, Any]] = []
    all_transactions: List[Dict[str, Any]] = []
    # 6 NCRP Worksheet Categorized Records
    money_transfers: List[Dict[str, Any]] = []
    pos_withdrawals: List[Dict[str, Any]] = []
    atm_withdrawals: List[Dict[str, Any]] = []
    cheque_withdrawals: List[Dict[str, Any]] = []
    hold_records: List[Dict[str, Any]] = []
    other_records: List[Dict[str, Any]] = []

    # Path-specific vs Account-wide Isolation fields
    root_account: Optional[str] = None
    is_path_isolated: bool = False
    has_unrelated_activity: bool = False
    unrelated_inflow: float = 0.0
    unrelated_outflow: float = 0.0
    unrelated_tx_count: int = 0
    isolation_note: Optional[str] = None
    account_wide_total_in: float = 0.0
    account_wide_total_out: float = 0.0
    account_wide_net_flow: float = 0.0
    account_wide_tx_count: int = 0
    account_wide_distinct_utr_count: int = 0
    account_wide_connected_accounts_count: int = 0
    account_wide_money_transfers: List[Dict[str, Any]] = []
    unrelated_money_transfers: List[Dict[str, Any]] = []
    unrelated_source_accounts: List[str] = []


class NcrpTraceNextResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account: str
    current_layer: int
    has_next_activity: bool
    next_layer: Optional[int] = None
    next_layer_str: Optional[str] = None
    subsequent_layers_available: List[int] = []
    next_transfers: int = 0
    next_withdrawals: int = 0
    next_holds: int = 0
    next_total_amount: float = 0.0
    message: str
    summary: Dict[str, Any] = {}
    next_layer_transactions: List[Dict[str, Any]] = []


class NcrpHierarchicalNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account: str
    masked_account: str
    bank: str
    layer: str
    layer_num: int
    layer_recorded: Optional[str] = None
    layer_inferred: Optional[str] = None
    role: str = "Account"
    is_source: bool = False
    has_outgoing: bool = False
    is_expanded: bool = False
    hold_amount: float = 0.0
    has_hold: bool = False
    disputed_amount: float = 0.0
    total_in: float = 0.0
    total_out: float = 0.0
    account_wide_total_in: Optional[float] = None
    account_wide_total_out: Optional[float] = None
    has_unrelated_activity: bool = False
    tx_count: int = 0
    ack_no: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None


class NcrpHierarchicalEdge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    target: str
    source_acc: str
    target_acc: str
    source_bank: Optional[str] = None
    target_bank: Optional[str] = None
    amount: float
    disputed_amount: float = 0.0
    layer: str
    layer_num: int
    tx_count: int = 1
    utr: Optional[str] = None
    date: Optional[str] = None
    sheet_name: str
    row_numbers: List[int] = []
    transactions: List[Dict[str, Any]] = []


class NcrpHierarchicalGraphResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: int
    case_id: int
    filename: Optional[str] = None
    root_accounts: List[Dict[str, Any]] = []
    selected_root: Optional[str] = None
    nodes: List[NcrpHierarchicalNode] = []
    edges: List[NcrpHierarchicalEdge] = []
    available_layers: List[int] = []
    available_banks: List[str] = []
    available_acknowledgements: List[str] = []
    max_layer: int = 1
    total_amount: float = 0.0
    total_disputed_amount: float = 0.0
    total_transactions: int = 0
    distinct_accounts_count: int = 0
    has_outgoing: bool = True
    message: Optional[str] = None


class NcrpLayer1SourceAccount(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account: str
    raw_account: str
    masked_account: str
    bank: Optional[str] = None
    action_taken_by_bank: Optional[str] = None
    ack_no: Optional[str] = None
    total_outgoing_amount: float = 0.0
    total_disputed_amount: float = 0.0
    outgoing_tx_count: int = 0
    distinct_receivers_count: int = 0
    distinct_utrs_count: int = 0
    first_date: Optional[str] = None
    last_date: Optional[str] = None
    receivers: List[Dict[str, Any]] = []


class NcrpLayer1SourcesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: int
    case_id: int
    total_sources: int
    sources: List[NcrpLayer1SourceAccount] = []


