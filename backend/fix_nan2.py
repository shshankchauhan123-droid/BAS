filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    highest_debit = highest_res[0] if highest_res else None
    highest_credit = highest_res[1] if highest_res else None'''

replacement = '''    import math
    highest_debit = highest_res[0] if highest_res else None
    highest_credit = highest_res[1] if highest_res else None
    
    if highest_debit is not None and math.isnan(float(highest_debit)):
        highest_debit = 0.0
    if highest_credit is not None and math.isnan(float(highest_credit)):
        highest_credit = 0.0
'''

text = text.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
