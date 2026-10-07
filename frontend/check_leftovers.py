filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'.*(modeSummaryData|setModeSummaryData|isLoadingModeSummary).*', text)
for m in matches:
    print(m.group(0))
