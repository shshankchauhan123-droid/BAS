filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
import re
# Find something like { id: 1, title: 'Transaction Flow' } or similar
for line in text.splitlines():
    if "title:" in line or "name:" in line or "description:" in line:
        print(line.strip())
