from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_model import BankTransaction


FILE_ID = 102


def main():
    db = SessionLocal()

    try:
        transactions = (
            db.query(BankTransaction)
            .filter(BankTransaction.file_id == FILE_ID)
            .order_by(BankTransaction.source_row.asc())
            .all()
        )

        print("=" * 60)
        print("DATABASE CHECK")
        print("=" * 60)

        print(f"File ID: {FILE_ID}")
        print(f"Transactions in database: {len(transactions)}")

        print("\nLAST 5 DATABASE TRANSACTIONS")
        print("-" * 60)

        for transaction in transactions[-5:]:
            print(
                f"ID: {transaction.id}\n"
                f"Date: {transaction.transaction_date}\n"
                f"Debit: {transaction.debit}\n"
                f"Credit: {transaction.credit}\n"
                f"Balance: {transaction.balance}\n"
                f"Description: {transaction.description}\n"
                f"Page: {transaction.source_page}\n"
                f"Row: {transaction.source_row}\n"
            )

    finally:
        db.close()


if __name__ == "__main__":
    main()