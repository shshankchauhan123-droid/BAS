import os
for root, _, files in os.walk(r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src"):
    for f in files:
        if f.endswith('.jsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                if 'echarts.init' in file.read():
                    print(path)
