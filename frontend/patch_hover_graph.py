import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\TransactionGraphView.jsx')
content = file_path.read_text(encoding='utf-8')

old_906 = 'title={`Click to ${isChecked ? "exclude" : "include"} ${f.account_number?.toString().trim() || f.original_filename} in graph`}'
new_906 = 'title={`Click to ${isChecked ? "exclude" : "include"} ${f.account_number?.toString().trim() || f.original_filename} (File: ${f.original_filename}) in graph`}'
if old_906 in content:
    content = content.replace(old_906, new_906)
    print("Patched TransactionGraphView title")

file_path.write_text(content, encoding='utf-8')
