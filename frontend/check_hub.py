filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'\? /dashboard/cases//reports/counterparty-intelligence', text)
if match:
    print(text[match.start()-100:match.start()+200])
