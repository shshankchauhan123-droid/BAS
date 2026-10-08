filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'def get_counterparty_analysis_route.*?return', text, re.DOTALL)
if match:
    print(match.group(0))
