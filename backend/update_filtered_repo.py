filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Update get_filtered_transactions_by_case definition
old_def = '''def get_filtered_transactions_by_case(
    db: Session,
    case_id: int,
    page: int,
    page_size: int,
    file_ids: list[int] | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    mode: str | None = None,
    min_balance: Decimal | None = None,
    max_balance: Decimal | None = None,
    has_cheque_only: bool = False,
    exclude_keyword: str | None = None,
    sort_by: str | None = None,
    sort_order: str = 'asc',
):'''

new_def = '''def get_filtered_transactions_by_case(
    db: Session,
    case_id: int,
    page: int,
    page_size: int,
    file_ids: list[int] | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    mode: str | None = None,
    min_balance: Decimal | None = None,
    max_balance: Decimal | None = None,
    has_cheque_only: bool = False,
    exclude_keyword: str | None = None,
    sort_by: str | None = None,
    sort_order: str = 'asc',
    counterparty_name: str | None = None,
):'''

text = text.replace(old_def, new_def)

# Find where file_ids filter is added and add counterparty_name
old_filter = '''    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))'''

new_filter = '''    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))
        
    if counterparty_name:
        from sqlalchemy import func
        query = query.filter(func.upper(BankTransaction.counterparty_name) == counterparty_name.strip().upper())'''

text = text.replace(old_filter, new_filter)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated get_filtered_transactions_by_case")
