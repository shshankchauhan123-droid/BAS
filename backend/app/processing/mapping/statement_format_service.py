from sqlalchemy.orm import Session

from app.processing.mapping.mapping_service import (
    find_or_create_rule_mapping,
)
from app.processing.pdf.column_detector import DetectedTable


def process_detected_table(
    db: Session,
    detected_table: DetectedTable,
    bank_name: str | None = None,
):
    """
    Connect a detected PDF table to the mapping registry.

    Flow:

        DetectedTable
            ↓
        Generate fingerprint
            ↓
        Check mapping registry
            ↓
        Create/reuse mapping
    """

    if not detected_table:
        raise ValueError("Detected table is required")

    if not detected_table.columns:
        raise ValueError("Detected table has no columns")

    headers = [
        column.source_header
        for column in detected_table.columns
    ]

    print("=" * 60)
    print("DETECTED PDF HEADERS")
    print("=" * 60)

    for column in detected_table.columns:
        print(
            f"- {column.source_header}"
            f" -> {column.target_field}"
            f" (x={column.x_position})"
        )

    result = find_or_create_rule_mapping(
        db=db,
        detected_table=detected_table,
        bank_name=bank_name,
    )

    return {
        "page_number": detected_table.page_number,
        "header_y_position": detected_table.header_y_position,
        "headers": headers,
        "mapping_result": result,
    }