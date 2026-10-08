filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# replace formatCurrency with formatFinancialValue
text = text.replace('formatCurrency(d.debit)', 'formatFinancialValue(d.debit)')
text = text.replace('formatCurrency(d.credit)', 'formatFinancialValue(d.credit)')
text = text.replace('formatCurrency(d.total)', 'formatFinancialValue(d.total)')

# replace yAxis formatter
text = re.sub(r'axisLabel:\s*{\s*color:\s*"#94a3b8",\s*formatter:\s*\(val\)\s*=>\s*`₹\${val\s*/\s*100000}L`\s*}', 
              r'axisLabel: { color: "#94a3b8", formatter: (val) => formatFinancialValue(val) }', text)

# replace bar labels
text = re.sub(r'formatter:\s*\(params\)\s*=>\s*`₹\${Math.round\(params.value\s*/\s*100000\)}L`',
              r'formatter: (params) => formatFinancialValue(params.value)', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
