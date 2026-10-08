filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'debit_amount', text)
for m in matches:
    start = max(0, m.start() - 100)
    end = min(len(text), m.start() + 100)
    print(text[start:end])
    print("-" * 50)
