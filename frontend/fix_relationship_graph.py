filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

new_formatCurrency = """import { formatFinancialValue } from "../../utils/chartFormatter";

function formatCurrency(amount) {
  return formatFinancialValue(amount);
}"""

pattern = re.compile(r'function formatCurrency\(amount\).*?\}\s*\}', re.DOTALL)
text = pattern.sub(new_formatCurrency, text, count=1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
