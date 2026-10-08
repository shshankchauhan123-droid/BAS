filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

old_route_def = '''def search_case_transactions_route(
    case_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    file_ids: str | None = Query(None, description="Comma-separated list of file IDs"),
    search: str | None = Query(None, description="Search term for account name, number, or description"),
    date_from: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    transaction_type: str | None = Query(None, description="'debit' or 'credit'"),
    min_amount: Decimal | None = Query(None, description="Minimum amount (debit or credit)"),
    max_amount: Decimal | None = Query(None, description="Maximum amount (debit or credit)"),
    mode: str | None = Query(None, description="Transaction mode/channel"),
    min_balance: Decimal | None = Query(None, description="Minimum balance"),
    max_balance: Decimal | None = Query(None, description="Maximum balance"),
    has_cheque_only: bool = Query(False, description="Only transactions with cheque numbers"),
    exclude_keyword: str | None = Query(None, description="Keyword to exclude from description"),
    sort_by: str | None = Query(None, description="Field to sort by (e.g. date, amount)"),
    sort_order: str = Query('asc', description="'asc' or 'desc'"),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):'''

new_route_def = '''def search_case_transactions_route(
    case_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    file_ids: str | None = Query(None, description="Comma-separated list of file IDs"),
    search: str | None = Query(None, description="Search term for account name, number, or description"),
    date_from: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    transaction_type: str | None = Query(None, description="'debit' or 'credit'"),
    min_amount: Decimal | None = Query(None, description="Minimum amount (debit or credit)"),
    max_amount: Decimal | None = Query(None, description="Maximum amount (debit or credit)"),
    mode: str | None = Query(None, description="Transaction mode/channel"),
    min_balance: Decimal | None = Query(None, description="Minimum balance"),
    max_balance: Decimal | None = Query(None, description="Maximum balance"),
    has_cheque_only: bool = Query(False, description="Only transactions with cheque numbers"),
    exclude_keyword: str | None = Query(None, description="Keyword to exclude from description"),
    sort_by: str | None = Query(None, description="Field to sort by (e.g. date, amount)"),
    sort_order: str = Query('asc', description="'asc' or 'desc'"),
    counterparty_name: str | None = Query(None, description="Exact counterparty name to filter by"),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):'''

text = text.replace(old_route_def, new_route_def)

old_call = '''    data = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=page,
        page_size=page_size,
        file_ids=parsed_file_ids,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
        mode=mode,
        min_balance=min_balance,
        max_balance=max_balance,
        has_cheque_only=has_cheque_only,
        exclude_keyword=exclude_keyword,
        sort_by=sort_by,
        sort_order=sort_order
    )'''

new_call = '''    data = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=page,
        page_size=page_size,
        file_ids=parsed_file_ids,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
        mode=mode,
        min_balance=min_balance,
        max_balance=max_balance,
        has_cheque_only=has_cheque_only,
        exclude_keyword=exclude_keyword,
        sort_by=sort_by,
        sort_order=sort_order,
        counterparty_name=counterparty_name
    )'''

text = text.replace(old_call, new_call)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated search_case_transactions_route")
