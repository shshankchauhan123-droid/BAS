import os
import json
import logging
import re
import requests
import time
from typing import List, Dict, Any


logger = logging.getLogger(__name__)


# ============================================================
# PRE-FILTERING LISTS
# ============================================================

NO_COUNTERPARTY_TERMS = {
    "ATM CASH WITHDRAWAL",
    "CASH WITHDRAWAL",
    "ATM CASH",
    "CASH DEPOSIT",
    "CHEQUE DEPOSIT",
    "BANK CHARGES",
    "SERVICE CHARGE",
    "INTEREST CREDIT",
    "CONSOLIDATED CHARGES",
    "GST",
    "NEFT CHARGES",
    "RTGS CHARGES",
    "IMPS CHARGES",
}


TECHNICAL_TOKENS = {
    "UPI",
    "IMPS",
    "NEFT",
    "RTGS",
    "INB",
    "IFT",
    "MOB",
    "ATM",
    "POS",
    "CASH",
    "CHEQUE",
    "TRANSFER",
    "PAYMENT",
    "COLLECT",
    "PAY TO",
    "ACCOUNT",
    "ACCOUNTV",
    "DR",
    "CR",
    "DEBIT",
    "CREDIT",
    "SENT",
    "P2A",
    "P2M",
    "P2P",
    "P2V",
    "PAYMEN",
    "TPARTY",
    "TPARTY TRANSFER",
    "FUNDS",
    "FUNDS TRANSFER",
    "BIL",
    "REV",
    "RET",
    "WITHDRAWAL",
    "DEPOSIT",
    "CHGS",
    "GST",
    "FEE",
    "TXN",
    "REF",
    "REFERENCE",
    "PAY",
}


# Keep this list conservative.
# Do not include generic consumer brands such as PAYTM,
# AIRTEL, JIO unless they are definitely bank identifiers.
BANK_TOKENS = {
    "SBIN",
    "UBIN",
    "UCBA",
    "MAHB",
    "YES BANK",
    "YES BANK LIMITED",
    "YBS",
    "CNRB",
    "PUNB",
    "UTIB",
    "IDIB",
    "HPSC",
    "APIBANKI",
    "BANK",
    "BANKING",
    "HDFC",
    "ICICI",
    "AXIS",
    "KOTAK",
    "BOB",
    "BOI",
    "CANARA BANK",
    "FEDERAL BANK",
    "UCO BANK",
    "INDIAN BANK",
    "CENTRAL BANK OF INDIA",
    "PUNJAB NATIONAL BANK",
    "SHIVALIK",
    "SHIVALIK BANK",
}


# ============================================================
# VALIDATION HELPERS
# ============================================================

def is_technical_or_bank(text: str) -> bool:
    """
    Returns True when the supplied value is clearly a
    technical banking token or a bank-only identifier.
    """

    if not isinstance(text, str):
        return True

    clean = text.strip(" /-_").upper()

    if not clean:
        return True

    # Only numbers / dots / hyphens
    if re.match(r"^[\d.\-]+$", clean):
        return True

    # Exact technical token
    if clean in TECHNICAL_TOKENS:
        return True

    # Exact bank token
    if clean in BANK_TOKENS:
        return True

    # Generic bank naming
    if clean.endswith(" BANK"):
        return True

    if clean.startswith("BANK "):
        return True

    if clean.endswith(" BANK LIMITED"):
        return True

    return False


def is_identifier_string(text: str) -> bool:
    """
    Detect values that look like technical identifiers instead
    of real-world counterparty names.
    """

    if not isinstance(text, str):
        return False

    clean = text.strip(" /-_").upper()

    if not clean:
        return False

    # Email-like value
    if re.search(r"[a-zA-Z0-9.\-_]+@[a-zA-Z]+", clean):
        return True

    # Long numeric account / reference number
    if re.match(r"^\d{10,}$", clean):
        return True

    # Banking reference such as:
    # CBINR1202410010036598
    if re.match(r"^[A-Z]{3,5}[A-Z0-9]{8,}$", clean):
        return True

    return False


# ============================================================
# OLLAMA CONFIGURATION
# ============================================================

