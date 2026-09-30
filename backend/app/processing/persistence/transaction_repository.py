from typing import List
from sqlalchemy.orm import Session
from app.bank_transactions.bank_transaction_model import BankTransaction

def delete_transactions_by_file_id(db: Session, file_id: int):
    """
    Delete all existing transactions for a file to maintain idempotency.
    """
    db.query(BankTransaction).filter(BankTransaction.file_id == file_id).delete()

def bulk_insert_transactions(db: Session, transactions: List[BankTransaction]):
    """
    Bulk insert a list of BankTransaction transaction objects.
    """
    db.bulk_save_objects(transactions)
