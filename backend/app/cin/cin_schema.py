import re
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Permissive pattern supporting:
# - Standard 21-character Indian CIN (e.g. U72200TG2020PTC123456)
# - LLPIN / Foreign company numbers (e.g. AAA-1234, F01234)
# - API search keys / shorthand IDs (e.g. ADB-0675, ADD-5165)
SEARCH_NUMBER_REGEX = re.compile(r"^[A-Za-z0-9\-_/]{3,35}$")


class CinSearchQuery(BaseModel):
    search_number: str = Field(
        ...,
        alias="searchNumber",
        description="Company Identification Number (CIN), LLPIN, or registration search identifier (e.g. ADB-0675 or U72200TG2020PTC123456)",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    @field_validator("search_number")
    @classmethod
    def validate_search_number(cls, value: str) -> str:
        clean_value = (value or "").strip()
        if not clean_value:
            raise ValueError("Company search number (CIN) is required and cannot be empty.")
        if not SEARCH_NUMBER_REGEX.match(clean_value):
            raise ValueError(
                f"Invalid search number format '{clean_value}'. Expected a valid alphanumeric identifier (e.g. ADB-0675, ADD-5165, or 21-character CIN)."
            )
        return clean_value
