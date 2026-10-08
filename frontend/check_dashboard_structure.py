filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'// 1\. Fetch Cases on mount.*?// 3\. Fetch Mode-Wise', text, re.DOTALL)
if match:
    print(match.group(0)[:1000])
