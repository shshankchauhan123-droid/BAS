filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''def get_case_summary(
    case_id: int,
    file_ids: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):'''

replacement = '''def get_case_summary(
    case_id: int,
    file_ids: str | None = Query(default=None),
    mode: str | None = Query(default=None, description="Transaction mode"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):'''

text = text.replace(target, replacement)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated routes signature!")
