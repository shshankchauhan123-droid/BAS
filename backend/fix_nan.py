filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        dr = float(row.total_debit or 0.0)
        cr = float(row.total_credit or 0.0)'''

replacement = '''        import math
        dr_raw = float(row.total_debit or 0.0)
        cr_raw = float(row.total_credit or 0.0)
        dr = 0.0 if math.isnan(dr_raw) else dr_raw
        cr = 0.0 if math.isnan(cr_raw) else cr_raw'''

text = text.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
