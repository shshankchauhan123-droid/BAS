filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\file_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
if ".txt" in text:
    print("Found .txt in file_service.py")
else:
    print("Not found .txt in file_service.py")

for line in text.split('\n'):
    if "extension" in line.lower() or "allowed" in line.lower():
        print(line.strip())
