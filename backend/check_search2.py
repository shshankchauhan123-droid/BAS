filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
start = -1
for i, line in enumerate(lines):
    if "/case/{case_id}/search" in line:
        start = i
        break

if start != -1:
    print("\n".join(lines[start:start+40]))
