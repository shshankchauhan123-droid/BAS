import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import_str = 'import { useThemeListener } from "../../context/ThemeContext";\n'
if 'useThemeListener' not in text:
    text = text.replace('import * as echarts from', import_str + 'import * as echarts from')

if 'const themeKey = useThemeListener();' not in text:
    text = re.sub(r'(const chartRef = useRef\(null\);)', r'const themeKey = useThemeListener();\n  \1', text)

text = re.sub(r'\}, \[nodes, edges, transactions\]\);', r'}, [nodes, edges, transactions, themeKey]);', text)

text = text.replace('echarts.init(chartRef.current);', 'echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
