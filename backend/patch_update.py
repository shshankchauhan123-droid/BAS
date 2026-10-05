import pathlib
import re

# 1. Update file_controller.py
file_controller_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\file_controller.py')
fc_content = file_controller_path.read_text(encoding='utf-8')

# Change update_uploaded_file call
old_call = '''    updated = update_uploaded_file(
        db=db,
        file_id=file_id,
        user=user,
        original_filename=data.original_filename,
    )'''
new_call = '''    updated = update_uploaded_file(
        db=db,
        file_id=file_id,
        user=user,
        data=data,
    )'''
fc_content = fc_content.replace(old_call, new_call)
file_controller_path.write_text(fc_content, encoding='utf-8')

# 2. Update file_service.py
file_service_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\file_service.py')
fs_content = file_service_path.read_text(encoding='utf-8')

# Import FileUpdateRequest and BankTransaction at the top
if 'from app.files.file_schema import' in fs_content:
    fs_content = re.sub(r'(from app.files.file_schema import .*?)\n', r'\1, FileUpdateRequest\n', fs_content)
else:
    fs_content = 'from app.files.file_schema import FileUpdateRequest\n' + fs_content

fs_content = 'from app.bank_transactions.bank_transaction_model import BankTransaction\n' + fs_content

# Rewrite update_uploaded_file function
old_func_pattern = re.compile(r'def update_uploaded_file\(.*?return file', re.DOTALL)

new_func = '''def update_uploaded_file(
    db: Session,
    file_id: int,
    user: User,
    data: FileUpdateRequest,
) -> File:
    user_id = user.id
    user_role = str(user.role).lower()
    if user_role == "user":
        perms = getattr(user, "permissions", None)
        if perms and not perms.can_update_files:
            raise PermissionError("You do not have permission to update files. Contact your company administrator.")

    file = get_file_by_id_and_user(
        db=db,
        file_id=file_id,
        user_id=user_id,
    )

    if not file:
        raise ValueError("File not found")

    details = {}
    
    if data.original_filename is not None and data.original_filename.strip():
        details["old_filename"] = file.original_filename
        file.original_filename = data.original_filename.strip()
        details["new_filename"] = file.original_filename

    update_fields = [
        'account_name', 'account_number', 'bank_name', 'branch_name', 
        'ifsc', 'micr', 'account_type', 'statement_start_date', 'statement_end_date'
    ]
    
    sync_account_name = False
    sync_account_number = False

    for field in update_fields:
        val = getattr(data, field)
        if val is not None:
            if isinstance(val, str):
                val = val.strip()
            old_val = getattr(file, field)
            if old_val != val:
                setattr(file, field, val)
                details[f"old_{field}"] = old_val
                details[f"new_{field}"] = val
                
                if field == 'account_name':
                    sync_account_name = True
                if field == 'account_number':
                    sync_account_number = True

    if sync_account_name or sync_account_number:
        # Perform bulk update on bank_transactions
        update_stmt = {}
        if sync_account_name:
            update_stmt[BankTransaction.account_name] = file.account_name
        if sync_account_number:
            update_stmt[BankTransaction.account_number] = file.account_number
            
        db.query(BankTransaction).filter(BankTransaction.file_id == file_id).update(update_stmt, synchronize_session=False)

    db.commit()
    db.refresh(file)

    record_audit_log(
        db=db,
        actor=user,
        action="FILE_UPDATED",
        entity_type="file",
        entity_id=str(file.id),
        entity_name=file.original_filename,
        description=f"User {user.username} updated file metadata in Case ID {file.case_id}",
        details=details,
        client_id=user.client_id,
    )

    return file'''

fs_content = old_func_pattern.sub(new_func, fs_content)
file_service_path.write_text(fs_content, encoding='utf-8')
print("Patched backend successfully")
