filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('from sqlalchemy import select, func, and_', 'from sqlalchemy import select, func, and_, desc')
if 'from sqlalchemy import desc' not in text and 'desc(' in text:
    text = "from sqlalchemy import desc\n" + text

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
