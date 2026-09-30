from pathlib import Path

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.files.file_repository import get_file_by_id, update_file
from app.case.case_model import Case
from app.user.user_model import User
from app.io_master.io_master_model import IOMaster

from app.processing.pdf.pdf_extractor import extract_pdf_text
from app.processing.pdf.pdf_table_extractor import extract_pdf_pages
from app.processing.parser.transaction_parser import parse_bank_statement

from app.processing.pdf.column_detector import detect_transaction_table
from app.processing.mapping.format_fingerprint import (
    generate_format_fingerprint,
)
from app.processing.mapping.mapping_engine import (
    build_statement_mapping,
)
from app.processing.mapping.mapping_registry import (
    get_mapping_by_fingerprint,
    save_mapping,
)

from app.bank_transactions.bank_transaction_service import (
    save_parsed_transactions,
)


@celery_app.task(
    bind=True,
    name="app.tasks.process_bank_statement",
)
def process_bank_statement(
    self,
    file_id: int,
):
    db = SessionLocal()
    file = None

    try:

        # ====================================================
        # WORKER START
        # ====================================================

        print("=" * 60)
        print("BANK STATEMENT PROCESSING STARTED")
        print(f"FILE ID: {file_id}")
        print("=" * 60)

        self.update_state(
            state="PROCESSING",
            meta={
                "stage": "loading_file",
                "progress": 5,
            },
        )

        # ====================================================
        # GET FILE FROM DATABASE
        # ====================================================

        file = get_file_by_id(
            db=db,
            file_id=file_id,
        )

        if not file:
            raise ValueError(
                f"File with ID {file_id} not found"
            )

        print("=" * 60)
        print("FILE FOUND")
        print(f"FILE ID       : {file.id}")
        print(f"ORIGINAL NAME : {file.original_filename}")
        print(f"FILE PATH     : {file.file_path}")
        print(f"FILE SIZE     : {file.file_size}")
        print(f"MIME TYPE     : {file.mime_type}")
        print(f"STATUS        : {file.status}")
        print("=" * 60)

        # ====================================================
        # UPDATE STATUS → PROCESSING
        # ====================================================

        file.status = "PROCESSING"
        file.error_message = None

        update_file(
            db=db,
            file=file,
        )

        print("=" * 60)
        print("FILE STATUS UPDATED")
        print("STATUS: PROCESSING")
        print("=" * 60)

        # ====================================================
        # VERIFY PHYSICAL FILE
        # ====================================================

        physical_file = Path(
            file.file_path
        )

        if not physical_file.exists():
            raise FileNotFoundError(
                f"Physical file not found: "
                f"{file.file_path}"
            )

        if not physical_file.is_file():
            raise ValueError(
                f"Stored path is not a file: "
                f"{file.file_path}"
            )

        # ====================================================
        # CHECK FILE TYPE
        # ====================================================

        extension = physical_file.suffix.lower()

        print(
            f"FILE EXTENSION: {extension}"
        )

        # ====================================================
        # PDF PROCESSING
        # ====================================================

        if extension == ".pdf":

            # ------------------------------------------------
            # STEP 1 — PDF TEXT EXTRACTION
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "extracting_pdf_text",
                    "progress": 10,
                },
            )

            print("=" * 60)
            print("PDF TEXT EXTRACTION STARTED")
            print("=" * 60)

            extraction_result = extract_pdf_text(
                file_path=str(
                    physical_file
                )
            )

            print("=" * 60)
            print("PDF TEXT EXTRACTION COMPLETED")
            print(
                f"PAGES       : "
                f"{extraction_result.page_count}"
            )
            print(
                f"CHARACTERS  : "
                f"{extraction_result.total_characters}"
            )
            print(
                f"TEXT PDF    : "
                f"{extraction_result.is_text_pdf}"
            )
            print(
                f"OCR REQUIRED: "
                f"{extraction_result.requires_ocr}"
            )
            print("=" * 60)

            # ------------------------------------------------
            # STEP 2 — PDF STRUCTURE EXTRACTION
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "extracting_pdf_structure",
                    "progress": 25,
                },
            )

            print("=" * 60)
            print("PDF STRUCTURE EXTRACTION STARTED")
            print("=" * 60)

            document = extract_pdf_pages(
                file_path=str(
                    physical_file
                )
            )

            print("=" * 60)
            print("PDF STRUCTURE EXTRACTION COMPLETED")
            print(
                f"PAGES: {document.page_count}"
            )
            print("=" * 60)

            # ------------------------------------------------
            # STEP 3 — FORMAT DETECTION
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "detecting_statement_format",
                    "progress": 30,
                },
            )

            print("=" * 60)
            print("STATEMENT FORMAT DETECTION STARTED")
            print("=" * 60)

            detected_table = None

            # Search pages until we find the transaction header.
            for page in document.pages:

                detected_table = detect_transaction_table(
                    page
                )

                if detected_table:
                    print(
                        f"TRANSACTION HEADER FOUND "
                        f"ON PAGE: "
                        f"{page.page_number}"
                    )
                    break

            if detected_table is None:
                raise ValueError(
                    "Could not detect transaction table "
                    "format in the PDF."
                )

            print("=" * 60)
            print("TRANSACTION TABLE DETECTED")
            print(
                f"HEADER PAGE: "
                f"{detected_table.page_number}"
            )

            print("DETECTED COLUMNS:")

            for column in detected_table.columns:
                print(
                    f"  {column.source_header}"
                    f" -> "
                    f"{column.target_field}"
                    f" "
                    f"(x={column.x_position})"
                )

            print("=" * 60)

            # ------------------------------------------------
            # STEP 4 — GENERATE FORMAT FINGERPRINT
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "generating_format_fingerprint",
                    "progress": 35,
                },
            )

            print("=" * 60)
            print("GENERATING FORMAT FINGERPRINT")
            print("=" * 60)

            format_fingerprint = (
                generate_format_fingerprint(
                    detected_table
                )
            )

            print(
                f"FORMAT FINGERPRINT: "
                f"{format_fingerprint}"
            )

            print("=" * 60)

            # ------------------------------------------------
            # STEP 5 — LOOKUP EXISTING MAPPING
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "checking_mapping_registry",
                    "progress": 37,
                },
            )

            print("=" * 60)
            print("CHECKING MAPPING REGISTRY")
            print("=" * 60)

            statement_mapping = (
                get_mapping_by_fingerprint(
                    db=db,
                    format_fingerprint=(
                        format_fingerprint
                    ),
                )
            )

            # ------------------------------------------------
            # EXISTING MAPPING FOUND
            # ------------------------------------------------

            if statement_mapping:

                print("=" * 60)
                print("EXISTING MAPPING FOUND")
                print(
                    f"BANK NAME: "
                    f"{statement_mapping.bank_name}"
                )
                print(
                    f"MAPPING SOURCE: "
                    f"{statement_mapping.mapping_source}"
                )
                print(
                    f"MAPPING CONFIDENCE: "
                    f"{statement_mapping.confidence}"
                )
                print("=" * 60)

            # ------------------------------------------------
            # NEW MAPPING
            # ------------------------------------------------

            else:

                print("=" * 60)
                print("NEW FORMAT DETECTED")
                print(
                    "NO EXISTING MAPPING FOUND"
                )
                print(
                    "BUILDING RULE-BASED MAPPING"
                )
                print("=" * 60)

                headers = [
                    column.source_header
                    for column in detected_table.columns
                ]

                statement_mapping = (
                    build_statement_mapping(
                        headers=headers,
                        bank_name=None,
                    )
                )

                print("=" * 60)
                print("MAPPING CREATED")
                print(
                    f"MAPPING CONFIDENCE: "
                    f"{statement_mapping.confidence}"
                )
                print(
                    f"MAPPING SOURCE: "
                    f"{statement_mapping.mapping_source}"
                )

                print("COLUMN MAPPINGS:")

                for mapping in (
                    statement_mapping.column_mappings
                ):
                    print(
                        f"  "
                        f"{mapping.source_column}"
                        f" -> "
                        f"{mapping.target_field}"
                        f" "
                        f"(confidence="
                        f"{mapping.confidence})"
                    )

                print("=" * 60)

                # Save newly created mapping.
                save_mapping(
                    db=db,
                    format_fingerprint=(
                        format_fingerprint
                    ),
                    mapping=statement_mapping,
                )

                print("=" * 60)
                print("NEW MAPPING SAVED")
                print("=" * 60)

            # ------------------------------------------------
            # STEP 6 — PARSE TRANSACTIONS
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "parsing_transactions",
                    "progress": 40,
                    "format_fingerprint": (
                        format_fingerprint
                    ),
                },
            )

            print("=" * 60)
            print("TRANSACTION PARSING STARTED")
            print("=" * 60)

            parsed_transactions = (
                parse_bank_statement(
                    document=document,
                    detected_table=detected_table,
                    statement_mapping=statement_mapping,
                )
            )

            print("=" * 60)
            print("TRANSACTION PARSING COMPLETED")
            print(
                f"TRANSACTIONS: "
                f"{len(parsed_transactions)}"
            )
            print("=" * 60)

            # ------------------------------------------------
            # SAFETY CHECK
            # ------------------------------------------------

            if not parsed_transactions:
                raise ValueError(
                    "No transactions were extracted "
                    "from the PDF."
                )

            # ------------------------------------------------
            # STEP 7 — SAVE TRANSACTIONS
            # ------------------------------------------------

            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "saving_transactions",
                    "progress": 70,
                    "transactions": len(
                        parsed_transactions
                    ),
                },
            )

            print("=" * 60)
            print("SAVING TRANSACTIONS TO DATABASE")
            print("=" * 60)

            saved_transactions = (
                save_parsed_transactions(
                    db=db,
                    parsed_transactions=(
                        parsed_transactions
                    ),
                    file_id=file.id,
                    case_id=file.case_id,
                )
            )

            print("=" * 60)
            print("TRANSACTIONS SAVED")
            print(
                f"SAVED: "
                f"{len(saved_transactions)}"
            )
            print("=" * 60)

        else:

            raise ValueError(
                f"PDF processing is not implemented "
                f"for file type: {extension}"
            )

        # ====================================================
        # UPDATE STATUS → COMPLETED
        # ====================================================

        file.status = "COMPLETED"
        file.error_message = None

        update_file(
            db=db,
            file=file,
        )

        print("=" * 60)
        print("FILE STATUS UPDATED")
        print("STATUS: COMPLETED")
        print("=" * 60)

        self.update_state(
            state="PROCESSING",
            meta={
                "stage": "completed",
                "progress": 100,
                "pages": extraction_result.page_count,
                "characters": extraction_result.total_characters,
                "transactions": len(
                    saved_transactions
                ),
                "requires_ocr": (
                    extraction_result.requires_ocr
                ),
                "format_fingerprint": (
                    format_fingerprint
                ),
                "mapping_source": (
                    statement_mapping.mapping_source
                ),
                "mapping_confidence": (
                    statement_mapping.confidence
                ),
            },
        )

        # ====================================================
        # WORKER FINISHED
        # ====================================================

        print("=" * 60)
        print(
            "BANK STATEMENT PROCESSING COMPLETED"
        )
        print(f"FILE ID: {file_id}")
        print(
            f"TRANSACTIONS SAVED: "
            f"{len(saved_transactions)}"
        )
        print(
            f"FORMAT FINGERPRINT: "
            f"{format_fingerprint}"
        )
        print(
            f"MAPPING SOURCE: "
            f"{statement_mapping.mapping_source}"
        )
        print("=" * 60)

        return {
            "success": True,
            "file_id": file.id,
            "file_name": file.original_filename,
            "pages": extraction_result.page_count,
            "characters": extraction_result.total_characters,
            "transactions": len(
                saved_transactions
            ),
            "requires_ocr": (
                extraction_result.requires_ocr
            ),
            "format_fingerprint": (
                format_fingerprint
            ),
            "mapping_source": (
                statement_mapping.mapping_source
            ),
            "mapping_confidence": (
                statement_mapping.confidence
            ),
            "status": "COMPLETED",
            "message": (
                "PDF transactions processed "
                "and saved successfully"
            ),
        }

    except Exception as error:

        print("=" * 60)
        print("BANK STATEMENT PROCESSING FAILED")
        print(f"FILE ID: {file_id}")
        print(f"ERROR: {error}")
        print("=" * 60)

        # ====================================================
        # UPDATE STATUS → FAILED
        # ====================================================

        if file is not None:

            try:

                db.rollback()

                file = get_file_by_id(
                    db=db,
                    file_id=file_id,
                )

                if file:

                    file.status = "FAILED"
                    file.error_message = str(
                        error
                    )

                    update_file(
                        db=db,
                        file=file,
                    )

                    print("=" * 60)
                    print("FILE STATUS UPDATED")
                    print("STATUS: FAILED")
                    print(
                        f"ERROR MESSAGE: {error}"
                    )
                    print("=" * 60)

            except Exception as status_error:

                print("=" * 60)
                print(
                    "FAILED TO UPDATE FILE STATUS"
                )
                print(
                    f"STATUS ERROR: "
                    f"{status_error}"
                )
                print("=" * 60)

        raise

    finally:

        db.close()