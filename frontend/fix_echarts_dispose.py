import os
import re

def fix_echarts(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Find echarts.init(someRef.current...)
    # Replace with echarts.dispose(someRef.current); echarts.init(someRef.current...)
    
    # We will use regex to find: echarts.init(ref.current
    # and prepend echarts.dispose(ref.current);\n
    
    def replacer(match):
        ref = match.group(1)
        return f"echarts.dispose({ref});\n          " + match.group(0)

    new_text = re.sub(r'echarts\.init\(([\w\.]+(?:\.current)?)(?:,\s*.*?)?\)', replacer, text)
    
    if new_text != text:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_text)

files = [
    r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx",
    r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\TimelineChart.jsx",
    r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx",
    r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx",
    r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
]

for f in files:
    fix_echarts(f)
