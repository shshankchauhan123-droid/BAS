filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'a', encoding='utf-8') as f:
    f.write('''

from .financial_analysis_service import get_financial_analysis

@router.get(
    "/case/{case_id}/financial-analysis",
    response_model=dict,
)
def get_case_financial_analysis(
    case_id: int,
    file_ids: str | None = Query(None, description="Comma-separated list of file IDs"),
    search: str | None = Query(None, description="Search term"),
    date_from: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    transaction_type: str | None = Query(None, description="'debit' or 'credit'"),
    min_amount: Decimal | None = Query(None, description="Minimum amount"),
    max_amount: Decimal | None = Query(None, description="Maximum amount"),
    mode: str | None = Query(None, description="Transaction mode/channel"),
    counterparty_name: str | None = Query(None, description="Exact counterparty name"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(f.strip()) for f in file_ids.split(",") if f.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid file_ids format")
            
    min_amt = float(min_amount) if min_amount is not None else None
    max_amt = float(max_amount) if max_amount is not None else None
            
    data = get_financial_analysis(
        db=db,
        case_id=case_id,
        file_ids=parsed_file_ids,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amt,
        max_amount=max_amt,
        mode=mode,
        counterparty_name=counterparty_name
    )
    
    if "error" in data:
        return data
        
    return data
''')
