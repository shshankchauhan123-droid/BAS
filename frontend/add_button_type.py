filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re
text = re.sub(r'(<button\s+)onClick=\{handleExportPDF\}', r'\1type="button"\n                onClick={handleExportPDF}', text)
text = re.sub(r'(<button\s+)onClick=\{applyFilters\}', r'\1type="button"\n                  onClick={applyFilters}', text)
text = re.sub(r'(<button\s+)onClick=\{\(\) => navigate\(\'/dashboard/reports\'\)\}', r'\1type="button"\n                onClick={() => navigate(\'/dashboard/reports\')}', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
