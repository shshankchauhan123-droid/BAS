filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\mapping\qwen_header_mapper.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "No headers were actually changed" in line or "return #" in line:
        print("".join(lines[i-15:i+15]))
        break
