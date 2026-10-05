def build_qwen_header_prompt(headers: list, allowed_fields: list) -> str:
    headers_str = "\n".join(f"- {h}" for h in headers)
    allowed_str = "\n".join(allowed_fields)

    return f"""You map bank statement headers to BAS fields.

Allowed fields:
{allowed_str}

Rules:
- Map every input header.
- Return exactly one mapping object for every input header.
- source_header MUST exactly match the supplied header.
- Do not change source_header spelling.
- target_field MUST be one allowed field or null.
- 'debit' should be used for withdrawals, debit amounts, or money out.
- 'credit' should be used for deposits, credit amounts, or money in.
- 'transaction_date' should be used for date, txn date, value date.
- 'balance' should be used for account balance, available balance.
- 'description' should be used for particulars, narration, transaction details, remarks.
- 'mode' should be used for transaction mode, type.
- 'cheque_number' should be used for cheque, chq, ref no, instrument no.
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