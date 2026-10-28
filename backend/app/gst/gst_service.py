import logging
import os
from typing import Any, Dict
from dotenv import load_dotenv
from fastapi import HTTPException, status
import httpx

from app.gst.gst_schema import GstAdvanceSearchRequest

# Ensure environment variables are loaded
load_dotenv()

logger = logging.getLogger("gst_service")
logger.setLevel(logging.INFO)

# Placeholder values that indicate unconfigured credentials
PLACEHOLDER_VALUES = {
    "your_actual_client_id",
    "your_fact_gst_client_id",
    "your_actual_secret_key",
    "your_fact_gst_secret_key",
    "placeholder",
    "none",
    "",
}


def get_gst_api_config() -> Dict[str, Any]:
    """
    Safely retrieve external GST API configuration from backend environment.
    Never exposes credentials in logs or responses.
    """
    api_url = os.getenv(
        "FACT_GST_API_URL",
        "https://api.fact-byte.com/GST/GSTAdvanceSearch",
    ).strip()
    client_id = (os.getenv("FACT_GST_CLIENT_ID") or "").strip()
    secret_key = (os.getenv("FACT_GST_SECRET_KEY") or "").strip()

    timeout_raw = os.getenv("FACT_GST_TIMEOUT_SECONDS", "60").strip()
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


def validate_gst_configuration(config: Dict[str, Any]) -> None:
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
            "GST Advance Search rejected: FACT_GST_CLIENT_ID or FACT_GST_SECRET_KEY is not configured in backend/.env"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "FACT GST API credentials are not configured on the server. "
                "Please configure valid FACT_GST_CLIENT_ID and FACT_GST_SECRET_KEY in backend/.env."
            ),
        )


async def execute_gst_advance_search(
    request: GstAdvanceSearchRequest,
) -> Dict[str, Any]:
    """
    Call FACT GST Advance Search external API using configured credentials.
    Preserves and returns the full nested upstream response structure.
    """
    config = get_gst_api_config()
    validate_gst_configuration(config)

    api_url = config["api_url"]
    client_id = config["client_id"]
    secret_key = config["secret_key"]
    timeout_seconds = config["timeout_seconds"]

    # Upstream contract requires exact header name "SecreteKey" (with extra 'e')
    headers = {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "ClientId": client_id,
        "SecreteKey": secret_key,
    }

    payload = {
        "gstNumber": request.gst_number,
        "hsnDetails": bool(request.hsn_details),
        "branchDetails": bool(request.branch_details),
        "filingDetails": bool(request.filing_details),
        "filingFrequency": bool(request.filing_frequency),
        "liabilityPaidDetails": bool(request.liability_paid_details),
    }

    # Mask GSTIN in logs for privacy
    masked_gstin = (
        request.gst_number[:4] + "****" + request.gst_number[-3:]
        if len(request.gst_number) >= 7
        else "***"
    )
    logger.info(
        "Calling FACT GST Advance Search endpoint for GSTIN [%s] with timeout %.1fs",
        masked_gstin,
        timeout_seconds,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                api_url,
                headers=headers,
                json=payload,
            )

    except httpx.TimeoutException as exc:
        logger.error(
            "FACT GST API request timed out after %.1fs for GSTIN [%s]",
            timeout_seconds,
            masked_gstin,
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"External FACT GST API timed out after {int(timeout_seconds)} seconds. Please try again.",
        ) from exc

    except httpx.ConnectError as exc:
        logger.error(
            "Connection to FACT GST API endpoint [%s] failed",
            api_url,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to establish connection with external FACT GST API service. Please verify network connectivity.",
        ) from exc

    except httpx.HTTPError as exc:
        logger.error(
            "HTTP error occurred while calling FACT GST API: %s",
            str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Network error communicating with external GST service: {str(exc)}",
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected error during FACT GST API request")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected server error during GST lookup: {str(exc)}",
        ) from exc

    # Parse response JSON
    try:
        response_json = response.json()
    except Exception as exc:
        logger.error(
            "Failed to parse JSON response from FACT GST API (HTTP %d): %s",
            response.status_code,
            response.text[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Received malformed or non-JSON response from external FACT GST API.",
        ) from exc

    # Handle upstream HTTP error statuses
    if response.status_code != 200:
        error_msg = (
            response_json.get("errorMessage")
            or response_json.get("message")
            or response_json.get("detail")
            or f"External GST API returned HTTP status {response.status_code}."
        )
        logger.warning(
            "Upstream FACT GST API returned HTTP %d: %s",
            response.status_code,
            error_msg,
        )
        raise HTTPException(
            status_code=response.status_code if response.status_code in [400, 401, 403, 404] else status.HTTP_502_BAD_GATEWAY,
            detail=error_msg,
        )

    # Return full upstream response without discarding nested data
    return response_json
