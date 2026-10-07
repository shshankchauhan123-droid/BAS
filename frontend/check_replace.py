filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'\{modeKPIs\.mostActiveDate \? new Date\(modeKPIs\.mostActiveDate\)\.toLocaleDateString\(\'en-GB\'\)\.replace.*\}', text)
if match:
    print(match.group(0))
