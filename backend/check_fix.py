filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'dr_raw = float\(row.total_debit or 0\.0\).*?cr = 0\.0 if math\.isnan\(cr_raw\) else cr_raw', text, re.DOTALL)
if match:
    print("Found fix in get_counterparty_analysis!")
