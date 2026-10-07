filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_schema.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
import re
match = re.search(r'class TransactionSummaryData\(BaseModel\):.*?class TransactionSummaryResponse', text, re.DOTALL)
if match:
    print(match.group(0))
