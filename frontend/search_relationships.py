import os

search_string = "getTransactionRelationships"
base_dir = r"c:\final bas\BAS_YASH_2_ZIP\BAS"

for root, dirs, files in os.walk(base_dir):
    if 'node_modules' in root or '.git' in root or 'venv' in root or '__pycache__' in root:
        continue
    for file in files:
        if file.endswith(('.js', '.jsx', '.py')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        if search_string in line:
                            print(f"{filepath}:{i+1}: {line.strip()}")
            except Exception:
                pass
