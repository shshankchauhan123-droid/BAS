filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
text = re.sub(r'\? /dashboard/cases//reports/financial-transaction-intelligence', r'? `/dashboard/cases/${activeCaseId}/reports/financial-transaction-intelligence`', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
