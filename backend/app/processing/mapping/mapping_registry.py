import json

from sqlalchemy.orm import Session

from app.models.statement_format_mapping import StatementFormatMapping
from app.processing.mapping.mapping_models import StatementMapping


def get_mapping_by_fingerprint(
    db: Session,
    format_fingerprint: str,
) -> StatementMapping | None:
    """
    Find a saved mapping using its format fingerprint.

    The mapping is stored in PostgreSQL as JSON and converted
    back into a StatementMapping object when retrieved.
    """

    record = (
        db.query(StatementFormatMapping)
        .filter(
            StatementFormatMapping.format_fingerprint
            == format_fingerprint
        )
        .first()
    )

    if record is None:
        return None

    try:
        mapping_data = json.loads(
            record.mapping_json
        )

        return StatementMapping.model_validate(
            mapping_data
        )

    except (json.JSONDecodeError, TypeError, ValueError) as error:
        raise ValueError(
            "Invalid mapping data stored for "
            f"fingerprint '{format_fingerprint}': {error}"
        ) from error


def save_mapping(
    db: Session,
    format_fingerprint: str,
    mapping: StatementMapping,
) -> StatementMapping:
    """
    Save or update a statement mapping in the registry.

    The complete StatementMapping object is stored as JSON.
    This includes:

        - source_headers
        - column_mappings
        - unknown_headers
        - requires_fallback
        - confidence
        - mapping_source
    """

    existing = (
        db.query(StatementFormatMapping)
        .filter(
            StatementFormatMapping.format_fingerprint
            == format_fingerprint
        )
        .first()
    )

    mapping_json = json.dumps(
        mapping.model_dump(),
        ensure_ascii=False,
    )

    # ========================================================
    # UPDATE EXISTING MAPPING
    # ========================================================

    if existing:

        existing.bank_name = mapping.bank_name
        existing.mapping_json = mapping_json
        existing.confidence = str(
            mapping.confidence
        )
        existing.mapping_source = (
            mapping.mapping_source
        )

        db.commit()
        db.refresh(existing)

        return mapping

    # ========================================================
    # CREATE NEW MAPPING
    # ========================================================

    record = StatementFormatMapping(
        format_fingerprint=format_fingerprint,
        bank_name=mapping.bank_name,
        mapping_json=mapping_json,
        confidence=str(
            mapping.confidence
        ),
        mapping_source=mapping.mapping_source,
    )

    db.add(record)

    db.commit()
    db.refresh(record)

    return mapping