def get_ollama_config() -> Dict[str, Any]:
    """
    Read Ollama configuration from environment variables.

    IMPORTANT:
    Default batch size is intentionally 1 because the current
    model is qwen3.5:0.8b and we want reliable initial testing.
    """

    return {
        "base_url": os.getenv(
            "OLLAMA_BASE_URL",
            "http://localhost:11434",
        ).rstrip("/"),

        "model": os.getenv(
            "COUNTERPARTY_OLLAMA_MODEL",
            "qwen3.5:0.8b",
        ),

        # Start with 1.
        # Later you can test 3, 5, 10, etc.
        "batch_size": int(
            os.getenv(
                "COUNTERPARTY_OLLAMA_BATCH_SIZE",
                "1",
            )
        ),

        "timeout": int(
            os.getenv(
                "COUNTERPARTY_OLLAMA_TIMEOUT",
                "180",
            )
        ),

        "enabled": os.getenv(
            "COUNTERPARTY_OLLAMA_ENABLED",
            "true",
        ).lower() == "true",

        "max_retries": int(
            os.getenv(
                "COUNTERPARTY_OLLAMA_MAX_RETRIES",
                "2",
            )
        ),
    }


# ============================================================
# OLLAMA PROMPT
# ============================================================

def _build_ollama_prompt() -> str:
    """
    Build the semantic counterparty extraction prompt.

    The model must identify the actual external person,
    organization, merchant or business involved in the
    transaction.

    It must NOT simply return IDs, UPI IDs, account numbers,
    transaction references, bank names or technical tokens.
    """

    return """
You are a bank transaction counterparty extraction engine.

Your job is to identify the REAL external counterparty involved
in each Indian bank transaction.

For every transaction, identify the external:

- PERSON
- ORGANIZATION
- COMPANY
- MERCHANT
- BUSINESS
- BANK
- FINANCIAL_INSTITUTION
- OTHER

Only return a counterparty when the transaction description
contains enough information to identify a real-world party.

You must understand different Indian bank transaction formats,
including:

- UPI
- IMPS
- NEFT
- RTGS
- INB
- IFT
- P2A
- P2M
- P2P
- P2V
- bank transfers
- cheque transactions
- other Indian banking formats

Do NOT assume that one fixed transaction format is always used.

The transaction description may contain:

- transaction mode
- transaction reference
- UTR
- UPI ID
- account number
- bank code
- bank name
- technical banking keywords
- payment keywords
- actual counterparty name

Your job is to separate the actual counterparty from the
technical banking information.

CRITICAL RULES:

1. NEVER select a transaction/reference ID as the counterparty.

Example:
CBINR1202410010036598

This is an identifier, NOT a counterparty.

2. NEVER select an account number as the counterparty.

3. NEVER select a UPI ID as the counterparty name.

4. NEVER select a transaction mode as the counterparty.

Examples:
UPI
IMPS
NEFT
RTGS
INB
IFT

5. NEVER include transaction prefixes in the counterparty name.

For example:

UPI/ANSHUMAN/...
-> ANSHUMAN

6. NEVER include technical suffixes in the counterparty name.

Examples:

Payment
Paymen
Collect
Transfer
TPARTY
TPARTY TRANSFER
Account
Accountv
UPI
IMPS
NEFT
RTGS

unless that word is genuinely part of the real-world party name.

7. Do not return a bank name merely because a bank name appears
in the description.

Example:

UPI/P2M/194098501628/Rehman Fruits 2/Paymen/YES BANK LIMITED YBS

Correct:
Rehman Fruits 2

Incorrect:
YES BANK LIMITED YBS

8. Preserve the meaningful counterparty name as it appears.

Do not unnecessarily shorten or rewrite it.

9. Do not invent or guess a counterparty.

If there is no reliable external counterparty, return:

counterparty_name = null
counterparty_type = null
confidence = 0.0

10. A transaction/reference ID is NEVER a counterparty.

11. A bank's internal technical code is NEVER a counterparty.

12. If the description contains both a technical identifier and
a meaningful name, return the meaningful name.

EXAMPLES:

RTGS/CBINR1202410010036598/M/S TRIDENT DRUGS/CENTRAL BANK OF INDIA

Correct:
M/S TRIDENT DRUGS

---

INB/RTGS/UTIBR62024100275836915/Giriwar marketin/PUNJAB NATIONAL BANK

Correct:
Giriwar marketin

---

INB/IFT/Vishalfreight/TPARTY TRANSFER

Correct:
Vishalfreight

---

INB/IFT/Brand hub/TPARTY TRANSFER

Correct:
Brand hub

---

UPI/P2M/194098501628/Rehman Fruits 2/Paymen/YES BANK LIMITED YBS

Correct:
Rehman Fruits 2

---

UPI/P2A/663766766141/ANSHUMAN/PUNB/UPI/

Correct:
ANSHUMAN

---

IMPS/P2A/123456789012/GAURI GANESH PHARMA/

Correct:
GAURI GANESH PHARMA

---

NEFT/RAHUL SHARMA/TRANSFER

Correct:
RAHUL SHARMA

---

ATM CASH WITHDRAWAL

Correct:
NULL

---

CASH DEPOSIT

Correct:
NULL

---

CHEQUE DEPOSIT

Correct:
NULL

---

BANK CHARGES

Correct:
NULL

OUTPUT FORMAT:

You MUST return ONLY valid JSON.

The JSON root object MUST contain exactly one key:

"results"

"results" must contain one result object for every input
transaction.

Each result object MUST contain:

"id"
"counterparty_name"
"counterparty_type"
"confidence"

Allowed counterparty_type values:

PERSON
ORGANIZATION
MERCHANT
BANK
FINANCIAL_INSTITUTION
OTHER
null

Confidence must be a number between 0.0 and 1.0.

Do not return markdown.

Do not return explanations.

Do not return additional text.

If no reliable counterparty exists, return null.
"""


