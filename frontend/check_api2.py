filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'export function getCaseTransactionSummary.*?\}', text, re.DOTALL)
if match:
    print(match.group(0))
