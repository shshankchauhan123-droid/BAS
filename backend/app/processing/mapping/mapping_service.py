from sqlalchemy.orm import Session

from app.processing.mapping.format_fingerprint import (
    generate_format_fingerprint,
)
from app.processing.mapping.mapping_engine import (
    build_statement_mapping,
)
from app.processing.mapping.mapping_repository import (
    create_mapping,
    get_mapping_by_fingerprint,
)
from app.processing.pdf.column_detector import DetectedTable


def find_or_create_rule_mapping(
    db: Session,
    detected_table: DetectedTable,
    bank_name: str | None = None,
):
    """
    Find an existing mapping for a detected statement format.

    Flow:

        DetectedTable
            ↓
        Generate fingerprint
            ↓
        Check registry
            ↓
        FOUND → reuse mapping

        NOT FOUND
            ↓
        Rule-based mapping
            ↓
        Save mapping
    """

    if not detected_table:
        raise ValueError("Detected table is required")

    if not detected_table.columns:
        raise ValueError("Detected table has no columns")

    # ---------------------------------------------------------
    # 1. Generate format fingerprint
    # ---------------------------------------------------------

    fingerprint = generate_format_fingerprint(
        detected_table
    )

    print("=" * 60)
    print("FORMAT FINGERPRINT")
    print("=" * 60)
    print(f"Fingerprint: {fingerprint}")

    # ---------------------------------------------------------
    # 2. Extract source headers
    # ---------------------------------------------------------

    headers = [
        column.source_header
        for column in detected_table.columns
    ]

    # ---------------------------------------------------------
    # 3. Check mapping registry
    # ---------------------------------------------------------

    existing_mapping = get_mapping_by_fingerprint(
        db=db,
        fingerprint=fingerprint,
    )

    if existing_mapping:
        print("Mapping found in registry")
        print(f"Mapping ID: {existing_mapping.id}")
        print(
            f"Mapping source: "
            f"{existing_mapping.mapping_source}"
        )
        print("=" * 60)

        return {
            "status": "FOUND",
            "is_new_format": False,
            "requires_llm": False,
            "fingerprint": fingerprint,
            "mapping_record": existing_mapping,
        }

    # ---------------------------------------------------------
    # 4. New format
    # ---------------------------------------------------------

    print("Mapping NOT found in registry")
    print("New statement format detected")

    # ---------------------------------------------------------
    # 5. Build rule-based mapping
    # ---------------------------------------------------------

    statement_mapping = build_statement_mapping(
        headers=headers,
        bank_name=bank_name,
    )

    mapping_dict = {
        item.source_column: item.target_field
        for item in statement_mapping.column_mappings
    }

    # ---------------------------------------------------------
    # 6. No rule mapping
    # ---------------------------------------------------------

    if not mapping_dict:
        print("No rule-based mapping found")
        print("This format will require Qwen later")
        print("=" * 60)

        return {
            "status": "UNKNOWN",
            "is_new_format": True,
            "requires_llm": True,
            "fingerprint": fingerprint,
            "mapping_record": None,
            "mapping": None,
        }

    # ---------------------------------------------------------
    # 7. Save mapping
    # ---------------------------------------------------------

    mapping_record = create_mapping(
        db=db,
        fingerprint=fingerprint,
        mapping=mapping_dict,
        bank_name=bank_name,
        confidence=statement_mapping.confidence,
        mapping_source="rule",
    )

    print("New rule-based mapping saved")
    print(f"Mapping ID: {mapping_record.id}")
    print("=" * 60)

    return {
        "status": "CREATED",
        "is_new_format": True,
        "requires_llm": False,
        "fingerprint": fingerprint,
        "mapping_record": mapping_record,
        "mapping": mapping_dict,
    }