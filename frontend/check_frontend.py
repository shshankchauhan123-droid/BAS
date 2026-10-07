filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'async function loadModeSummary.*?\}', text, re.DOTALL)
if match:
    print(match.group(0))
