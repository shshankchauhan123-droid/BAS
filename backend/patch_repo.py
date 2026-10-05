import pathlib

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py')
content = file_path.read_text(encoding='utf-8')

new_func = '''
def get_mode_wise_by_case(
    db: Session,
    case_id: int,
    file_ids: list[int] = None,
):
    query = db.query(BankTransaction).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))

    results = db.query(
        BankTransaction.mode,
        func.count(BankTransaction.id).label('tx_count'),
        func.sum(case((BankTransaction.debit > 0, 1), else_=0)).label('debit_count'),
        func.sum(case((BankTransaction.credit > 0, 1), else_=0)).label('credit_count'),
        func.sum(func.coalesce(BankTransaction.debit, 0)).label('debit_amount'),
        func.sum(func.coalesce(BankTransaction.credit, 0)).label('credit_amount')
    ).filter(query.whereclause).group_by(BankTransaction.mode).all()
    
    total_transactions = 0
    modes_dict = {}

    for row in results:
        m = row.mode
        if not m or str(m).strip() == '' or str(m).strip() == '-':
            mode_label = 'OTHER'
        else:
            mode_label = str(m).upper()
            
        if mode_label not in modes_dict:
            modes_dict[mode_label] = {
                'mode': mode_label,
                'transaction_count': 0,
                'debit_count': 0,
                'credit_count': 0,
                'debit_amount': 0.0,
                'credit_amount': 0.0
            }
            
        modes_dict[mode_label]['transaction_count'] += row.tx_count
        modes_dict[mode_label]['debit_count'] += row.debit_count
        modes_dict[mode_label]['credit_count'] += row.credit_count
        modes_dict[mode_label]['debit_amount'] += float(row.debit_amount or 0)
        modes_dict[mode_label]['credit_amount'] += float(row.credit_amount or 0)
        
        total_transactions += row.tx_count

    modes_list = list(modes_dict.values())
    
    # Sort modes by transaction count descending
    modes_list.sort(key=lambda x: x['transaction_count'], reverse=True)

    return {
        "total_transactions": total_transactions,
        "modes": modes_list
    }
'''

if 'def get_mode_wise_by_case' not in content:
    content = content.replace('def get_timeline_by_case', new_func + '\ndef get_timeline_by_case')
    file_path.write_text(content, encoding='utf-8')
    print('Added get_mode_wise_by_case')
else:
    print('already exists')
