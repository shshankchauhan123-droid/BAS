filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'@router\.get\(\s*"/case/{case_id}/counterparty-analysis".*?def get_counterparty_analysis_route.*?return \{.*\}', text, re.DOTALL)
if match:
    print(match.group(0))
else:
    match2 = re.search(r'def get_counterparty_analysis_route.*', text, re.DOTALL)
    if match2:
        print(match2.group(0)[:1000])
