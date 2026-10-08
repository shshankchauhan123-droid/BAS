filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        b["debit_amount"] += float(row.debit_amount or 0)
        b["credit_amount"] += float(row.credit_amount or 0)'''

replacement = '''        import math
        dr_val = float(row.debit_amount or 0)
        cr_val = float(row.credit_amount or 0)
        if math.isnan(dr_val): dr_val = 0.0
        if math.isnan(cr_val): cr_val = 0.0
        b["debit_amount"] += dr_val
        b["credit_amount"] += cr_val'''

text = text.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
