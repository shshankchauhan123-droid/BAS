filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
import re
match = re.search(r'const reportsList = \[.*?\];', text, re.DOTALL)
if match:
    print(match.group(0))
else:
    match2 = re.search(r'const availableReports = \[.*?\];', text, re.DOTALL)
    if match2:
        print(match2.group(0))
    else:
        # Just grab from title: to the end of the array
        start = text.find('title: "Transaction Mode Wise Report"')
        print(text[start-200:start+2000])
