import os
import re

# Financial
filepath_fin = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath_fin, 'r', encoding='utf-8') as f:
    text5 = f.read()

text5 = re.sub(r'const chart = echarts\.dispose\((.*?)\);\n\s*echarts\.init\(.*?\);', r'echarts.dispose(\1);\n          const chart = echarts.init(\1, document.documentElement.classList.contains("dark") ? "dark" : null);', text5)
with open(filepath_fin, 'w', encoding='utf-8') as f:
    f.write(text5)
