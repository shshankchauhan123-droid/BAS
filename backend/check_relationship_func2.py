filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py"
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'def get_transaction_relationships\(.*', text)
if match:
    start_index = text.find(match.group(0))
    print(text[start_index+4500:start_index+7000]) 
