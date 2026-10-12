filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("navigate(\\'/dashboard/reports\\')", "navigate('/dashboard/reports')")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
