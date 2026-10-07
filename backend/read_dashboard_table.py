filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
start = -1
for i, line in enumerate(lines):
    if "Transactions for Mode:" in line:
        start = i
        break
if start != -1:
    print("".join(lines[start:start+40]))
