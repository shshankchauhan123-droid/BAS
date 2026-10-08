filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'@router\.get\(\s*"/case/\{case_id\}/transactions".*?return \{', text, re.DOTALL)
if match:
    print(match.group(0))
else:
    print("Not found")
