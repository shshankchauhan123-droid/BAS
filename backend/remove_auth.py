filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("user = Depends(get_current_user),", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
