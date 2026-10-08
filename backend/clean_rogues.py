filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We will split the file by 'def ' to process each function individually
parts = text.split('\ndef ')
new_parts = [parts[0]]

rogue_block = '''    if counterparty_name:
        from sqlalchemy import func
        query = query.filter(func.upper(BankTransaction.counterparty_name) == counterparty_name.strip().upper())'''

# also support potential variations in indentation
pattern = re.compile(r'\n\s*if counterparty_name:\n\s*from sqlalchemy import func\n\s*query = query\.filter\(func\.upper\(BankTransaction\.counterparty_name\) == counterparty_name\.strip\(\)\.upper\(\)\)')

for p in parts[1:]:
    func_name = p.split('(')[0]
    if func_name != 'get_filtered_transactions_by_case':
        p = pattern.sub('', p)
    new_parts.append(p)

new_text = '\ndef '.join(new_parts)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Cleaned up rogue blocks.")
