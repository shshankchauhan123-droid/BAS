import re
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

# 15-character Indian GSTIN regex standard pattern
# 2 digits state code + 5 chars PAN alphabetic + 4 digits PAN numeric + 1 char PAN alphabetic + 1 entity num + 'Z' + 1 checksum
GSTIN_REGEX = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)


class GstAdvanceSearchRequest(BaseModel):
    gst_number: str = Field(
        ...,
        alias="gstNumber",
        description="15-character GSTIN number (e.g. 27AAAAA0000A1Z5)",
    )
    hsn_details: bool = Field(
        True,
        alias="hsnDetails",
        description="Include HSN Goods & Services details",
    )
    branch_details: bool = Field(
        True,
        alias="branchDetails",
        description="Include principal and additional branch address details",
    )
    filing_details: bool = Field(
        True,
        alias="filingDetails",
        description="Include current and previous year filing history",
    )
    filing_frequency: bool = Field(
        True,
        alias="filingFrequency",
        description="Include filing frequency for current and last year",
    )
    liability_paid_details: bool = Field(
        True,
        alias="liabilityPaidDetails",
        description="Include liability paid percentages across periods",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    @field_validator("gst_number")
    @classmethod
    def validate_gst_number(cls, value: str) -> str:
        clean_value = (value or "").strip().upper()
        if not clean_value:
            raise ValueError("GST number is required and cannot be empty.")
        if not GSTIN_REGEX.match(clean_value):
            raise ValueError(
                f"Invalid GSTIN format '{clean_value}'. Expected standard 15-character alphanumeric GSTIN (e.g. 37EREPR9114M1Z4)."
            )
        return clean_value
