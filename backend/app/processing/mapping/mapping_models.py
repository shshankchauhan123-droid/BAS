from typing import Optional

from pydantic import BaseModel, Field


class ColumnMapping(BaseModel):
    """
    Maps one source column from a bank statement
    to one field in our universal schema.
    """

    source_column: str

    target_field: str

    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
    )


class StatementMapping(BaseModel):
    """
    Complete mapping definition for a bank statement format.

    The mapping can contain:
    - columns successfully understood by the rule engine
    - columns that could not be understood
    - an indication that fallback processing is required
    """

    bank_name: Optional[str] = None

    source_headers: list[str] = Field(
        default_factory=list
    )

    column_mappings: list[ColumnMapping] = Field(
        default_factory=list
    )

    # Headers that the rule engine could not understand.
    # These can later be sent to Qwen for mapping.
    unknown_headers: list[str] = Field(
        default_factory=list
    )

    # True when one or more headers require fallback
    # processing such as Qwen.
    requires_fallback: bool = False

    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
    )

    # Current possible values:
    # rule / qwen / hybrid / manual
    mapping_source: str = "rule"