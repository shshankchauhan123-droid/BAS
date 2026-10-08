filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\TransactionGraphView.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

new_format = """import { formatFinancialValue } from "../../../utils/chartFormatter";

function formatCompact(num) {
  return formatFinancialValue(num);
}"""

pattern = re.compile(r'function formatCompact\(num\).*?\}\n', re.DOTALL)
text = pattern.sub(new_format, text, count=1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
