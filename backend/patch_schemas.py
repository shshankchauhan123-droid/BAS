import pathlib

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_schema.py')
content = file_path.read_text(encoding='utf-8')

new_schemas = '''
class ModeWiseItem(BaseModel):
    mode: str
    transaction_count: int
    debit_count: int
    credit_count: int
    debit_amount: float
    credit_amount: float

class ModeWiseResponse(BaseModel):
    success: bool
    message: str
    total_transactions: int
    data: List[ModeWiseItem]
'''

if 'class ModeWiseResponse' not in content:
    content += new_schemas
    file_path.write_text(content, encoding='utf-8')
    print('Added ModeWiseResponse')
else:
    print('already exists')
