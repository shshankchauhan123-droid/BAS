import os
import sys
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.gst.gst_schema import GstAdvanceSearchRequest, GSTIN_REGEX
from app.gst.gst_service import (
    get_gst_api_config,
    validate_gst_configuration,
    execute_gst_advance_search,
)
from app.main import app
from app.dependencies.auth import get_current_user


SAMPLE_FACT_GST_RESPONSE = {
    "success": True,
    "statusCode": 200,
    "successMessage": "GST Details Fetched Successfully",
    "isFromDB": False,
    "errorMessage": None,
    "data": {
        "status": True,
        "errdata": None,
        "data": {
            "basicDetails": {
                "gstin": "37EREPR9114M1Z4",
                "lgnm": "FACT BYTE TECHNOLOGIES PRIVATE LIMITED",
                "tradeNam": "FACT BYTE",
                "sts": "Active",
                "dty": "Regular",
                "rgdt": "01/07/2017",
                "ctb": "Private Limited Company",
                "aggregateTurnover": "₹5 Cr - ₹25 Cr",
                "turnoverFY": "2023-24",
                "nba": ["Software Development", "Information Technology"],
                "ctj": "Ward 1, Range 2, Division 3",
                "einvoiceStatus": "Enabled",
                "adhrVrfSts": "Verified",
                "cxdt": None,
            },
            "branchDetails": {
                "pradr": {
                    "addr": {
                        "bno": "101",
                        "bnm": "Tech Park",
                        "st": "Main Road",
                        "loc": "Cyber City",
                        "dst": "Hyderabad",
                        "stcd": "Telangana",
                        "pncd": "500081",
                    },
                    "ntr": "Principal Place of Business",
                },
                "adadr": [
                    {
                        "addr": {
                            "bno": "204",
                            "bnm": "Innovation Hub",
                            "st": "Ring Road",
                            "loc": "Bangalore",
                            "dst": "Bangalore",
                            "stcd": "Karnataka",
                            "pncd": "560001",
                        },
                        "ntr": "Branch Office",
                    }
                ],
            },
            "hsnDetails": {
                "goods": [
                    {"hsn_cd": "8471", "desc": "Automatic data processing machines"}
                ],
                "services": [
                    {"hsn_cd": "998314", "desc": "Information technology design and development services"}
                ],
            },
            "filingDetails": {
                "currentYear": {
                    "filingStatus": [
                        [
                            {
                                "fy": "2024-25",
                                "taxp": "December",
                                "rtntype": "GSTR1",
                                "dof": "11/01/2025",
                                "mof": "ONLINE",
                                "status": "Filed",
                                "arn": "AA3712240001234",
                            },
                            {
                                "fy": "2024-25",
                                "taxp": "December",
                                "rtntype": "GSTR3B",
                                "dof": "20/01/2025",
                                "mof": "ONLINE",
                                "status": "Filed",
                                "arn": "AA3712240005678",
                            },
                        ]
                    ]
                },
                "previousYear": {
                    "filingStatus": [
                        [
                            {
                                "fy": "2023-24",
                                "taxp": "March",
                                "rtntype": "GSTR1",
                                "dof": "11/04/2024",
                                "mof": "ONLINE",
                                "status": "Filed",
                                "arn": "AA3703240009999",
                            }
                        ]
                    ]
                },
            },
            "liabilityPaidDetails": [
                {
                    "fy": "2024-25",
                    "taxp": "December",
                    "liabilityPaid": "100.00%",
                },
                {
                    "fy": "2024-25",
                    "taxp": "November",
                    "liabilityPaid": "100.00%",
                },
            ],
            "filingFrequency": "Monthly",
            "filingFrequencyLastYear": "Monthly",
        },
        "message": "Success",
    },
}


