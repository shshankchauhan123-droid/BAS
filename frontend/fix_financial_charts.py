filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Add import
import_str = 'import { formatFinancialValue } from "../../../utils/chartFormatter";\n'
if 'formatFinancialValue' not in text:
    text = text.replace('import * as echarts from \'echarts\';', 'import * as echarts from \'echarts\';\n' + import_str)

# Common regex replacements
# 1. distChart
text = re.sub(
    r"yAxis: \{ type: 'value', axisLabel: \{ color: '#94a3b8' \} \}",
    r"yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } }",
    text
)
# For tooltip, replace default trigger with customized formatter
def insert_tooltip(match):
    return "tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },"

text = re.sub(r"tooltip: \{ trigger: 'axis', axisPointer: \{ type: 'shadow' \} \},", insert_tooltip, text)
text = re.sub(r"tooltip: \{ trigger: 'axis' \},", insert_tooltip, text)

# For yAxis formatting where applicable (not for transaction counts)
def insert_yaxis(match):
    # Only format financial yAxis. We can use formatFinancialValue on all since transaction counts won't hit L or Cr, but wait, count might hit 1,00,000 and become L! But distChart yAxis is count, we shouldn't format it.
    # Ah! distChart yAxis is Transactions (Count). So NO financial formatter there.
    # dailyChart yAxis is Value (Debit/Credit).
    # monthlyChart yAxis is Value (Net Flow).
    # balanceChart yAxis is Value (Balance).
    pass

text = text.replace(
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },\n            series: [\n              { name: 'Debit'",
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (val) => formatFinancialValue(val) } },\n            series: [\n              { name: 'Debit'"
)

text = text.replace(
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },\n            series: [{\n              name: 'Net Flow'",
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (val) => formatFinancialValue(val) } },\n            series: [{\n              name: 'Net Flow'"
)

text = text.replace(
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },\n            series: [{\n              name: 'Balance'",
    "yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (val) => formatFinancialValue(val) } },\n            series: [{\n              name: 'Balance'"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
