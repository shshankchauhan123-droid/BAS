filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    # Calculate total credits
    query_credits = db.query(func.sum(BankTransaction.credit)).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_credits = query_credits.filter(BankTransaction.file_id.in_(file_ids))
    total_credits = query_credits.scalar() or Decimal("0.0")

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits
    }'''

replacement = '''    # Calculate total credits
    query_credits = db.query(func.sum(BankTransaction.credit)).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_credits = query_credits.filter(BankTransaction.file_id.in_(file_ids))
    total_credits = query_credits.scalar() or Decimal("0.0")

    # Calculate debit transactions count
    query_debit_count = db.query(func.count(BankTransaction.id)).filter(BankTransaction.case_id == case_id, BankTransaction.debit > 0)
    if file_ids:
        query_debit_count = query_debit_count.filter(BankTransaction.file_id.in_(file_ids))
    debit_transactions = query_debit_count.scalar() or 0

    # Calculate credit transactions count
    query_credit_count = db.query(func.count(BankTransaction.id)).filter(BankTransaction.case_id == case_id, BankTransaction.credit > 0)
    if file_ids:
        query_credit_count = query_credit_count.filter(BankTransaction.file_id.in_(file_ids))
    credit_transactions = query_credit_count.scalar() or 0

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "debit_transactions": debit_transactions,
        "credit_transactions": credit_transactions
    }'''

if target in text:
    new_text = text.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Updated bank_transaction_repository.py successfully.")
else:
    print("Target not found.")