class TestGstAdvanceSearch(unittest.IsolatedAsyncioTestCase):
    def test_gstin_regex_validation(self):
        valid_gstins = [
            "37EREPR9114M1Z4",
            "27AAAAA0000A1Z5",
            "07AAGCB1234F1Z1",
            "29ABCDE1234F2Z5",
        ]
        for gstin in valid_gstins:
            self.assertTrue(
                bool(GSTIN_REGEX.match(gstin)),
                f"Expected {gstin} to match GSTIN pattern",
            )

        invalid_gstins = [
            "",
            "12345",
            "INVALIDGSTIN123",
            "37EREPR9114M1A4",  # 14th char must be 'Z'
            "37EREPR9114M1Z",   # 14 chars, needs 15
            "37EREPR9114M1Z44", # 16 chars
        ]
        for gstin in invalid_gstins:
            self.assertFalse(
                bool(GSTIN_REGEX.match(gstin)),
                f"Expected {gstin} to be invalid",
            )

    def test_gst_advance_search_request_schema_defaults(self):
        req = GstAdvanceSearchRequest(gstNumber="37erepr9114m1z4")
        # Should auto uppercase
        self.assertEqual(req.gst_number, "37EREPR9114M1Z4")
        self.assertTrue(req.hsn_details)
        self.assertTrue(req.branch_details)
        self.assertTrue(req.filing_details)
        self.assertTrue(req.filing_frequency)
        self.assertTrue(req.liability_paid_details)

    def test_gst_advance_search_request_schema_custom_options(self):
        req = GstAdvanceSearchRequest(
            gstNumber="27AAAAA0000A1Z5",
            hsnDetails=False,
            branchDetails=True,
            filingDetails=False,
            filingFrequency=True,
            liabilityPaidDetails=False,
        )
        self.assertEqual(req.gst_number, "27AAAAA0000A1Z5")
        self.assertFalse(req.hsn_details)
        self.assertTrue(req.branch_details)
        self.assertFalse(req.filing_details)
        self.assertTrue(req.filing_frequency)
        self.assertFalse(req.liability_paid_details)

    def test_gst_advance_search_request_schema_invalid_gst(self):
        with self.assertRaises(ValidationError):
            GstAdvanceSearchRequest(gstNumber="not_a_gstin")

    def test_validate_gst_configuration_placeholder_rejection(self):
        bad_config = {
            "api_url": "https://api.fact-byte.com/GST/GSTAdvanceSearch",
            "client_id": "your_actual_client_id",
            "secret_key": "your_actual_secret_key",
            "timeout_seconds": 60,
        }
        with self.assertRaises(HTTPException) as cm:
            validate_gst_configuration(bad_config)
        self.assertEqual(cm.exception.status_code, 503)

    @patch("app.gst.gst_service.get_gst_api_config")
    @patch("httpx.AsyncClient.post")
    async def test_execute_gst_advance_search_success(
        self, mock_post, mock_get_config
    ):
        mock_get_config.return_value = {
            "api_url": "https://api.fact-byte.com/GST/GSTAdvanceSearch",
            "client_id": "valid_client_id_test",
            "secret_key": "valid_secret_key_test",
            "timeout_seconds": 60.0,
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SAMPLE_FACT_GST_RESPONSE
        mock_post.return_value = mock_resp

        req = GstAdvanceSearchRequest(
            gstNumber="37EREPR9114M1Z4",
            hsnDetails=True,
            branchDetails=True,
            filingDetails=True,
            filingFrequency=True,
            liabilityPaidDetails=True,
        )

        result = await execute_gst_advance_search(req)

        # Verify headers sent to upstream
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        headers = call_kwargs.get("headers", {})
        self.assertEqual(headers.get("Accept"), "*/*")
        self.assertEqual(headers.get("Content-Type"), "application/json")
        self.assertEqual(headers.get("ClientId"), "valid_client_id_test")
        self.assertEqual(headers.get("SecreteKey"), "valid_secret_key_test")

        # Verify result preserves nested structure
        self.assertTrue(result["success"])
        self.assertEqual(
            result["data"]["data"]["basicDetails"]["lgnm"],
            "FACT BYTE TECHNOLOGIES PRIVATE LIMITED",
        )
        self.assertEqual(
            result["data"]["data"]["basicDetails"]["gstin"],
            "37EREPR9114M1Z4",
        )

    def test_fastapi_endpoints_registered_and_working(self):
        client = TestClient(app)

        # Mock current active user
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.username = "test_analyst"
        mock_user.role = "admin"
        mock_user.is_active = True

        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch(
                "app.gst.gst_router.execute_gst_advance_search",
                new_callable=AsyncMock,
            ) as mock_exec:
                mock_exec.return_value = SAMPLE_FACT_GST_RESPONSE

                # Test /api/v1/gst/advance-search
                res1 = client.post(
                    "/api/v1/gst/advance-search",
                    json={
                        "gstNumber": "37EREPR9114M1Z4",
                        "hsnDetails": True,
                        "branchDetails": True,
                        "filingDetails": True,
                        "filingFrequency": True,
                        "liabilityPaidDetails": True,
                    },
                )
                self.assertEqual(res1.status_code, 200)
                data1 = res1.json()
                self.assertTrue(data1["success"])
                self.assertEqual(
                    data1["data"]["data"]["basicDetails"]["gstin"],
                    "37EREPR9114M1Z4",
                )

                # Test alias /api/gst/advance-search
                res2 = client.post(
                    "/api/gst/advance-search",
                    json={"gstNumber": "37EREPR9114M1Z4"},
                )
                self.assertEqual(res2.status_code, 200)
                data2 = res2.json()
                self.assertTrue(data2["success"])

                # Test invalid GSTIN validation (returns 422)
                res3 = client.post(
                    "/api/v1/gst/advance-search",
                    json={"gstNumber": "BAD_GST"},
                )
                self.assertEqual(res3.status_code, 422)

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_postman_response_structure_preserved(self):
        client = TestClient(app)

        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.username = "test_analyst"
        mock_user.role = "admin"
        mock_user.is_active = True

        app.dependency_overrides[get_current_user] = lambda: mock_user

        postman_payload = {
            "success": True,
            "statusCode": 200,
            "data": {
                "status": True,
                "data": {
                    "basicDetails": {
                        "gstin": "37EREPR9114M1Z4",
                        "legal_Name": "MUDDISETTY LAKSHMI RAJESWARI",
                        "tradeNam": "M/S LAKSHMI INDUSTRIAL BRAKE SYSTEMS",
                        "registrationStatus": "Active",
                        "registrationType": "Regular",
                        "aggreTurnOver": "Slab: Rs. 0 to 40 lakhs",
                        "aggreTurnOverFY": None,
                        "constitution": "Proprietorship",
                    },
                    "branchDetails": {
                        "permanentAdd": {
                            "address": "4/1576/1/2, Kummara Kottala, Proddatur, YSR Kadapa, Andhra Pradesh, 516360",
                            "dealsIn": "Industrial Brake Systems and Components",
                        },
                        "additionalAdd": [],
                    },
                    "hsnDetails": {
                        "goods": [
                            {
                                "hsnCode": "6813",
                                "hsnDescription": "friction material and articles for brakes, clutches or similar applications.",
                            }
                        ],
                        "services": [],
                    },
                    "liabilityPaidDetails": {
                        "currFinYear": "2026-2027",
                        "prevFinYear": "2025-2026",
                        "prevTotal_pct": 0,
                        "currDetails": [{"period": "April", "liabPaid_Pct": 0}],
                        "prevDetails": [{"period": "March", "liabPaid_Pct": 0}],
                    },
                    "filingFrequency": None,
                    "filingFrequencyLastYear": None,
                },
            },
        }

        try:
            with patch(
                "app.gst.gst_router.execute_gst_advance_search",
                new_callable=AsyncMock,
            ) as mock_exec:
                mock_exec.return_value = postman_payload

                res = client.post(
                    "/api/v1/gst/advance-search",
                    json={"gstNumber": "37EREPR9114M1Z4"},
                )
                self.assertEqual(res.status_code, 200)
                json_data = res.json()

                # Verify exact Postman keys are preserved by backend
                basic = json_data["data"]["data"]["basicDetails"]
                self.assertEqual(basic["legal_Name"], "MUDDISETTY LAKSHMI RAJESWARI")
                self.assertEqual(basic["aggreTurnOver"], "Slab: Rs. 0 to 40 lakhs")
                self.assertIsNone(basic["aggreTurnOverFY"])

                branch = json_data["data"]["data"]["branchDetails"]
                self.assertIn("Kummara Kottala", branch["permanentAdd"]["address"])

                goods = json_data["data"]["data"]["hsnDetails"]["goods"]
                self.assertEqual(goods[0]["hsnCode"], "6813")

                liab = json_data["data"]["data"]["liabilityPaidDetails"]
                self.assertEqual(liab["currFinYear"], "2026-2027")
                self.assertEqual(liab["prevTotal_pct"], 0)
        finally:
            app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    unittest.main()
