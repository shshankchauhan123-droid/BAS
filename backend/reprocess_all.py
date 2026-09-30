import sys
from pathlib import Path

# Important: Import all models so SQLAlchemy resolves all ForeignKeys in Base.metadata
from app.user.user_model import User
from app.case.case_model import Case
from app.io_master.io_master_model import IOMaster
from app.files.file_model import File
from app.models.statement_format_mapping import StatementFormatMapping
from app.bank_transactions.bank_transaction_model import BankTransaction

from app.core.database import SessionLocal
from app.processing.pdf.pdf_table_extractor import extract_pdf_pages
from app.processing.pdf.column_detector import detect_transaction_table
from app.processing.parser.transaction_parser import parse_bank_statement
from app.processing.mapping.mapping_engine import build_statement_mapping
from app.bank_transactions.bank_transaction_service import save_parsed_transactions


def reprocess_file(db, file: File):
    print("=" * 60)
    print(f"REPROCESSING FILE ID: {file.id} ({file.original_filename})")
    print("=" * 60)

    pdf_path = Path(file.file_path)
    if not pdf_path.exists():
        pdf_path = Path(__file__).resolve().parent / file.file_path
    if not pdf_path.exists():
        pdf_path = Path("backend") / file.file_path
    if not pdf_path.exists():
        print(f"File not found on disk: {file.file_path} (checked {pdf_path})")
        return

    doc = extract_pdf_pages(str(pdf_path))
    table = None
    for page in doc.pages:
        table = detect_transaction_table(page)
        if table:
            break

    if not table:
        print(f"No transaction table detected for file {file.id}")
        return

    mapping = build_statement_mapping([c.source_header for c in table.columns])
    parsed_transactions = parse_bank_statement(
        document=doc,
        detected_table=table,
        statement_mapping=mapping,
    )

    print(f"Extracted {len(parsed_transactions)} transactions.")

    saved = save_parsed_transactions(
        db=db,
        parsed_transactions=parsed_transactions,
        file_id=file.id,
        case_id=file.case_id,
    )

    print(f"Successfully saved {len(saved)} transactions for file {file.id}!")


def main():
    db = SessionLocal()
    try:
        target_file_id = int(sys.argv[1]) if len(sys.argv) > 1 else None

        if target_file_id:
            files = db.query(File).filter(File.id == target_file_id).all()
        else:
            files = db.query(File).all()

        if not files:
            print("No files found in database.")
            return

        for file in files:
            reprocess_file(db, file)

        print("\nAll files reprocessed successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    main()
