import pathlib
import re

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_routes.py')
content = file_path.read_text(encoding='utf-8')

# Update import
if 'get_mode_wise_by_case' not in content:
    content = content.replace('get_timeline_by_case,', 'get_timeline_by_case, get_mode_wise_by_case,')

if 'ModeWiseResponse' not in content:
    content = content.replace('TimelineResponse,', 'TimelineResponse, ModeWiseResponse,')

new_route = '''
# ============================================================
# Get transactions mode wise by case
# ============================================================

@router.get(
    "/case/{case_id}/mode-wise",
    response_model=ModeWiseResponse,
)
def get_case_transactions_mode_wise(
    case_id: int,
    file_ids: str | None = Query(
        default=None,
        description="Comma-separated list of file IDs to filter by",
    ),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(f.strip()) for f in file_ids.split(",") if f.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid file_ids format")
            
        case_files = get_case_files(db, case_id, user)
        valid_file_ids = {f.id for f in case_files}
        invalid_ids = [f for f in parsed_file_ids if f not in valid_file_ids]
        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Files {invalid_ids} do not belong to case {case_id}"
            )

    mode_data = get_mode_wise_by_case(
        db=db,
        case_id=case_id,
        file_ids=parsed_file_ids,
    )

    return ModeWiseResponse(
        success=True,
        message="Case mode-wise data retrieved successfully.",
        total_transactions=mode_data["total_transactions"],
        data=mode_data["modes"],
    )
'''

# We want to replace the timeline endpoint with the mode-wise endpoint entirely (since it's not used).
# Let's find the start of the timeline route and end of it.
pattern = re.compile(r'# ============================================================\n# Get transactions timeline by case.*?return TimelineResponse\([^)]+\)\n', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(new_route.strip() + '\n', content)
    file_path.write_text(content, encoding='utf-8')
    print('Replaced timeline route with mode-wise route')
else:
    print('Pattern not found')
