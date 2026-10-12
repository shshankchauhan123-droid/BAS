filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

bad_str = """    if (!chartInstance.current) {
      chartInstance.current = echarts.dispose(chartRef.current);
          echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);
    }"""

good_str = """    echarts.dispose(chartRef.current);
    chartInstance.current = echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""

text = text.replace(bad_str, good_str)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

# Also fix TimelineChart.jsx
filepath_timeline = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\TimelineChart.jsx"
with open(filepath_timeline, 'r', encoding='utf-8') as f:
    text2 = f.read()

bad_str2 = """    if (!chartInstance.current) {
      chartInstance.current = echarts.dispose(chartRef.current);
          echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);
    }"""

if bad_str2 in text2:
    text2 = text2.replace(bad_str2, good_str)
    with open(filepath_timeline, 'w', encoding='utf-8') as f:
        f.write(text2)
        
# And RelationshipGraph.jsx
filepath_rel = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx"
with open(filepath_rel, 'r', encoding='utf-8') as f:
    text3 = f.read()

bad_str3 = """    const myChart = echarts.dispose(chartRef.current);
          echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""
good_str3 = """    echarts.dispose(chartRef.current);
    const myChart = echarts.init(chartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""

text3 = text3.replace(bad_str3, good_str3)
with open(filepath_rel, 'w', encoding='utf-8') as f:
    f.write(text3)

# Counterparty
filepath_cp = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx"
with open(filepath_cp, 'r', encoding='utf-8') as f:
    text4 = f.read()

bad_str4 = """        const chart = echarts.dispose(singleChartRef.current);
          echarts.init(singleChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""
good_str4 = """        echarts.dispose(singleChartRef.current);
        const chart = echarts.init(singleChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""

text4 = text4.replace(bad_str4, good_str4)

bad_str4_2 = """        const chart = echarts.dispose(multiChartRef.current);
          echarts.init(multiChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""
good_str4_2 = """        echarts.dispose(multiChartRef.current);
        const chart = echarts.init(multiChartRef.current, document.documentElement.classList.contains("dark") ? "dark" : null);"""
text4 = text4.replace(bad_str4_2, good_str4_2)
with open(filepath_cp, 'w', encoding='utf-8') as f:
    f.write(text4)
    
# Financial
filepath_fin = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath_fin, 'r', encoding='utf-8') as f:
    text5 = f.read()

# Fix all of them using regex
text5 = re.sub(r'const chart = echarts\.dispose\((.*?)\);\n\s*echarts\.init\(.*?\);', r'echarts.dispose(\1);\n          const chart = echarts.init(\1, document.documentElement.classList.contains("dark") ? "dark" : null);', text5)
with open(filepath_fin, 'w', encoding='utf-8') as f:
    f.write(text5)
