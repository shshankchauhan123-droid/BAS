filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\processing_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
start = -1
for i, line in enumerate(lines):
    if "elif file_extension in" in line or "if file_extension ==" in line or "else:" in line:
        start = i
        break
if start != -1:
    print("".join(lines[350:500]))
