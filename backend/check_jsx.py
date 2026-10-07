filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
start = 0
for i, line in enumerate(lines):
    if "lg:grid-cols-5" in line:
        start = i
        break
        
print("\n".join(lines[start:start+65]))
