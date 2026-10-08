filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
text = re.sub(r'\? \/api\/v1\/bank-transactions\/case\/\/financial-analysis\?', r'? `/api/v1/bank-transactions/case/${caseId}/financial-analysis?${params.toString()}`', text)
text = re.sub(r': \/api\/v1\/bank-transactions\/case\/\/financial-analysis;', r': `/api/v1/bank-transactions/case/${caseId}/financial-analysis`;', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
