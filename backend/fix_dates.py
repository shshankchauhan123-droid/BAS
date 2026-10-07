import sys
import re
from datetime import datetime

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\txt\txt_processor.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

replacement_func = '''
def parse_date(date_str: str) -> str:
    date_str = date_str.replace('.', '-').replace('/', '-')
    try:
        if re.match(r'^\d{2}-\d{2}-\d{4}$', date_str):
            return datetime.strptime(date_str, '%d-%m-%Y').strftime('%Y-%m-%d')
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return date_str
    except ValueError:
        pass
    return date_str

def process_txt_file'''

text = text.replace('def process_txt_file', replacement_func)

# Fix metadata
text = text.replace("metadata['statement_start_date'] = period_match.group(1)", "metadata['statement_start_date'] = parse_date(period_match.group(1))")
text = text.replace("metadata['statement_end_date'] = period_match.group(2)", "metadata['statement_end_date'] = parse_date(period_match.group(2))")

# Fix row dates
text = text.replace("tx_date = date_match.group(1)", "tx_date = parse_date(date_match.group(1))")

# Also clean up account_name fallback
text = text.replace("name_fallback = re.search(r'[0-9X]+\s+([A-Z\s]{3,})', line_with_acc)", "name_fallback = re.search(r'[0-9X]+\s+([A-Z][A-Z\s]+)', line_with_acc)\n        if name_fallback:\n            metadata['account_name'] = name_fallback.group(1).split('  ')[0].replace('Gl Sub Head Code','').strip()")

# Wait, 
ame_fallback.group(1).split('  ')[0] is safer to avoid trailing spaces/other columns.
# Let's just write to file directly.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Dates formatted!")
