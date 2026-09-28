from dataclasses import dataclass
from pathlib import Path

import pymupdf


@dataclass
class PDFWord:
    """
    One word/token from a PDF with its position.
    """

    text: str

    x0: float
    y0: float
    x1: float
    y1: float


@dataclass
class PDFPageContent:
    page_number: int
    text: str
    lines: list[str]
    words: list[PDFWord]


@dataclass
class PDFDocumentContent:
    file_path: str
    page_count: int
    pages: list[PDFPageContent]


def extract_pdf_pages(file_path: str) -> PDFDocumentContent:
    """
    Extract PDF text, lines and word coordinates.

    This is a generic extractor.
    It does not contain bank-specific parsing logic.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"PDF file does not exist: {file_path}"
        )

    if not path.is_file():
        raise ValueError(
            f"Path is not a file: {file_path}"
        )

    if path.suffix.lower() != ".pdf":
        raise ValueError(
            f"Expected a PDF file, got: {path.suffix}"
        )

    pages: list[PDFPageContent] = []

    with pymupdf.open(file_path) as document:

        for page_number, page in enumerate(
            document,
            start=1,
        ):
            text = page.get_text("text") or ""

            text = text.strip()

            lines = [
                line.strip()
                for line in text.splitlines()
                if line.strip()
            ]

            raw_words = page.get_text("words")

            words = [
                PDFWord(
                    text=str(word[4]),
                    x0=float(word[0]),
                    y0=float(word[1]),
                    x1=float(word[2]),
                    y1=float(word[3]),
                )
                for word in raw_words
            ]

            pages.append(
                PDFPageContent(
                    page_number=page_number,
                    text=text,
                    lines=lines,
                    words=words,
                )
            )

    return PDFDocumentContent(
        file_path=str(path),
        page_count=len(pages),
        pages=pages,
    )