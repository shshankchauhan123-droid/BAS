filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i in range(280, 290):
        print(f"{i+1}: {lines[i].strip()}")
