filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = re.findall(r'.{0,40}print.{0,40}', text)
for m in matches:
    print(m.strip())
