filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
    
import re
# Find all occurrences of the rogue block
rogue_block = '''    if counterparty_name:
        from sqlalchemy import func
        query = query.filter(func.upper(BankTransaction.counterparty_name) == counterparty_name.strip().upper())'''

matches = re.finditer(r'def\s+(\w+).*?:.*?(if counterparty_name:)', text, re.DOTALL)
for m in matches:
    # only print if counterparty_name is NOT in the function definition parameters
    func_def = m.group(0).split(':')[0]
    if 'counterparty_name' not in func_def:
        print(f"Function with rogue block: {m.group(1)}")
