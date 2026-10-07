filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, line in enumerate(lines):
    if "def search_case_transactions" in line:
        print("\n".join(lines[i+60:i+100]))
        break
