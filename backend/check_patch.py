filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

if "getCaseTransactionSummary" in text and "fetchSummary" in text and "Total Debit Amount" in text:
    print("Dashboard patched successfully!")
else:
    print("Dashboard patch failed.")
