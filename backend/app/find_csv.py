filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\processing_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if ".csv" in line.lower() or ".xls" in line.lower() or "file_extension in" in line:
        print(f"{i}: {line.strip()}")
