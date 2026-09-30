from dataclasses import dataclass

from app.processing.mapping.mapping_engine import find_target_field
from app.processing.pdf.pdf_table_extractor import PDFPageContent


@dataclass
class DetectedColumn:
    source_header: str
    target_field: str
    x_position: float
    header_x0: float = 0.0
    header_x1: float = 0.0
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


def _calculate_column_boundaries(columns: list[DetectedColumn]) -> None:
    """
    Calculate the horizontal boundaries (left_boundary and right_boundary)
    between detected columns.
    """
    if not columns:
        return

    cols = sorted(
        columns,
        key=lambda c: c.header_x0 if c.header_x0 else c.x_position,
    )

    for i in range(len(cols) - 1):
        left_col = cols[i]
        right_col = cols[i + 1]

        lx0 = left_col.header_x0 if left_col.header_x0 else left_col.x_position
        lx1 = left_col.header_x1 if left_col.header_x1 else (lx0 + 30.0)
        rx0 = right_col.header_x0 if right_col.header_x0 else right_col.x_position
        rx1 = right_col.header_x1 if right_col.header_x1 else (rx0 + 30.0)

        lf = left_col.target_field
        rf = right_col.target_field

        if lf == "cheque_number" and rf in ("description", "particulars"):
            # Cheque numbers are short and contained within their column.
            # Description starts immediately after cheque_number column.
            boundary = lx1 + 6.0
        elif lf in ("description", "particulars") and rf in ("debit", "credit", "amount"):
            # Description text can be wide; debit column header marks the numeric column start.
            boundary = rx0 - 15.0
        elif rf in ("alpha", "branch", "code") and lf in ("balance", "amount", "credit"):
            # Narrow trailing metadata column (like Init. Br) starts at its header;
            # Balance numbers end right before it.
            boundary = rx0 - 3.0
        else:
            if lx1 < rx0:
                boundary = (lx1 + rx0) / 2.0
            else:
                boundary = (left_col.x_position + right_col.x_position) / 2.0

        left_col.right_boundary = boundary
        right_col.left_boundary = boundary

    cols[0].left_boundary = None
    cols[-1].right_boundary = None


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
    # Handle two-word headers first (e.g., Tran Date, Chq No)
    # so multi-word headers are not split into single words.
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

            second_x1 = getattr(second, "x1", second.x0 + 30.0)

            columns.append(
                DetectedColumn(
                    source_header=combined,
                    target_field=target_field,
                    x_position=first.x0,
                    header_x0=first.x0,
                    header_x1=second_x1,
                )
            )

            used_indexes.add(index)
            used_indexes.add(next_index)

    # --------------------------------------------------------
    # Handle normal single-word headers.
    # --------------------------------------------------------

    for index, word in enumerate(main_group):

        if index in used_indexes:
            continue

        target_field = find_target_field(word.text)

        if target_field:

            word_x1 = getattr(word, "x1", word.x0 + 30.0)

            columns.append(
                DetectedColumn(
                    source_header=word.text,
                    target_field=target_field,
                    x_position=word.x0,
                    header_x0=word.x0,
                    header_x1=word_x1,
                )
            )

            used_indexes.add(index)

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

            init_x1 = getattr(init_word, "x1", init_word.x0 + 30.0)

            columns.append(
                DetectedColumn(
                    source_header="Init. Br",
                    target_field="alpha",
                    x_position=init_word.x0,
                    header_x0=init_word.x0,
                    header_x1=init_x1,
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

    # Calculate left and right column boundaries
    _calculate_column_boundaries(unique_columns)

    header_y_position = main_group[0].y0

    return DetectedTable(
        page_number=page.page_number,
        header_y_position=header_y_position,
        columns=unique_columns,
    )