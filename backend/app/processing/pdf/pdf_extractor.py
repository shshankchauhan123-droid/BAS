from pathlib import Path

import pymupdf


class PDFExtractionResult:
    def __init__(
        self,
        file_path: str,
        page_count: int,
        page_texts: list[str],
        total_characters: int,
    ):
        self.file_path = file_path
        self.page_count = page_count
        self.page_texts = page_texts
        self.total_characters = total_characters

    @property
    def is_text_pdf(self) -> bool:
        return self.total_characters > 100

    @property
    def requires_ocr(self) -> bool:
        return not self.is_text_pdf


def extract_pdf_text(
    file_path: str,
) -> PDFExtractionResult:

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"PDF file not found: {file_path}"
        )

    if not path.is_file():
        raise ValueError(
            f"Path is not a file: {file_path}"
        )

    if path.suffix.lower() != ".pdf":
        raise ValueError(
            f"Expected PDF file, got: {path.suffix}"
        )

    page_texts: list[str] = []
    total_characters = 0

    with pymupdf.open(file_path) as document:

        page_count = len(document)

        for page_number, page in enumerate(
            document,
            start=1,
        ):

            text = page.get_text("text")

            if text is None:
                text = ""

            text = text.strip()

            page_texts.append(text)

            total_characters += len(text)

    return PDFExtractionResult(
        file_path=file_path,
        page_count=page_count,
        page_texts=page_texts,
        total_characters=total_characters,
    )