filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'highest_debit is not None and math\.isnan', text, re.DOTALL)
if match:
    print("Found fix in get_case_transaction_summary!")
