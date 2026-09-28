from app.core.database import SessionLocal
from app.bank_transactions.bank_transaction_repository import (
    get_transactions_by_file,
)


FILE_ID = 102


def main():

    db = SessionLocal()

    try:

        transactions = get_transactions_by_file(
            db=db,
            file_id=FILE_ID,
        )

        print("=" * 60)
        print("BANK TRANSACTION VERIFICATION")
        print("=" * 60)

        print(f"File ID: {FILE_ID}")
        print(f"Total transactions: {len(transactions)}")

        # --------------------------------------------------
        # First 5 transactions
        # --------------------------------------------------

        print("\nFIRST 5 TRANSACTIONS")
        print("-" * 60)

        for transaction in transactions[:5]:

            print(
                f"ID={transaction.id} | "
                f"Date={transaction.transaction_date} | "
                f"Debit={transaction.debit} | "
                f"Credit={transaction.credit} | "
                f"Balance={transaction.balance}"
            )

            print(
                f"Description: "
                f"{transaction.description}"
            )

            print(
                f"Page={transaction.source_page} | "
                f"Row={transaction.source_row}"
            )

            print("-" * 60)

        # --------------------------------------------------
        # Last 5 transactions
        # --------------------------------------------------

        print("\nLAST 5 TRANSACTIONS")
        print("-" * 60)

        for transaction in transactions[-5:]:

            print(
                f"ID={transaction.id} | "
                f"Date={transaction.transaction_date} | "
                f"Debit={transaction.debit} | "
                f"Credit={transaction.credit} | "
                f"Balance={transaction.balance}"
            )

            print(
                f"Description: "
                f"{transaction.description}"
            )

            print(
                f"Page={transaction.source_page} | "
                f"Row={transaction.source_row}"
            )

            print("-" * 60)

        # --------------------------------------------------
        # Transactions without debit or credit
        # --------------------------------------------------

        no_amount_transactions = [
            transaction
            for transaction in transactions
            if transaction.debit is None
            and transaction.credit is None
        ]

        print("\nTRANSACTIONS WITHOUT DEBIT/CREDIT")
        print("-" * 60)

        print(
            f"Count: "
            f"{len(no_amount_transactions)}"
        )

        for transaction in no_amount_transactions:

            print(
                f"ID={transaction.id} | "
                f"Date={transaction.transaction_date} | "
                f"Balance={transaction.balance}"
            )

            print(
                f"Description: "
                f"{transaction.description}"
            )

            print(
                f"Page={transaction.source_page} | "
                f"Row={transaction.source_row}"
            )

            print("-" * 60)

        # --------------------------------------------------
        # Possible footer / summary transactions
        # --------------------------------------------------

        footer_transactions = [
            transaction
            for transaction in transactions
            if transaction.description
            and (
                "TRANSACTION TOTAL" in transaction.description.upper()
                or "CLOSING BALANCE" in transaction.description.upper()
            )
        ]

        print("\nPOSSIBLE FOOTER / SUMMARY ROWS")
        print("-" * 60)

        print(
            f"Count: "
            f"{len(footer_transactions)}"
        )

        for transaction in footer_transactions:

            print(
                f"ID={transaction.id} | "
                f"Date={transaction.transaction_date} | "
                f"Debit={transaction.debit} | "
                f"Credit={transaction.credit} | "
                f"Balance={transaction.balance}"
            )

            print(
                f"Description: "
                f"{transaction.description}"
            )

            print("-" * 60)

        print("\n" + "=" * 60)
        print("VERIFICATION COMPLETE")
        print("=" * 60)

    finally:

        db.close()


if __name__ == "__main__":
    main()