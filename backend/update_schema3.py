filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_schema.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'most_active_date_count: int = 0',
    'most_active_date_count: int = 0\n    highest_debit: Optional[Decimal] = None\n    highest_credit: Optional[Decimal] = None\n    average_transaction_value: Optional[Decimal] = None'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
