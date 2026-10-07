filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target1 = '''def get_case_summary(
    case_id: int,
    file_ids: str | None = Query(
        default=None,
        description="Comma-separated list of file IDs",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):'''

replacement1 = '''def get_case_summary(
    case_id: int,
    file_ids: str | None = Query(
        default=None,
        description="Comma-separated list of file IDs",
    ),
    mode: str | None = Query(
        default=None,
        description="Transaction mode",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):'''

text = text.replace(target1, replacement1)

target2 = '''    summary_data = get_case_transaction_summary(db=db, case_id=case_id, file_ids=parsed_file_ids)'''

replacement2 = '''    summary_data = get_case_transaction_summary(db=db, case_id=case_id, file_ids=parsed_file_ids, mode=mode)'''

text = text.replace(target2, replacement2)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated routes!")
