import json

from sqlalchemy.orm import Session

from app.models.statement_format_mapping import StatementFormatMapping


def get_mapping_by_fingerprint(
    db: Session,
    fingerprint: str,
) -> StatementFormatMapping | None:
    """
    Find a previously learned mapping using its format fingerprint.
    """

    return (
        db.query(StatementFormatMapping)
        .filter(
            StatementFormatMapping.format_fingerprint == fingerprint
        )
        .first()
    )


def create_mapping(
    db: Session,
    fingerprint: str,
    mapping: dict,
    bank_name: str | None = None,
    confidence: float | None = None,
    mapping_source: str = "rule",
) -> StatementFormatMapping:
    """
    Save a new statement format mapping.
    """

    mapping_record = StatementFormatMapping(
        format_fingerprint=fingerprint,
        bank_name=bank_name,
        mapping_json=json.dumps(mapping),
        confidence=str(confidence) if confidence is not None else None,
        mapping_source=mapping_source,
    )

    db.add(mapping_record)
    db.commit()
    db.refresh(mapping_record)

    return mapping_record


def update_mapping(
    db: Session,
    mapping_record: StatementFormatMapping,
    mapping: dict | None = None,
    bank_name: str | None = None,
    confidence: float | None = None,
    mapping_source: str | None = None,
) -> StatementFormatMapping:
    """
    Update an existing statement format mapping.
    """

    if mapping is not None:
        mapping_record.mapping_json = json.dumps(mapping)

    if bank_name is not None:
        mapping_record.bank_name = bank_name

    if confidence is not None:
        mapping_record.confidence = str(confidence)

    if mapping_source is not None:
        mapping_record.mapping_source = mapping_source

    db.commit()
    db.refresh(mapping_record)

    return mapping_record