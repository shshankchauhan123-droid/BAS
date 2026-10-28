import logging
import os
from typing import Any, Dict
from dotenv import load_dotenv
from fastapi import HTTPException, status
import httpx

# Ensure environment variables are loaded
load_dotenv()

logger = logging.getLogger("cin_service")
logger.setLevel(logging.INFO)

# Placeholder values that indicate unconfigured credentials
PLACEHOLDER_VALUES = {
    "your_actual_client_id",
    "your_fact_cin_client_id",
    "your_actual_secret_key",
    "your_fact_cin_secret_key",
    "placeholder",
    "none",
    "",
}


def get_cin_api_config() -> Dict[str, Any]:
    """
    Safely retrieve external CIN API configuration from backend environment.
    Never exposes credentials in logs or responses.
    """
    api_url = os.getenv(
        "FACT_CIN_API_URL",
        "https://api.fact-byte.com/CIN/NewCINDetails",
    ).strip()
    client_id = (os.getenv("FACT_CIN_CLIENT_ID") or "").strip()
    secret_key = (os.getenv("FACT_CIN_SECRET_KEY") or "").strip()

    timeout_raw = os.getenv("FACT_CIN_TIMEOUT_SECONDS", "60").strip()
    try:
        timeout_seconds = float(timeout_raw)
    except (ValueError, TypeError):
        timeout_seconds = 60.0

    return {
        "api_url": api_url,
        "client_id": client_id,
        "secret_key": secret_key,
        "timeout_seconds": timeout_seconds,
    }


def validate_cin_configuration(config: Dict[str, Any]) -> None:
    """
    Validate that required external API credentials are properly configured.
    """
    client_id = config.get("client_id", "")
    secret_key = config.get("secret_key", "")

    if (
        not client_id
        or client_id.lower() in PLACEHOLDER_VALUES
        or not secret_key
        or secret_key.lower() in PLACEHOLDER_VALUES
    ):
        logger.warning(
            "CIN Advance Search rejected: FACT_CIN_CLIENT_ID or FACT_CIN_SECRET_KEY is not configured in backend/.env"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "FACT CIN API credentials are not configured on the server. "
                "Please configure valid FACT_CIN_CLIENT_ID and FACT_CIN_SECRET_KEY in backend/.env."
            ),
        )


async def execute_cin_advance_search(search_number: str) -> Dict[str, Any]:
    """
    Call FACT CIN Details external API using configured credentials.
    Preserves and returns the full nested upstream response structure.
    """
    clean_search = (search_number or "").strip()
    if not clean_search:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search number (CIN) cannot be empty.",
        )

    config = get_cin_api_config()
    validate_cin_configuration(config)

    api_url = config["api_url"]
    client_id = config["client_id"]
    secret_key = config["secret_key"]
    timeout_seconds = config["timeout_seconds"]

    # Upstream contract specifies GET with headers: Accept, clientId, secreteKey
    headers = {
        "Accept": "application/json",
        "clientId": client_id,
        "secreteKey": secret_key,
    }

    params = {
        "searchNumber": clean_search,
    }

    # Mask identifier in logs
    masked_search = (
        clean_search[:3] + "****" + clean_search[-2:]
        if len(clean_search) >= 5
        else "***"
    )
    logger.info(
        "Calling FACT CIN Details endpoint for searchNumber [%s] with timeout %.1fs",
        masked_search,
        timeout_seconds,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(
                api_url,
                headers=headers,
                params=params,
            )

    except httpx.TimeoutException as exc:
        logger.error(
            "FACT CIN API request timed out after %.1fs for searchNumber [%s]",
            timeout_seconds,
            masked_search,
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"External FACT CIN API timed out after {int(timeout_seconds)} seconds. Please try again.",
        ) from exc

    except httpx.ConnectError as exc:
        logger.error(
            "Connection to FACT CIN API endpoint [%s] failed",
            api_url,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to establish connection with external FACT CIN API service. Please verify network connectivity.",
        ) from exc

    except httpx.HTTPError as exc:
        logger.error(
            "HTTP error occurred while calling FACT CIN API: %s",
            str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Network error communicating with external CIN service: {str(exc)}",
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected error during FACT CIN API request")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected server error during CIN lookup: {str(exc)}",
        ) from exc

    # Parse response JSON
    try:
        response_json = response.json()
    except Exception as exc:
        logger.error(
            "Failed to parse JSON response from FACT CIN API (HTTP %d): %s",
            response.status_code,
            response.text[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Received malformed or non-JSON response from external FACT CIN API.",
        ) from exc

    # Handle upstream HTTP error statuses
    if response.status_code != 200:
        error_msg = (
            response_json.get("errorMessage")
            or response_json.get("message")
            or response_json.get("detail")
            or f"External CIN API returned HTTP status {response.status_code}."
        )
        logger.warning(
            "Upstream FACT CIN API returned HTTP %d: %s",
            response.status_code,
            error_msg,
        )
        raise HTTPException(
            status_code=response.status_code if response.status_code in [400, 401, 403, 404] else status.HTTP_502_BAD_GATEWAY,
            detail=error_msg,
        )

    # Return full upstream response without discarding nested data
    return response_json
