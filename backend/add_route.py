filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'a', encoding='utf-8') as f:
    f.write('''
@router.get(
    "/case/{case_id}/counterparty-analysis"
)
def get_counterparty_analysis_route(
    case_id: int,
    file_ids: str = Query(..., description="Comma-separated file IDs"),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        parsed_file_ids = [int(f.strip()) for f in file_ids.split(",") if f.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_ids format")

    if not parsed_file_ids:
        raise HTTPException(status_code=400, detail="file_ids is required")

    from app.bank_transactions.bank_transaction_repository import get_counterparty_analysis
    data = get_counterparty_analysis(db, case_id, parsed_file_ids)
    
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])
        
    return {
        "success": True,
        "message": "Counterparty analysis retrieved successfully.",
        "data": data
    }
''')
