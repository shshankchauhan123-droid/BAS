filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_schema.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
start = -1
for i, line in enumerate(lines):
    if "class BankTransactionData" in line or "class BankTransactionResponse" in line:
        start = i
        break
if start != -1:
    print("".join(lines[start:start+30]))
