filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\file_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
for i, line in enumerate(text.split('\n')):
    if "ALLOWED_EXTENSIONS =" in line:
        print("\n".join(text.split('\n')[i:i+5]))
        break
