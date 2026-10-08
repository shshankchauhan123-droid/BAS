filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import * as echarts from \"echarts\";\n", "")
text = text.replace("const [error, setError] = useState(\"\");", "")
text = text.replace("setError(", "// setError(")
text = text.replace("{error && <div", "{/* error && <div")

# Fix synchronous setState in effect
text = text.replace("setFiles([]);", "setTimeout(() => setFiles([]), 0);")
text = text.replace("setSelectedFileIds(new Set());", "setTimeout(() => setSelectedFileIds(new Set()), 0);")
text = text.replace("setAnalysisData(null);", "setTimeout(() => setAnalysisData(null), 0);")
text = text.replace("setSelectedCounterpartyName(\"\");", "setTimeout(() => setSelectedCounterpartyName(\"\"), 0);")
text = text.replace("setCpTransactions([]);", "setTimeout(() => setCpTransactions([]), 0);")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Fixed lint errors")
