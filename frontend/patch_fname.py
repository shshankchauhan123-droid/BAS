import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseFileReport.jsx')
content = file_path.read_text(encoding='utf-8')

old_line = 'const fName = fileMatch?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "-");'
new_line = 'const fName = (fileMatch?.account_number ? String(fileMatch.account_number).trim() : null) || fileMatch?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "-");'

if old_line in content:
    content = content.replace(old_line, new_line)
    file_path.write_text(content, encoding='utf-8')
    print("Patched fName inside CaseFileReport")
else:
    print("Could not find fName line")
