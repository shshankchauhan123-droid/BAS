import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\TransactionGraphView.jsx')
content = file_path.read_text(encoding='utf-8')

def replacer(match):
    # This might be tricky, let's just do targeted replaces
    pass

old_658 = 'const fTitle = found?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "Unassigned Statement");'
new_658 = 'const fTitle = (found?.account_number ? String(found.account_number).trim() : null) || found?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "Unassigned Statement");'
content = content.replace(old_658, new_658)

old_735 = 'fileName: fObj?.original_filename || (fid !== "unassigned" ? `Statement #${fid}` : "General"),'
new_735 = 'fileName: (fObj?.account_number ? String(fObj.account_number).trim() : null) || fObj?.original_filename || (fid !== "unassigned" ? `Statement #${fid}` : "General"),'
content = content.replace(old_735, new_735)

old_906 = 'title={`Click to ${isChecked ? "exclude" : "include"} ${f.original_filename} in graph`}'
new_906 = 'title={`Click to ${isChecked ? "exclude" : "include"} ${f.account_number?.toString().trim() || f.original_filename} in graph`}'
content = content.replace(old_906, new_906)

old_909 = '<span className="truncate max-w-[150px]">{f.original_filename}</span>'
new_909 = '<span className="truncate max-w-[150px]">{f.account_number?.toString().trim() || f.original_filename}</span>'
content = content.replace(old_909, new_909)

file_path.write_text(content, encoding='utf-8')
print("Patched TransactionGraphView successfully")
