from app.files.file_repository import get_file_by_id
from app.core.database import SessionLocal

from app.processing.pdf.pdf_table_extractor import extract_pdf_pages
from app.processing.parser.transaction_parser import parse_bank_statement


FILE_ID = 102


def main():

    db = SessionLocal()

    try:

        file = get_file_by_id(
            db=db,
            file_id=FILE_ID,
        )

        if not file:
            raise ValueError(
                f"File {FILE_ID} not found"
            )

        print("=" * 60)
        print("PARSER TEST")
        print("=" * 60)

        print(f"File ID: {file.id}")
        print(f"File: {file.original_filename}")

        print("\nExtracting PDF structure...")

        document = extract_pdf_pages(
            file_path=file.file_path
        )

        print(
            f"Pages: {len(document.pages)}"
        )

        print("\nParsing transactions...")

        transactions = parse_bank_statement(
            document
        )

        print(
            f"\nParsed transactions: "
            f"{len(transactions)}"
        )

        print("\nLAST 5 TRANSACTIONS")
        print("-" * 60)

        for transaction in transactions[-5:]:

            print(
                f"Date: {transaction.transaction_date}"
            )

            print(
                f"Debit: {transaction.debit}"
            )

            print(
                f"Credit: {transaction.credit}"
            )

            print(
                f"Balance: {transaction.balance}"
            )

            print(
                f"Description: "
                f"{transaction.description}"
            )

            print(
                f"Page: {transaction.source_page}"
            )

            print(
                f"Row: {transaction.source_row}"
            )

            print("-" * 60)

        print("\n" + "=" * 60)
        print("PARSER TEST COMPLETE")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()