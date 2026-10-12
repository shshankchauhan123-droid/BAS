import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('import { formatFinancialValue } from "../../../utils/chartFormatter";\nimport { formatFinancialValue } from "../../../utils/chartFormatter";', 'import { formatFinancialValue } from "../../../utils/chartFormatter";')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
