import os
import re

filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Apply global background colors
replacements = {
    r"bg-\[#020b09\]": "bg-slate-50 dark:bg-[#020b09]",
    r"bg-\[#040e0c\]": "bg-white dark:bg-[#040e0c]",
    r"bg-\[#061411\]": "bg-white dark:bg-[#061411]",
    r"bg-\[#0a1714\]": "bg-white dark:bg-[#0a1714]",
    r"bg-\[#06201a\]": "bg-slate-100 dark:bg-[#06201a]",
    r"bg-\[#021814\]": "bg-white dark:bg-[#021814]",
    r"bg-\[#03120f\]": "bg-white dark:bg-[#03120f]",
    r"bg-\[#03100d\]": "bg-slate-50 dark:bg-[#03100d]",
    r"bg-\[#071512\]": "bg-white dark:bg-[#071512]",
    r"bg-\[#021310\]": "bg-white dark:bg-[#021310]",
    r"text-white(?!/\[)": "text-slate-900 dark:text-white",
    r"text-white/\[0\.04\]": "text-slate-900/[0.04] dark:text-white/[0.04]",
    r"text-white/\[0\.08\]": "text-slate-900/[0.08] dark:text-white/[0.08]",
    r"text-white/\[0\.12\]": "text-slate-900/[0.12] dark:text-white/[0.12]",
    r"text-slate-300": "text-slate-600 dark:text-slate-300",
    r"text-slate-400": "text-slate-600 dark:text-slate-400",
    r"text-slate-200": "text-slate-800 dark:text-slate-200",
    r"text-gray-300": "text-gray-600 dark:text-gray-300",
    r"text-gray-400": "text-gray-600 dark:text-gray-400",
    r"border-white/\[0\.04\]": "border-slate-200 dark:border-white/[0.04]",
    r"border-white/\[0\.06\]": "border-slate-200 dark:border-white/[0.06]",
    r"border-white/\[0\.08\]": "border-slate-200 dark:border-white/[0.08]",
    r"border-white/\[0\.12\]": "border-slate-300 dark:border-white/[0.12]",
    r"border-slate-800": "border-slate-200 dark:border-slate-800",
    r"border-slate-700": "border-slate-300 dark:border-slate-700",
    r"border-\[#1a2924\]": "border-slate-200 dark:border-[#1a2924]",
    r"bg-white/\[0\.02\]": "bg-slate-100 dark:bg-white/[0.02]",
    r"bg-white/\[0\.04\]": "bg-slate-200 dark:bg-white/[0.04]",
    r"bg-white/\[0\.06\]": "bg-slate-200 dark:bg-white/[0.06]",
    r"bg-white/\[0\.08\]": "bg-slate-300 dark:bg-white/[0.08]"
}
for old, new in replacements.items():
    text = re.sub(r'(?<!dark:)(?<!\w)' + old, new, text)

# 2. Add imports
if 'useThemeListener' not in text:
    text = text.replace('import * as echarts from', 'import { useThemeListener } from "../../../context/ThemeContext";\nimport { formatFinancialValue } from "../../../utils/chartFormatter";\nimport * as echarts from')

# 3. Add hook
if 'const themeKey = useThemeListener();' not in text:
    text = re.sub(r'(const distChartRef = useRef\(null\);)', r'const themeKey = useThemeListener();\n  \1', text)
text = re.sub(r'\}, \[analysisData\]\);', r'}, [analysisData, themeKey]);', text)

# 4. Fix Echarts init
def replace_init(m):
    ref = m.group(1)
    return f'echarts.dispose({ref});\n          const chart = echarts.init({ref}, document.documentElement.classList.contains("dark") ? "dark" : null);'

text = re.sub(r'const chart = echarts\.init\((.*?)\);', replace_init, text)

# 5. Fix tooltips and formatters
# distChart
def insert_tooltip(match):
    return "backgroundColor: 'transparent', tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },"
text = re.sub(r"tooltip: \{ trigger: 'axis', axisPointer: \{ type: 'shadow' \} \},", insert_tooltip, text)
text = re.sub(r"tooltip: \{ trigger: 'axis' \},", insert_tooltip, text)

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

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
