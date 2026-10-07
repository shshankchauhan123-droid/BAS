filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
for match in re.finditer(r'@router.*summary', text):
    start = max(0, match.start() - 100)
    end = min(len(text), match.end() + 1000)
    print("Found endpoint:")
    print(text[start:end])
