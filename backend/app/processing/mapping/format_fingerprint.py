import hashlib
import re

from app.processing.pdf.column_detector import DetectedTable


def _normalize_header(value: str) -> str:
    if not value:
        return ""

    value = value.strip().lower()
    value = value.replace("_", " ")
    value = value.replace("-", " ")

    value = re.sub(r"[^\w\s]", "", value)
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def generate_format_fingerprint(
    detected_table: DetectedTable,
) -> str:

    if detected_table is None:
        raise ValueError(
            "Detected table is required"
        )

    if not detected_table.columns:
        raise ValueError(
            "Detected table has no columns"
        )

    fingerprint_parts = []

    for index, column in enumerate(
        detected_table.columns,
        start=1,
    ):

        source_header = _normalize_header(
            column.source_header
        )

        target_field = (
            column.target_field or ""
        ).strip().lower()

        x_position = round(
            float(column.x_position),
            1,
        )

        fingerprint_parts.append(
            f"{index}:"
            f"{source_header}:"
            f"{target_field}:"
            f"{x_position}"
        )

    if not fingerprint_parts:
        raise ValueError(
            "No columns available for fingerprint"
        )

    fingerprint_source = "|".join(
        fingerprint_parts
    )

    print("=" * 60)
    print("FINGERPRINT SOURCE")
    print(fingerprint_source)
    print("=" * 60)

    return hashlib.sha256(
        fingerprint_source.encode("utf-8")
    ).hexdigest()