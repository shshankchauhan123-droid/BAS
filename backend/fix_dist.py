filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\financial_analysis_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
    
text = text.replace("    for k, v in dist_list:\n        pass\n        \n", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
