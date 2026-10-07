import sys
sys.path.append(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend')
from app.core.database import SessionLocal
from app.files.file_model import File

db = SessionLocal()
files = db.query(File).filter(File.original_filename.like('%BALBIR%')).all()
for f in files:
    print(f.id, f.original_filename, f.file_path)
db.close()
