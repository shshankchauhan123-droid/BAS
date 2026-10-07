filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\files\files_router.py'
import os
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        print("files_router.py found")
        content = f.read()
        if ".txt" in content:
            print(".txt found in files_router")
        else:
            print(".txt NOT found in files_router")
else:
    print("files_router.py not found")
