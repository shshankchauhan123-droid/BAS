from pathlib import Path

from app.processing.pdf.pdf_extractor import (
    extract_pdf_text,
    extract_pdf_pages,
)


def process_document(
    file_id: int,
    file_path: str,
):
    """
    Main document-processing entry point.

    At this stage we only:
        1. Identify file type
        2. Extract PDF text
        3. Extract PDF structure
        4. Log actual extracted data

    Later this service will continue with:
        table rebuilding
        column understanding
        mapping
        Qwen fallback
        normalization
        validation
        transaction persistence
    """

    print("\n" + "=" * 90)
    print("DOCUMENT PROCESSING SERVICE STARTED")
    print("=" * 90)

    print(f"FILE ID   : {file_id}")
    print(f"FILE PATH : {file_path}")

    physical_file = Path(file_path)

    # ------------------------------------------------------
    # 1. VERIFY FILE
    # ------------------------------------------------------

    print("\n" + "-" * 90)
    print("DOCUMENT FILE CHECK")
    print("-" * 90)

    print(f"EXISTS : {physical_file.exists()}")
    print(f"IS FILE: {physical_file.is_file()}")

    if not physical_file.exists():
        raise FileNotFoundError(
            f"Physical file not found: {file_path}"
        )

    if not physical_file.is_file():
        raise ValueError(
            f"Path is not a file: {file_path}"
        )

    extension = physical_file.suffix.lower()

    print(f"EXTENSION: {extension}")

    # ------------------------------------------------------
    # 2. FILE TYPE
    # ------------------------------------------------------

    if extension != ".pdf":
        raise ValueError(
            f"Currently only PDF processing is "
            f"implemented. Received: {extension}"
        )

    # ------------------------------------------------------
    # 3. PDF TEXT EXTRACTION
    # ------------------------------------------------------

    print("\n" + "=" * 90)
    print("STAGE 1 — PDF TEXT EXTRACTION")
    print("=" * 90)

    extraction_result = extract_pdf_text(
        file_path=str(physical_file)
    )

    print("\nPDF TEXT EXTRACTION RESULT")
    print("-" * 90)

    print(
        f"PAGES        : "
        f"{extraction_result.page_count}"
    )

    print(
        f"CHARACTERS   : "
        f"{extraction_result.total_characters}"
    )

    print(
        f"TEXT PDF     : "
        f"{extraction_result.is_text_pdf}"
    )

    print(
        f"OCR REQUIRED : "
        f"{extraction_result.requires_ocr}"
    )

    # ------------------------------------------------------
    # 4. PDF STRUCTURE EXTRACTION
    # ------------------------------------------------------

    print("\n" + "=" * 90)
    print("STAGE 2 — PDF STRUCTURE EXTRACTION")
    print("=" * 90)

    document = extract_pdf_pages(
        file_path=str(physical_file)
    )

    print("\nPDF STRUCTURE RESULT")
    print("-" * 90)

    print(
        f"PAGE COUNT: {document.page_count}"
    )

    # ------------------------------------------------------
    # 5. SHOW ACTUAL PAGE DATA
    # ------------------------------------------------------

    print("\n" + "=" * 90)
    print("STAGE 3 — RAW PDF DATA INSPECTION")
    print("=" * 90)

    print(
        "Showing first 2 pages only."
    )

    for page in document.pages[:2]:

        print("\n" + "#" * 90)
        print(
            f"PAGE NUMBER: {page.page_number}"
        )
        print("#" * 90)

        # --------------------------------------------------
        # Page text
        # --------------------------------------------------

        page_text = getattr(
            page,
            "text",
            "",
        )

        print("\nPAGE TEXT")
        print("-" * 90)

        print(
            page_text[:3000]
        )

        if len(page_text) > 3000:
            print(
                "\n...[PAGE TEXT TRUNCATED]..."
            )

        # --------------------------------------------------
        # Page words
        # --------------------------------------------------

        page_words = getattr(
            page,
            "words",
            [],
        )

        print("\nPAGE WORD INFORMATION")
        print("-" * 90)

        print(
            f"TOTAL WORDS: "
            f"{len(page_words)}"
        )

        print(
            "\nFIRST 50 WORDS:"
        )

        for index, word in enumerate(
            page_words[:50],
            start=1,
        ):

            print(
                f"{index:03d}. {word}"
            )

    # ------------------------------------------------------
    # 6. DOCUMENT SUMMARY
    # ------------------------------------------------------

    total_words = 0

    for page in document.pages:
        total_words += len(
            getattr(
                page,
                "words",
                [],
            )
        )

    print("\n" + "=" * 90)
    print("RAW EXTRACTION SUMMARY")
    print("=" * 90)

    print(
        f"FILE ID          : {file_id}"
    )

    print(
        f"FILE TYPE        : PDF"
    )

    print(
        f"TOTAL PAGES      : "
        f"{document.page_count}"
    )

    print(
        f"TOTAL CHARACTERS : "
        f"{extraction_result.total_characters}"
    )

    print(
        f"TOTAL WORDS      : "
        f"{total_words}"
    )

    print(
        f"OCR REQUIRED     : "
        f"{extraction_result.requires_ocr}"
    )

    print("=" * 90)
    print(
        "DOCUMENT RAW EXTRACTION COMPLETED"
    )
    print("=" * 90)

    # ------------------------------------------------------
    # IMPORTANT
    # ------------------------------------------------------
    #
    # We intentionally STOP here.
    #
    # No:
    #   fingerprint
    #   mapping
    #   Qwen
    #   transaction parser
    #   transaction database save
    #
    # Those will be added in later stages.
    # ------------------------------------------------------

    return {
        "file_id": file_id,
        "file_type": "pdf",
        "document": document,
        "extraction_result": extraction_result,
        "page_count": document.page_count,
        "total_characters": (
            extraction_result.total_characters
        ),
        "total_words": total_words,
        "requires_ocr": (
            extraction_result.requires_ocr
        ),
    }