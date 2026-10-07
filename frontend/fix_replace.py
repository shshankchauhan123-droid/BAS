filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("replace(///g, '-')", r"replace(/\//g, '-')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
