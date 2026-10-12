import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import_str = 'import { useThemeListener } from "../../../context/ThemeContext";\n'
if 'useThemeListener' not in text:
    text = text.replace('import * as echarts from', import_str + 'import * as echarts from')

if 'const themeKey = useThemeListener();' not in text:
    text = re.sub(r'(const distChartRef = useRef\(null\);)', r'const themeKey = useThemeListener();\n  \1', text)

text = re.sub(r'\}, \[analysisData\]\);', r'}, [analysisData, themeKey]);', text)

text = text.replace('echarts.init(distChartRef.current);', 'echarts.init(distChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')
text = text.replace('echarts.init(dailyChartRef.current);', 'echarts.init(dailyChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')
text = text.replace('echarts.init(monthlyChartRef.current);', 'echarts.init(monthlyChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')
text = text.replace('echarts.init(balanceChartRef.current);', 'echarts.init(balanceChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')

# Inject transparent bg
text = re.sub(r'tooltip: \{ trigger: \'axis\'', r'backgroundColor: "transparent", tooltip: { trigger: \'axis\'', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
