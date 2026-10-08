filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'def search_case_transactions\(.*?\):', text, re.DOTALL)
if match:
    idx = text.find(match.group(0))
    print(text[idx:idx+1500])
