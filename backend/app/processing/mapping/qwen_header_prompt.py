def build_qwen_header_prompt(headers: list) -> str:
    headers_str = "\n".join(f"- {h}" for h in headers)

    return f"""You map bank statement headers to BAS fields.

Allowed fields:
transaction_date
description
cheque_number
debit
credit
balance
mode

Rules:
- Map every input header.
- Return exactly one mapping object for every input header.
- source_header MUST exactly match the supplied header.
- Do not change source_header spelling.
- target_field MUST be one allowed field or null.
- confidence MUST be a number between 0 and 1.
- Return the COMPLETE JSON object.
- Return JSON only.
- No explanation.
- No markdown.
- No code fences.
- Do not stop before all input headers are mapped.

Input headers:
{headers_str}

Return exactly:
{{
  "mappings": [
    {{
      "source_header": "input_header",
      "target_field": "allowed_field",
      "confidence": 0.95
    }}
  ]
}}"""