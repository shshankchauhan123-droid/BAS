import json
import re

from app.processing.mapping.mapping_models import (
    ColumnMapping,
)


# ============================================================
# Universal fields that Qwen is allowed to return
# ============================================================

UNIVERSAL_FIELDS = {
    "transaction_date",
    "cheque_number",
    "description",
    "debit",
    "credit",
    "balance",
    "reference_number",
    "alpha",
}


# ============================================================
# Qwen prompt
# ============================================================

def _build_mapping_prompt(
    unknown_headers: list[str],
) -> str:
    """
    Build the prompt sent to Qwen.

    Qwen receives only the headers that the rule engine
    could not understand.
    """

    fields = "\n".join(
        f"- {field}"
        for field in sorted(UNIVERSAL_FIELDS)
    )

    headers = "\n".join(
        f"- {header}"
        for header in unknown_headers
    )

    return f"""
You are a bank statement column mapping assistant.

Your job is to map unknown bank statement column headers
to the correct universal field.

Allowed universal fields:

{fields}

Unknown bank statement headers:

{headers}

Rules:

1. Return only valid universal fields from the allowed list.
2. Do not invent new fields.
3. If a header cannot be confidently mapped, return null.
4. Return JSON only.
5. Do not include explanations.

Required JSON format:

{{
    "mappings": [
        {{
            "source_column": "header name",
            "target_field": "universal_field",
            "confidence": 0.0
        }}
    ]
}}
""".strip()


# ============================================================
# Extract JSON from Qwen response
# ============================================================

def _extract_json(response_text: str) -> dict:
    """
    Extract JSON from the Qwen response.

    Handles cases where the model accidentally places
    JSON inside a markdown code block.
    """

    if not response_text:
        raise ValueError(
            "Qwen returned an empty response."
        )

    response_text = response_text.strip()

    # --------------------------------------------------------
    # Direct JSON
    # --------------------------------------------------------

    try:
        return json.loads(response_text)

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # JSON inside ```json ... ```
    # --------------------------------------------------------

    match = re.search(
        r"```(?:json)?\s*(.*?)\s*```",
        response_text,
        re.DOTALL | re.IGNORECASE,
    )

    if match:

        json_text = match.group(1).strip()

        try:
            return json.loads(json_text)

        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Qwen response does not contain valid JSON."
    )


# ============================================================
# Validate Qwen mappings
# ============================================================

def _validate_qwen_mappings(
    data: dict,
    unknown_headers: list[str],
) -> list[ColumnMapping]:
    """
    Validate Qwen's response before allowing it into
    the transaction parsing pipeline.
    """

    if not isinstance(data, dict):

        raise ValueError(
            "Qwen response must be a JSON object."
        )

    raw_mappings = data.get("mappings")

    if not isinstance(raw_mappings, list):

        raise ValueError(
            "Qwen response must contain a 'mappings' list."
        )

    valid_mappings: list[ColumnMapping] = []

    unknown_header_set = {
        header.strip().lower()
        for header in unknown_headers
    }

    for item in raw_mappings:

        if not isinstance(item, dict):
            continue

        source_column = item.get(
            "source_column"
        )

        target_field = item.get(
            "target_field"
        )

        confidence = item.get(
            "confidence"
        )

        if not source_column:
            continue

        if not isinstance(source_column, str):
            continue

        normalized_source = (
            source_column.strip().lower()
        )

        # ----------------------------------------------------
        # Qwen must only map headers we actually sent.
        # ----------------------------------------------------

        if normalized_source not in unknown_header_set:
            continue

        # ----------------------------------------------------
        # Qwen must return a known universal field.
        # ----------------------------------------------------

        if target_field not in UNIVERSAL_FIELDS:
            continue

        # ----------------------------------------------------
        # Validate confidence.
        # ----------------------------------------------------

        try:
            confidence = float(confidence)

        except (TypeError, ValueError):
            confidence = 0.0

        confidence = max(
            0.0,
            min(1.0, confidence),
        )

        valid_mappings.append(
            ColumnMapping(
                source_column=source_column,
                target_field=target_field,
                confidence=confidence,
            )
        )

    return valid_mappings


# ============================================================
# Qwen mapping
# ============================================================

def map_unknown_headers_with_qwen(
    unknown_headers: list[str],
    qwen_client,
) -> list[ColumnMapping]:
    """
    Send unknown statement headers to Qwen and return
    validated universal column mappings.

    The Qwen client is intentionally passed into this
    function so this file does not depend on a specific
    Qwen SDK implementation.
    """

    if not unknown_headers:
        return []

    prompt = _build_mapping_prompt(
        unknown_headers
    )

    # --------------------------------------------------------
    # The client must provide a method that accepts the
    # prompt and returns the model's text response.
    #
    # We will connect the actual Qwen/Ollama client later.
    # --------------------------------------------------------

    response_text = qwen_client.generate(
        prompt
    )

    response_data = _extract_json(
        response_text
    )

    return _validate_qwen_mappings(
        response_data,
        unknown_headers,
    )