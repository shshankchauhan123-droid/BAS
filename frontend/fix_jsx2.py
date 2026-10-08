filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "grid gap-4 mt-6" in line:
        lines[i] = '            <div className={grid gap-4 mt-6 }>\n'

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Hardcoded line replacement")
