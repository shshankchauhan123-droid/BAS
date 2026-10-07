filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_schema.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'total_credits: Decimal = Decimal("0.0")',
    'total_credits: Decimal = Decimal("0.0")\n    debit_transactions: int = 0\n    credit_transactions: int = 0'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
