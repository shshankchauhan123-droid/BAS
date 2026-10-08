filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    total_debits = query_debits.scalar() or 0.0
    total_credits = query_credits.scalar() or 0.0'''

replacement = '''    total_debits = query_debits.scalar() or 0.0
    total_credits = query_credits.scalar() or 0.0
    import math
    if math.isnan(float(total_debits)): total_debits = 0.0
    if math.isnan(float(total_credits)): total_credits = 0.0'''

text = text.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
