import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(r'import \{ formatFinancialValue \} from "../../../utils/chartFormatter";\n(?:.*\n)?import \{ formatFinancialValue \} from "../../../utils/chartFormatter";', 'import { formatFinancialValue } from "../../../utils/chartFormatter";', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
