filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Already removed auth from all routes when I did text.replace("user = Depends(get_current_user),", "") !!
# Wait! Did I?
# Let's check if the string was perfectly matched.
import re
text = re.sub(r'user\s*=\s*Depends\(get_current_user\),?', '', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
