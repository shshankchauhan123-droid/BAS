filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "debit_transactions": debit_transactions,
        "credit_transactions": credit_transactions
    }'''

replacement = '''    # Calculate most active date
    query_active_date = db.query(
        BankTransaction.transaction_date, 
        func.count(BankTransaction.id).label('tx_count')
    ).filter(BankTransaction.case_id == case_id)
    
    if file_ids:
        query_active_date = query_active_date.filter(BankTransaction.file_id.in_(file_ids))
        
    query_active_date = query_active_date.group_by(BankTransaction.transaction_date)\\
        .order_by(desc('tx_count'), desc(BankTransaction.transaction_date))\\
        .limit(1)
        
    active_date_result = query_active_date.first()
    most_active_date = active_date_result[0] if active_date_result else None
    most_active_date_count = active_date_result[1] if active_date_result else 0

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "debit_transactions": debit_transactions,
        "credit_transactions": credit_transactions,
        "most_active_date": most_active_date,
        "most_active_date_count": most_active_date_count
    }'''

if target in text:
    if 'desc' not in text:
        text = text.replace('from sqlalchemy import select, func, and_', 'from sqlalchemy import select, func, and_, desc')
        
    new_text = text.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Updated repository.")
else:
    print("Target not found.")
