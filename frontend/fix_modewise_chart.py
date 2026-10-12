import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import_str = 'import { useThemeListener } from "../../context/ThemeContext";\n'
if 'useThemeListener' not in text:
    text = text.replace('import * as echarts from', import_str + 'import * as echarts from')

if 'const themeKey = useThemeListener();' not in text:
    text = re.sub(r'(const chartRef = useRef\(null\);)', r'const themeKey = useThemeListener();\n  \1', text)

text = re.sub(r'\}, \[data\]\);', r'}, [data, themeKey]);', text)

text = text.replace('echarts.init(chartRef.current);', 'echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')

# Make tooltip and axis label colors dynamic!
# Because we hardcoded them in earlier edits.
# We don't really have to, Echarts "dark" theme overrides textStyle automatically if not forced.
# Let's remove forced colors if they are dark-specific.
text = re.sub(r'color: "#94a3b8",\s*formatter:', 'formatter:', text)
text = re.sub(r'color: "#fff",\s*fontSize: 10,\s*formatter:', 'fontSize: 10, formatter:', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