# ============================================================
# OLLAMA API CALL
# ============================================================

def _call_ollama_batch(
    batch_data: List[Dict[str, Any]],
    config: Dict[str, Any],
    batch_num: int,
) -> Dict[str, Any]:
    """
    Call Ollama using /api/generate.

    IMPORTANT:
    /api/generate expects a single prompt.
    It does NOT use the Chat API messages structure.
    """

    url = f"{config['base_url']}/api/generate"

    # --------------------------------------------------------
    # Prepare minimal transaction input
    # --------------------------------------------------------

    minimal_input = []

    for tx in batch_data:
        minimal_tx = {
            "id": tx["id"],
            "description": tx["description"],
        }

        if tx.get("mode"):
            minimal_tx["mode"] = tx["mode"]

        minimal_input.append(minimal_tx)

    # --------------------------------------------------------
    # Build one combined prompt
    # --------------------------------------------------------

    prompt = (
        _build_ollama_prompt()
        + "\n\n"
        + "INPUT TRANSACTIONS:\n"
        + json.dumps(
            minimal_input,
            ensure_ascii=False,
            indent=2,
        )
        + "\n\n"
        + "Return ONLY the required JSON object."
    )

    # --------------------------------------------------------
    # /api/generate payload
    # --------------------------------------------------------

    payload = {
        "model": config["model"],
        "prompt": prompt,

        # Required for getting one complete response
        "stream": False,

        # Disable thinking because we want a fast structured
        # extraction response.
        "think": False,

        # Ask Ollama for structured JSON output
        "format": "json",

        "options": {
            "temperature": 0.0,
            "top_p": 0.1,

            # Prevent unnecessarily long responses.
            "num_predict": 2048,
        },
    }

    logger.info(
        "OLLAMA_REQUEST_STARTED "
        f"batch={batch_num} "
        f"url={url} "
        f"model={config['model']} "
        f"size={len(batch_data)}"
    )

    start_time = time.time()

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=config["timeout"],
        )

        duration = time.time() - start_time

        logger.info(
            "OLLAMA_RESPONSE_RECEIVED "
            f"status={response.status_code} "
            f"duration={duration:.2f}s "
            f"batch={batch_num}"
        )

        response.raise_for_status()

        result = response.json()

        # /api/generate returns:
        #
        # {
        #     "response": "{...json...}",
        #     ...
        # }

        content = result.get("response", "")

        if not content:
            raise ValueError(
                "Ollama returned an empty response"
            )

        content = content.strip()

        logger.debug(
            f"Ollama raw content: {content[:1000]}"
        )

        try:
            parsed = json.loads(content)

        except json.JSONDecodeError as e:
            logger.error(
                "Failed to parse Ollama JSON "
                f"error={str(e)} "
                f"content={content[:1000]}"
            )

            raise ValueError(
                "Invalid JSON response from Ollama"
            ) from e

        # ----------------------------------------------------
        # Validate root object
        # ----------------------------------------------------

        if not isinstance(parsed, dict):
            raise ValueError(
                "Ollama response is not a JSON object"
            )

        results = parsed.get("results")

        if not isinstance(results, list):
            raise ValueError(
                "Ollama JSON does not contain a valid "
                "'results' list"
            )

        logger.info(
            "OLLAMA_RESPONSE_PARSED "
            f"results={len(results)} "
            f"batch={batch_num}"
        )

        return parsed

    except requests.RequestException as e:
        duration = time.time() - start_time

        logger.error(
            "OLLAMA_HTTP_ERROR "
            f"batch={batch_num} "
            f"duration={duration:.2f}s "
            f"error={str(e)}"
        )

        raise

    except Exception:
        logger.exception(
            f"OLLAMA_PROCESSING_ERROR batch={batch_num}"
        )
        raise


