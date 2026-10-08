filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
text = re.sub(r'counterparty_name:\s*str\s*\|\s*None\s*=\s*Query\(None,\s*description="Exact counterparty name to filter by"\),\s*user\s*=\s*Depends\(get_current_user\),',
              'counterparty_name: str | None = Query(None, description="Exact counterparty name to filter by"),',
              text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
