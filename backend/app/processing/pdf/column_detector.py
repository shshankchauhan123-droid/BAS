from dataclasses import dataclass

from app.processing.mapping.mapping_engine import find_target_field
from app.processing.pdf.pdf_table_extractor import PDFPageContent


@dataclass
class DetectedColumn:
    source_header: str
    target_field: str
    x_position: float
    left_boundary: float | None = None
    right_boundary: float | None = None

@dataclass
class DetectedTable:
    page_number: int
    header_y_position: float
    columns: list[DetectedColumn]


def _find_header_words(page: PDFPageContent) -> list:
    """
    Find words that are likely to belong to the transaction header.

    We look for known universal fields rather than relying on
    fixed PDF coordinates.
    """

    header_words = []

    for word in page.words:

        target_field = find_target_field(word.text)

        if target_field:
            header_words.append(word)

        elif word.text.strip().lower() in {
            "tran",
            "date",
            "chq",
            "no",
            "init.",
            "br",
        }:
            header_words.append(word)

    return header_words


def detect_transaction_table(
    page: PDFPageContent,
) -> DetectedTable | None:

    words = _find_header_words(page)

    if not words:
        return None

    # --------------------------------------------------------
    # Find the main transaction-header Y position.
    #
    # Most transaction headers are on the same visual line.
    # --------------------------------------------------------

    y_groups = []

    y_tolerance = 3.0

    for word in sorted(words, key=lambda w: w.y0):

        placed = False

        for group in y_groups:

            group_y = group[0].y0

            if abs(word.y0 - group_y) <= y_tolerance:
                group.append(word)
                placed = True
                break

        if not placed:
            y_groups.append([word])

    # The group with the most header words is our main header.
    main_group = max(
        y_groups,
        key=len,
    )

    main_group = sorted(
        main_group,
        key=lambda w: w.x0,
    )

    columns: list[DetectedColumn] = []

    used_indexes: set[int] = set()

    # --------------------------------------------------------
    # Handle normal single-word headers.
    # --------------------------------------------------------

    for index, word in enumerate(main_group):

        if index in used_indexes:
            continue

        target_field = find_target_field(word.text)

        if target_field:

            columns.append(
                DetectedColumn(
                    source_header=word.text,
                    target_field=target_field,
                    x_position=word.x0,
                )
            )

            used_indexes.add(index)

    # --------------------------------------------------------
    # Handle two-word headers:
    #
    # Tran + Date
    # Chq + No
    # --------------------------------------------------------

    for index in range(len(main_group) - 1):

        if index in used_indexes:
            continue

        next_index = index + 1

        if next_index in used_indexes:
            continue

        first = main_group[index]
        second = main_group[next_index]

        combined = f"{first.text} {second.text}"

        target_field = find_target_field(combined)

        if target_field:

            columns.append(
                DetectedColumn(
                    source_header=combined,
                    target_field=target_field,
                    x_position=first.x0,
                )
            )

            used_indexes.add(index)
            used_indexes.add(next_index)

    # --------------------------------------------------------
    # Handle "Init." + "Br".
    #
    # In this PDF they are vertically split.
    # We use the X position of "Init.".
    # --------------------------------------------------------

    init_word = None

    for word in words:

        if word.text.strip().lower() == "init.":

            init_word = word
            break

    if init_word:

        already_exists = any(
            column.target_field == "alpha"
            for column in columns
        )

        if not already_exists:

            columns.append(
                DetectedColumn(
                    source_header="Init. Br",
                    target_field="alpha",
                    x_position=init_word.x0,
                )
            )

    # --------------------------------------------------------
    # Remove duplicate target fields.
    # Keep the first detected occurrence.
    # --------------------------------------------------------

    unique_columns = []

    seen_fields = set()

    for column in sorted(
        columns,
        key=lambda column: column.x_position,
    ):

        if column.target_field in seen_fields:
            continue

        seen_fields.add(column.target_field)

        unique_columns.append(column)

    # Need at least three meaningful transaction columns.
    if len(unique_columns) < 3:
        return None

    header_y_position = main_group[0].y0

    return DetectedTable(
        page_number=page.page_number,
        header_y_position=header_y_position,
        columns=unique_columns,
    )