# ============================================================
# RETRY / FAILURE HANDLING
# ============================================================

def _process_batch_with_retry(
    batch_data: List[Dict[str, Any]],
    config: Dict[str, Any],
    batch_num: int,
    retries: int = 0,
) -> List[Dict[str, Any]]:
    """
    Process one Ollama batch with retry support.

    If a large batch repeatedly fails, it is split into smaller
    batches.
    """

    if not batch_data:
        return []

    try:
        response_data = _call_ollama_batch(
            batch_data,
            config,
            batch_num,
        )

        results = response_data.get(
            "results",
            [],
        )

        if not isinstance(results, list):
            raise ValueError(
                "Ollama results is not a list"
            )

        # ----------------------------------------------------
        # Verify all IDs are present
        # ----------------------------------------------------

        input_ids = {
            str(tx["id"])
            for tx in batch_data
        }

        output_ids = {
            str(r["id"])
            for r in results
            if isinstance(r, dict) and "id" in r
        }

        missing = input_ids - output_ids

        if missing:
            logger.warning(
                "OLLAMA_MISSING_IDS "
                f"batch={batch_num} "
                f"missing={len(missing)} "
                f"input={len(input_ids)} "
                f"output={len(output_ids)}"
            )

            if retries < config["max_retries"]:
                logger.info(
                    "Retrying batch because Ollama "
                    f"missed IDs. "
                    f"attempt={retries + 1}"
                )

                return _process_batch_with_retry(
                    batch_data,
                    config,
                    batch_num,
                    retries + 1,
                )

            # ------------------------------------------------
            # Max retries reached.
            # Add safe NULL results.
            # ------------------------------------------------

            logger.warning(
                "Max retries reached. "
                "Injecting NULL results for missing IDs."
            )

            for missing_id in missing:
                results.append(
                    {
                        "id": missing_id,
                        "counterparty_name": None,
                        "counterparty_type": None,
                        "confidence": 0.0,
                        "counterparty_source": "OLLAMA_ERROR",
                        "counterparty_status": "NOT_FOUND",
                    }
                )

        return results

    except Exception as e:

        logger.exception(
            "OLLAMA_BATCH_FAILED "
            f"batch={batch_num} "
            f"attempt={retries + 1} "
            f"error={str(e)}"
        )

        # ----------------------------------------------------
        # Retry
        # ----------------------------------------------------

        if retries < config["max_retries"]:

            logger.info(
                "Retrying Ollama batch "
                f"attempt={retries + 1}"
            )

            return _process_batch_with_retry(
                batch_data,
                config,
                batch_num,
                retries + 1,
            )

        # ----------------------------------------------------
        # Split large batches after retries fail
        # ----------------------------------------------------

        if len(batch_data) > 10:

            logger.info(
                "Splitting failed batch "
                f"size={len(batch_data)}"
            )

            mid = len(batch_data) // 2

            left = _process_batch_with_retry(
                batch_data[:mid],
                config,
                batch_num,
                0,
            )

            right = _process_batch_with_retry(
                batch_data[mid:],
                config,
                batch_num,
                0,
            )

            return left + right

        # ----------------------------------------------------
        # Completely failed small batch
        # ----------------------------------------------------

        logger.error(
            "Batch failed completely after retries. "
            "Returning NULL results."
        )

        return [
            {
                "id": tx["id"],
                "counterparty_name": None,
                "counterparty_type": None,
                "confidence": 0.0,
                "counterparty_source": "OLLAMA_ERROR",
                "counterparty_status": "NOT_FOUND",
            }
            for tx in batch_data
        ]


