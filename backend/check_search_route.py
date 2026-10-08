filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'@router\.get\(\s*"/case/{case_id}/transactions".*?def ', text, re.DOTALL)
if match:
    # grab the next few lines
    idx = text.find(match.group(0))
    print(text[idx:idx+1000])
