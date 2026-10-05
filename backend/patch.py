import pathlib

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py')
content = file_path.read_text(encoding='utf-8')

new_route = '''
from fastapi.responses import StreamingResponse
import io
import csv

@router.get(
    "/case/{case_id}/export",
)
def export_case_transactions(
    case_id: int,
    file_ids: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    min_amount: Decimal | None = Query(default=None),
    max_amount: Decimal | None = Query(default=None),
    mode: str | None = Query(default=None),
    min_balance: Decimal | None = Query(default=None),
    max_balance: Decimal | None = Query(default=None),
    has_cheque_only: bool = Query(default=False),
    exclude_keyword: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="asc"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(fid.strip()) for fid in file_ids.split(",") if fid.strip()]
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid file_ids format")
            
        if parsed_file_ids:
            valid_case_files = get_case_files(case_id=case_id, db=db, user=current_user)
            valid_file_ids_set = {f.id for f in valid_case_files}
            invalid_ids = [fid for fid in parsed_file_ids if fid not in valid_file_ids_set]
            
            if invalid_ids:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Files {invalid_ids} do not belong to case {case_id}"
                )

    transactions, _, _ = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=1,
        page_size=1000000,
        file_ids=parsed_file_ids,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
        mode=mode,
        min_balance=min_balance,
        max_balance=max_balance,
        has_cheque_only=has_cheque_only,
        exclude_keyword=exclude_keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Account Name",
        "Account Number",
        "Mode / Channel",
        "Description",
        "Debit",
        "Credit",
        "Balance",
        "Cheque Number"
    ])
    for tx in transactions:
        writer.writerow([
            tx.transaction_date,
            tx.account_name,
            tx.account_number,
            tx.mode,
            tx.description,
            tx.debit if tx.debit is not None else '',
            tx.credit if tx.credit is not None else '',
            tx.balance if tx.balance is not None else '',
            tx.cheque_number
        ])
    
    output.seek(0)
    filename = f"bank-statement-transaction-report-case-{case_id}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
'''

if 'export_case_transactions' not in content:
    content += new_route
    file_path.write_text(content, encoding='utf-8')
    print('Export route added successfully!')
else:
    print('Export route already exists!')
