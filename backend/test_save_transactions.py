from decimal import Decimal

from app.core.database import SessionLocal
from app.files.file_repository import get_file_by_id

from app.processing.pdf.pdf_extractor import extract_pdf_text
from app.processing.pdf.pdf_table_extractor import extract_pdf_pages
from app.processing.parser.transaction_parser import parse_bank_statement

from app.bank_transactions.bank_transaction_service import (
    save_parsed_transactions,
)
from app.bank_transactions.bank_transaction_repository import (
    delete_transactions_by_file,
)

from app.case.case_model import Case


FILE_ID = 102


def main():
    db = SessionLocal()

    try:
        print("=" * 60)
        print("SAVE CORRECTED BANK TRANSACTIONS")
        print("=" * 60)

        # --------------------------------------------------
        # 1. Load file
        # --------------------------------------------------

        file = get_file_by_id(
            db=db,
            file_id=FILE_ID,
        )

        if not file:
            raise ValueError(
                f"File with ID {FILE_ID} not found"
            )

        print(f"File ID: {file.id}")
        print(f"File name: {file.original_filename}")
        print(f"Case ID: {file.case_id}")

        # --------------------------------------------------
        # 2. Extract PDF
        # --------------------------------------------------

        print("\nExtracting PDF...")

        extraction_result = extract_pdf_text(
            file_path=file.file_path,
        )

        print(
            f"Pages: {extraction_result.page_count}"
        )

        print(
            f"Characters: "
            f"{extraction_result.total_characters}"
        )

        # --------------------------------------------------
        # 3. Extract PDF structure
        # --------------------------------------------------

        print("\nExtracting PDF structure...")

        document = extract_pdf_pages(
            file_path=file.file_path,
        )

        print(
            f"PDF pages: {document.page_count}"
        )

        # --------------------------------------------------
        # 4. Parse transactions
        # --------------------------------------------------

        print("\nParsing transactions...")

        parsed_transactions = parse_bank_statement(
            document
        )

        print(
            f"\nParsed transactions: "
            f"{len(parsed_transactions)}"
        )

        # --------------------------------------------------
        # 5. Safety check
        # --------------------------------------------------

        if len(parsed_transactions) != 924:
            raise ValueError(
                "Unexpected transaction count. "
                f"Expected 924, got "
                f"{len(parsed_transactions)}. "
                "Database was NOT modified."
            )

        print(
            "\nTransaction count verified: 924"
        )

        # --------------------------------------------------
        # 6. Check final transaction
        # --------------------------------------------------

        last_transaction = parsed_transactions[-1]

        print("\nLAST PARSED TRANSACTION")
        print("-" * 60)

        print(
            f"Date: {last_transaction.transaction_date}"
        )

        print(
            f"Debit: {last_transaction.debit}"
        )

        print(
            f"Credit: {last_transaction.credit}"
        )

        print(
            f"Balance: {last_transaction.balance}"
        )

        print(
            f"Description: "
            f"{last_transaction.description}"
        )

        print(
            f"Page: {last_transaction.source_page}"
        )

        print(
            f"Row: {last_transaction.source_row}"
        )

        # --------------------------------------------------
        # 7. Safety check for footer contamination
        # --------------------------------------------------

        description = (
            last_transaction.description or ""
        ).upper()

        if "TRANSACTION TOTAL" in description:
            raise ValueError(
                "Footer text detected in final transaction. "
                "Database was NOT modified."
            )

        if "CLOSING BALANCE" in description:
            raise ValueError(
                "Closing balance text detected in "
                "final transaction. "
                "Database was NOT modified."
            )

        if last_transaction.debit is not None:
            raise ValueError(
                "Final transaction unexpectedly has "
                f"debit={last_transaction.debit}. "
                "Database was NOT modified."
            )

        if last_transaction.credit != Decimal("662.28"):
            raise ValueError(
                "Unexpected final credit amount. "
                f"Expected 662.28, got "
                f"{last_transaction.credit}. "
                "Database was NOT modified."
            )

        if last_transaction.balance != Decimal("2397.57"):
            raise ValueError(
                "Unexpected final balance. "
                f"Expected 2397.57, got "
                f"{last_transaction.balance}. "
                "Database was NOT modified."
            )

        print(
            "\nFinal transaction verified."
        )

        # --------------------------------------------------
        # 8. Delete old transactions
        # --------------------------------------------------

        print(
            "\nDeleting old database transactions..."
        )

        deleted_count = delete_transactions_by_file(
            db=db,
            file_id=file.id,
        )

        print(
            f"Deleted transactions: "
            f"{deleted_count}"
        )

        # --------------------------------------------------
        # 9. Save corrected transactions
        # --------------------------------------------------

        print(
            "\nSaving corrected transactions..."
        )

        saved_transactions = save_parsed_transactions(
            db=db,
            parsed_transactions=parsed_transactions,
            file_id=file.id,
            case_id=file.case_id,
        )

        print(
            f"Saved transactions: "
            f"{len(saved_transactions)}"
        )

        # --------------------------------------------------
        # 10. Final result
        # --------------------------------------------------

        print("\n" + "=" * 60)
        print("SAVE COMPLETED SUCCESSFULLY")
        print("=" * 60)

        print(
            f"Old rows deleted: {deleted_count}"
        )

        print(
            f"New rows inserted: "
            f"{len(saved_transactions)}"
        )

    except Exception as error:
        db.rollback()

        print("\n" + "=" * 60)
        print("ERROR")
        print("=" * 60)

        print(error)

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()