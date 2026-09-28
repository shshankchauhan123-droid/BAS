from app.core.database import SessionLocal
from app.files.file_repository import get_file_by_id
from app.processing.pdf.pdf_table_extractor import extract_pdf_pages


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

        document = extract_pdf_pages(
            file_path=file.file_path
        )

        page = document.pages[27]

        print("=" * 80)
        print("PAGE 28 WORDS")
        print("=" * 80)

        for word in page.words:

            print(
                f"x={word.x0:8.2f} "
                f"y={word.y0:8.2f} "
                f"text={word.text}"
            )

    finally:
        db.close()


if __name__ == "__main__":
    main()