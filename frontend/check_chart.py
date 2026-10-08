import os
filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    for line in f.readlines()[:10]:
        print(line.strip())
