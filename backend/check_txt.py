filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\file_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
for i, line in enumerate(text.split('\n')):
    if ".txt" in line:
        print(f"Line {i}: {line.strip()}")