# ============================================================
# OLLAMA RESULT VALIDATION
# ============================================================

def validate_ollama_result(
    result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Final guardrail before the model result reaches PostgreSQL.

    This protects against:

    - IDs
    - account numbers
    - technical tokens
    - bank-only names
    - low confidence
    - malformed model responses
    """

    if not isinstance(result, dict):
        return {
            "counterparty_name": None,
            "counterparty_type": None,
            "counterparty_confidence": 0.0,
            "counterparty_status": "NOT_FOUND",
            "counterparty_source": "OLLAMA_ERROR",
        }

    # --------------------------------------------------------
    # Name
    # --------------------------------------------------------

    name = result.get("counterparty_name")

    if not name or not isinstance(name, str):

        result["counterparty_name"] = None
        result["counterparty_type"] = None
        result["counterparty_confidence"] = 0.0
        result["counterparty_status"] = "NOT_FOUND"
        result["counterparty_source"] = "OLLAMA"

        return result

    name_clean = name.strip()

    if not name_clean:

        result["counterparty_name"] = None
        result["counterparty_type"] = None
        result["counterparty_confidence"] = 0.0
        result["counterparty_status"] = "NOT_FOUND"
        result["counterparty_source"] = "OLLAMA"

        return result

    # --------------------------------------------------------
    # Reject technical / bank-only tokens
    # --------------------------------------------------------

    if is_technical_or_bank(name_clean):

        logger.debug(
            f"Rejected technical/bank counterparty: {name_clean}"
        )

        result["counterparty_name"] = None
        result["counterparty_type"] = None
        result["counterparty_confidence"] = 0.0
        result["counterparty_status"] = "NOT_FOUND"
        result["counterparty_source"] = "OLLAMA"

        return result

    # --------------------------------------------------------
    # Reject identifiers
    # --------------------------------------------------------

    if is_identifier_string(name_clean):

        logger.debug(
            f"Rejected identifier as counterparty: {name_clean}"
        )

        result["counterparty_name"] = None
        result["counterparty_type"] = None
        result["counterparty_confidence"] = 0.0
        result["counterparty_status"] = "NOT_FOUND"
        result["counterparty_source"] = "OLLAMA"

        return result

    # --------------------------------------------------------
    # Confidence
    # --------------------------------------------------------

    try:
        conf = float(
            result.get(
                "confidence",
                0.0,
            )
        )

    except (TypeError, ValueError):
        conf = 0.0

    # Keep confidence inside valid range
    conf = max(
        0.0,
        min(
            1.0,
            conf,
        ),
    )

    # IMPORTANT:
    # This was missing in the previous version.
    result["counterparty_confidence"] = conf

    # --------------------------------------------------------
    # Confidence threshold
    # --------------------------------------------------------

    if conf < 0.50:

        result["counterparty_name"] = None
        result["counterparty_type"] = None
        result["counterparty_status"] = "NOT_FOUND"
        result["counterparty_source"] = "OLLAMA"

        return result

    # --------------------------------------------------------
    # Validate type
    # --------------------------------------------------------

    allowed_types = {
        "PERSON",
        "ORGANIZATION",
        "MERCHANT",
        "BANK",
        "FINANCIAL_INSTITUTION",
        "OTHER",
    }

    counterparty_type = result.get(
        "counterparty_type"
    )

    if isinstance(counterparty_type, str):
        counterparty_type = counterparty_type.strip().upper()

        if counterparty_type not in allowed_types:
            counterparty_type = "OTHER"

    else:
        counterparty_type = "OTHER"

    # --------------------------------------------------------
    # Valid result
    # --------------------------------------------------------

    result["counterparty_name"] = name_clean
    result["counterparty_type"] = counterparty_type
    result["counterparty_confidence"] = conf
    result["counterparty_status"] = "FOUND"
    result["counterparty_source"] = "OLLAMA"

    return result


# ============================================================
# MAIN ENTRY POINT
# ============================================================

def extract_counterparties_batch(
    transactions_df,
) -> Dict[str, Any]:
    """
    Main counterparty enrichment function.

    Input:
        pandas DataFrame containing transaction descriptions.

    Output:
        Dictionary mapped by original DataFrame index.

    Example:

        {
            0: {
                "counterparty_name": "RAHUL SHARMA",
                "counterparty_type": "PERSON",
                "counterparty_confidence": 0.92,
                "counterparty_status": "FOUND",
                "counterparty_source": "OLLAMA"
            }
        }
    """

    config = get_ollama_config()

    # --------------------------------------------------------
    # Disabled
    # --------------------------------------------------------

    if not config["enabled"]:

        logger.info(
            "Counterparty Ollama is disabled."
        )

        return {}

    print(
        "============================================================"
    )
    print(
        "COUNTERPARTY ENRICHMENT STARTED"
    )
    print(
        "============================================================"
    )

    print(
        f"Total transactions: {len(transactions_df)}"
    )

    print(
        f"Ollama model: {config['model']}"
    )

    print(
        f"Batch size: {config['batch_size']}"
    )

    # --------------------------------------------------------
    # 1. Pre-filtering
    # --------------------------------------------------------

    transactions_to_process = []

    skipped_results = {}

    for idx, row in transactions_df.iterrows():

        desc = str(
            row.get(
                "description",
                "",
            )
        ).strip()

        mode = str(
            row.get(
                "mode",
                "",
            )
        ).strip()

        # ----------------------------------------------------
        # Empty description
        # ----------------------------------------------------

        if not desc:

            skipped_results[idx] = {
                "counterparty_name": None,
                "counterparty_type": None,
                "counterparty_confidence": 0.0,
                "counterparty_status": "NOT_FOUND",
                "counterparty_source": "PYTHON_PREFILTER",
            }

            continue

        # ----------------------------------------------------
        # Exact no-counterparty description
        # ----------------------------------------------------

        if desc.upper() in NO_COUNTERPARTY_TERMS:

            skipped_results[idx] = {
                "counterparty_name": None,
                "counterparty_type": None,
                "counterparty_confidence": 0.0,
                "counterparty_status": "NOT_FOUND",
                "counterparty_source": "PYTHON_PREFILTER",
            }

            continue

        # ----------------------------------------------------
        # Send to Ollama
        # ----------------------------------------------------

        transactions_to_process.append(
            {
                "id": idx,
                "description": desc,
                "mode": mode,
            }
        )

    logger.info(
        "COUNTERPARTY_PREFILTER_COMPLETED "
        f"total={len(transactions_df)} "
        f"skipped={len(skipped_results)} "
        f"to_ollama={len(transactions_to_process)}"
    )

    # --------------------------------------------------------
    # 2. Deduplicate descriptions
    # --------------------------------------------------------

    desc_to_temp_id = {}

    unique_txs_to_process = []

    for tx in transactions_to_process:

        desc = tx["description"]

        if desc not in desc_to_temp_id:

            desc_to_temp_id[desc] = []

            unique_txs_to_process.append(
                {
                    # Use description as unique Ollama ID.
                    # This allows identical descriptions to be
                    # processed only once.
                    "id": desc,
                    "description": desc,
                    "mode": tx["mode"],
                }
            )

        desc_to_temp_id[desc].append(
            tx["id"]
        )

    print(
        f"Unique descriptions to process: "
        f"{len(unique_txs_to_process)}"
    )

    logger.info(
        "COUNTERPARTY_PIPELINE_STARTED "
        f"transactions={len(transactions_df)} "
        f"unique={len(unique_txs_to_process)}"
    )

    # --------------------------------------------------------
    # 3. Batch processing
    # --------------------------------------------------------

    all_unique_results = {}

    batch_size = max(
        1,
        config["batch_size"],
    )

    total_batches = (
        len(unique_txs_to_process)
        + batch_size
        - 1
    ) // batch_size

    if total_batches > 0:

        print(
            f"Total Ollama batches: {total_batches}"
        )

    for i in range(
        0,
        len(unique_txs_to_process),
        batch_size,
    ):

        batch = unique_txs_to_process[
            i:i + batch_size
        ]

        batch_num = (
            i // batch_size
        ) + 1

        logger.info(
            "COUNTERPARTY_BATCH_STARTED "
            f"batch={batch_num}/{total_batches} "
            f"size={len(batch)}"
        )

        start_time = time.time()

        results = _process_batch_with_retry(
            batch,
            config,
            batch_num,
        )

        found_in_batch = 0

        # ----------------------------------------------------
        # Validate each model response
        # ----------------------------------------------------

        for res in results:

            validated = validate_ollama_result(
                res
            )

            result_id = str(
                res.get(
                    "id",
                    "",
                )
            )

            if not result_id:
                logger.warning(
                    "Ollama returned result without ID"
                )
                continue

            all_unique_results[
                result_id
            ] = validated

            if (
                validated.get(
                    "counterparty_status"
                )
                == "FOUND"
            ):
                found_in_batch += 1

        elapsed = (
            time.time()
            - start_time
        )

        not_found_in_batch = (
            len(batch)
            - found_in_batch
        )

        print(
            f"Ollama batch {batch_num} "
            f"completed in {elapsed:.2f}s | "
            f"Processed: {len(batch)} | "
            f"Found: {found_in_batch} | "
            f"Not found: {not_found_in_batch}"
        )

        logger.info(
            "COUNTERPARTY_BATCH_COMPLETED "
            f"batch={batch_num} "
            f"duration={elapsed:.2f}s "
            f"found={found_in_batch} "
            f"not_found={not_found_in_batch}"
        )

    logger.info(
        "COUNTERPARTY_VALIDATION_COMPLETED"
    )

    # --------------------------------------------------------
    # 4. Map results back to original DataFrame indices
    # --------------------------------------------------------

    final_mapping = {}

    found_total = 0
    not_found_total = 0

    for idx, row in transactions_df.iterrows():

        # ----------------------------------------------------
        # Python pre-filtered transaction
        # ----------------------------------------------------

        if idx in skipped_results:

            final_mapping[idx] = (
                skipped_results[idx]
            )

            not_found_total += 1

            continue

        # ----------------------------------------------------
        # Get original description
        # ----------------------------------------------------

        desc = str(
            row.get(
                "description",
                "",
            )
        ).strip()

        result = all_unique_results.get(
            desc,
            {},
        )

        # ----------------------------------------------------
        # If Ollama result does not exist
        # ----------------------------------------------------

        if not result:

            final_mapping[idx] = {
                "counterparty_name": None,
                "counterparty_type": None,
                "counterparty_confidence": 0.0,
                "counterparty_status": "NOT_FOUND",
                "counterparty_source": "OLLAMA_ERROR",
            }

            not_found_total += 1

            continue

        # ----------------------------------------------------
        # Final mapping
        # ----------------------------------------------------

        final_mapping[idx] = {
            "counterparty_name": result.get(
                "counterparty_name"
            ),

            "counterparty_type": result.get(
                "counterparty_type"
            ),

            "counterparty_confidence": result.get(
                "counterparty_confidence",
                0.0,
            ),

            "counterparty_status": result.get(
                "counterparty_status",
                "NOT_FOUND",
            ),

            "counterparty_source": result.get(
                "counterparty_source",
                "UNKNOWN",
            ),

            # We deliberately do not copy technical IDs
            # into the counterparty name.
            #
            # If later you want a separate extraction for
            # UTR / account / UPI ID, it should be handled
            # separately.
            "counterparty_identifier": result.get(
                "counterparty_identifier"
            ),
        }

        if (
            final_mapping[idx][
                "counterparty_status"
            ]
            == "FOUND"
        ):

            found_total += 1

        else:

            not_found_total += 1

    # --------------------------------------------------------
    # 5. Final summary
    # --------------------------------------------------------

    print(
        "============================================================"
    )

    print(
        "COUNTERPARTY ENRICHMENT COMPLETED"
    )

    print(
        f"Total: {len(transactions_df)}"
    )

    print(
        f"Found: {found_total}"
    )

    print(
        f"Not found: {not_found_total}"
    )

    print(
        "Failed: 0"
    )

    print(
        "============================================================"
    )

    logger.info(
        "COUNTERPARTY_PIPELINE_COMPLETED "
        f"total={len(transactions_df)} "
        f"found={found_total} "
        f"not_found={not_found_total}"
    )

    return final_mapping