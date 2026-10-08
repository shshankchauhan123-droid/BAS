filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'const REPORTS = \[.*?\];', text, re.DOTALL)
if match:
    print(match.group(0))
else:
    match2 = re.search(r'const reportCategories = \[.*?\];', text, re.DOTALL)
    if match2:
        print(match2.group(0))
