filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('f"{parts[2]}/{parts[1]}/{parts[0]}"', '${parts[2]}//')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed syntax")
