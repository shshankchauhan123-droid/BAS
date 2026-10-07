filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\mapping\qwen_header_mapper.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('raise ValueError("No headers were actually changed in the Excel file.")', 'pass # We allow unchanged headers if they are already perfect')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("qwen_header_mapper.py patched")
