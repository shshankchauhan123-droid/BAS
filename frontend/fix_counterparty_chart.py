import re
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import_str = 'import { useThemeListener } from "../../../context/ThemeContext";\n'
if 'useThemeListener' not in text:
    text = text.replace('import * as echarts from', import_str + 'import * as echarts from')

# Add the hook call inside the component
if 'const themeKey = useThemeListener();' not in text:
    text = re.sub(r'(const singleChartRef = useRef\(null\);)', r'\1\n  const themeKey = useThemeListener();', text)

# Add themeKey to useEffect dependency array
text = re.sub(r'\}, \[analysisData, isMultiFile\]\);', r'}, [analysisData, isMultiFile, themeKey]);', text)

# Update init
text = text.replace('echarts.init(singleChartRef.current);', 'echarts.init(singleChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')
text = text.replace('echarts.init(multiChartRef.current);', 'echarts.init(multiChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);')

# ECharts 'dark' theme automatically sets background color to dark gray. We want it transparent.
# So we inject backgroundColor: 'transparent' in the option object
text = text.replace('tooltip: { trigger: \'axis\'', 'backgroundColor: "transparent", tooltip: { trigger: \'axis\'')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
