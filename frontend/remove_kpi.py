import os
import re

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Use regex to remove the KPI Cards block
pattern = r'\{\/\* KPI Cards \*\/\}\s*\{modeData\.length > 0 && !isLoadingModeWise && !error && \(\s*<div className="grid grid-cols-1 md:grid-cols-4 gap-4">\s*<div className="bg-\[#020b09\]\/80 border border-emerald-500\/20 rounded-xl p-4 flex flex-col items-center justify-center">\s*<div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Transactions<\/div>\s*<div className="text-2xl font-mono text-white">\{totalTransactions\.toLocaleString\(\)\}<\/div>\s*<\/div>\s*<\/div>\s*\)\}'

content = re.sub(pattern, '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed old KPI card")
