import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\mapping\standard_dataframe.py')
content = file_path.read_text(encoding='utf-8')

# Fix the newline issue
old_str = 'print(f"Transaction rows: {len(new_df)}\n")'
new_str = 'print(f"Transaction rows: {len(new_df)}\\n")'

content = content.replace('print(f"Transaction rows: {len(new_df)}\n")', 'print(f"Transaction rows: {len(new_df)}\\n")')

# Wait, if it actually broke into two lines in the file:
# print(f"Transaction rows: {len(new_df)}
# ")
import re
content = re.sub(r'print\(f"Transaction rows: \{len\(new_df\)\}\n"\)', 'print(f"Transaction rows: {len(new_df)}\\n")', content)

file_path.write_text(content, encoding='utf-8')
