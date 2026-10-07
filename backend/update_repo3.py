filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'def get_case_transaction_summary(db: Session, case_id: int, file_ids: list[int] | None = None):',
    'def get_case_transaction_summary(db: Session, case_id: int, file_ids: list[int] | None = None, mode: str | None = None):'
)

# Replace all occurrences of: if file_ids: query_count = query_count.filter(BankTransaction.file_id.in_(file_ids))
# with: if file_ids: query_count = query_count.filter(BankTransaction.file_id.in_(file_ids)); if mode: query_count = query_count.filter(BankTransaction.mode == mode)

# Better yet, create a helper function in my patch script to add if mode: query = query.filter(BankTransaction.mode == mode) after every if file_ids: block for all queries.

# Or just use regex to insert the mode filter
import re

queries = ['query_count', 'query_dates', 'query_debits', 'query_credits', 'query_debit_count', 'query_credit_count', 'query_active_date']
for q in queries:
    target = f"if file_ids:\n        {q} = {q}.filter(BankTransaction.file_id.in_(file_ids))"
    replacement = f"if file_ids:\n        {q} = {q}.filter(BankTransaction.file_id.in_(file_ids))\n    if mode:\n        {q} = {q}.filter(BankTransaction.mode == mode)"
    text = text.replace(target, replacement)

# Add highest debit, credit, avg calculation
calc_target = '''    active_date_result = query_active_date.first()
    most_active_date = active_date_result[0] if active_date_result else None
    most_active_date_count = active_date_result[1] if active_date_result else 0'''

calc_replacement = '''    active_date_result = query_active_date.first()
    most_active_date = active_date_result[0] if active_date_result else None
    most_active_date_count = active_date_result[1] if active_date_result else 0

    # Calculate highest debit/credit
    query_highest = db.query(
        func.max(BankTransaction.debit),
        func.max(BankTransaction.credit)
    ).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_highest = query_highest.filter(BankTransaction.file_id.in_(file_ids))
    if mode:
        query_highest = query_highest.filter(BankTransaction.mode == mode)
        
    highest_res = query_highest.first()
    highest_debit = highest_res[0] if highest_res else None
    highest_credit = highest_res[1] if highest_res else None
    
    # Calculate average
    average_transaction_value = None
    if total_transactions > 0:
        average_transaction_value = (total_debits + total_credits) / total_transactions'''

text = text.replace(calc_target, calc_replacement)

# Update return dict
ret_target = '''        "debit_transactions": debit_transactions,
        "credit_transactions": credit_transactions,
        "most_active_date": most_active_date,
        "most_active_date_count": most_active_date_count
    }'''

ret_replacement = '''        "debit_transactions": debit_transactions,
        "credit_transactions": credit_transactions,
        "most_active_date": most_active_date,
        "most_active_date_count": most_active_date_count,
        "highest_debit": highest_debit,
        "highest_credit": highest_credit,
        "average_transaction_value": average_transaction_value
    }'''

text = text.replace(ret_target, ret_replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated repository!")
