import os
import sys
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.cin.cin_schema import CinSearchQuery, SEARCH_NUMBER_REGEX
from app.cin.cin_service import (
    get_cin_api_config,
    validate_cin_configuration,
    execute_cin_advance_search,
)
from app.main import app
from app.dependencies.auth import get_current_user


SAMPLE_FACT_CIN_RESPONSE = {
    "success": True,
    "statusCode": 200,
    "successMessage": "CIN Details Fetched Successfully",
    "isFromDB": False,
    "errorMessage": None,
    "data": {
        "autoId": 10452,
        "cin": "ADD-5165",
        "companyName": "ACME GLOBAL TECHNOLOGIES PRIVATE LIMITED",
        "companyROCcode": "RoC-Hyderabad",
        "companyCategory": "Company limited by shares",
        "companySubCategory": "Non-government company",
        "companyClass": "Private",
        "authorizedCapital": 10000000.0,
        "paidupCapital": 5000000.0,
        "companyRegistrationdate_date": "2018-05-15",
        "registered_Office_Address": "Plot No 42, Hitech City, Madhapur, Hyderabad, Telangana, 500081",
        "listingstatus": "Unlisted",
        "companyStatus": "Active",
        "companyIndian": "Indian",
        "email": "compliance@acmeglobal.com",
        "last_AGM": "2024-09-30",
        "last_BalanceSheet": "2024-03-31",
        "number_Of_Members": 2,
        "city": "Hyderabad",
        "state": "Telangana",
        "pincode": "500081",
        "country": "India",
        "companyStateCode": "36",
        "rdName": "RD South East",
        "rdRegion": "South East Region",
        "nofDirectors": 3,
        "cIN_DINs": [
            {
                "din": "01234567",
                "directorName": "RAMESH SHARMA",
                "designation": "Managing Director",
                "dateOfAppointment": "2018-05-15",
                "cessationDate": None,
                "dscExpiryDate": "2026-11-20",
                "numberOfCompanies": 2,
            },
            {
                "din": "02345678",
                "directorName": "PRIYA VERMA",
                "designation": "Whole-time Director",
                "dateOfAppointment": "2019-08-01",
                "cessationDate": None,
                "dscExpiryDate": "2025-10-14",
                "numberOfCompanies": 1,
            },
            {
                "din": "03456789",
                "directorName": "SUNIL KUMAR",
                "designation": "Director",
                "dateOfAppointment": "2021-01-10",
                "cessationDate": "2023-12-31",
                "dscExpiryDate": None,
                "numberOfCompanies": 3,
            },
        ],
        "cIN_Charges": [
            {
                "chargeId": "CHG0019283",
                "holderName": "STATE BANK OF INDIA",
                "dateOfCreation": "2020-03-12",
                "dateOfModification": None,
                "dateOfSatisfaction": None,
                "chargeAmount": 25000000.0,
                "status": "OPEN",
            }
        ],
        "annualReturnFillingInfo": [
            {
                "financialYear": "2023-24",
                "agmDate": "2024-09-30",
                "filingDate": "2024-10-25",
                "form": "MGT-7",
                "srn": "F12345678",
            },
            {
                "financialYear": "2022-23",
                "agmDate": "2023-09-28",
                "filingDate": "2023-10-20",
                "form": "MGT-7",
                "srn": "E87654321",
            },
        ],
        "balanceSheet": [
            {
                "financialYear": "2023-24",
                "filingDate": "2024-10-28",
                "form": "AOC-4",
                "srn": "F99887766",
            },
            {
                "financialYear": "2022-23",
                "filingDate": "2023-10-22",
                "form": "AOC-4",
                "srn": "E11223344",
            },
        ],
    },
}


class TestCinAdvanceSearch(unittest.IsolatedAsyncioTestCase):
    def test_search_number_regex_validation(self):
        valid_numbers = [
            "ADB-0675",
            "ADD-5165",
            "U72200TG2020PTC123456",
            "L01631KA2010PTC096843",
            "AAA-1234",
            "CORP_123",
            "F01234",
        ]
        for val in valid_numbers:
            self.assertTrue(
                bool(SEARCH_NUMBER_REGEX.match(val)),
                f"Expected {val} to be valid",
            )

        invalid_numbers = [
            "",
            "A",
            "AB",
            "INVALID#SYMBOL",
            "BAD@NUMBER",
            "TOOLONGNUMBEREXCEEDINGTHIRTYFIVECHARACTERS123456",
        ]
        for val in invalid_numbers:
            self.assertFalse(
                bool(SEARCH_NUMBER_REGEX.match(val)),
                f"Expected {val} to be invalid",
            )

    def test_cin_search_query_schema_valid(self):
        q = CinSearchQuery(searchNumber="  ADB-0675  ")
        self.assertEqual(q.search_number, "ADB-0675")

    def test_cin_search_query_schema_invalid(self):
        with self.assertRaises(ValidationError):
            CinSearchQuery(searchNumber="")
        with self.assertRaises(ValidationError):
            CinSearchQuery(searchNumber="!!")

    def test_validate_cin_configuration_placeholder_rejection(self):
        bad_config = {
            "api_url": "https://api.fact-byte.com/CIN/NewCINDetails",
            "client_id": "your_actual_client_id",
            "secret_key": "your_actual_secret_key",
            "timeout_seconds": 60,
        }
        with self.assertRaises(HTTPException) as cm:
            validate_cin_configuration(bad_config)
        self.assertEqual(cm.exception.status_code, 503)

    @patch("app.cin.cin_service.get_cin_api_config")
    @patch("httpx.AsyncClient.get")
    async def test_execute_cin_advance_search_success(
        self, mock_get, mock_get_config
    ):
        mock_get_config.return_value = {
            "api_url": "https://api.fact-byte.com/CIN/NewCINDetails",
            "client_id": "valid_cin_client",
            "secret_key": "valid_cin_secret",
            "timeout_seconds": 60.0,
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SAMPLE_FACT_CIN_RESPONSE
        mock_get.return_value = mock_resp

        result = await execute_cin_advance_search("ADB-0675")

        # Verify headers and params sent to upstream
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args.kwargs
        headers = call_kwargs.get("headers", {})
        params = call_kwargs.get("params", {})

        self.assertEqual(headers.get("Accept"), "application/json")
        self.assertEqual(headers.get("clientId"), "valid_cin_client")
        self.assertEqual(headers.get("secreteKey"), "valid_cin_secret")
        self.assertEqual(params.get("searchNumber"), "ADB-0675")

        # Verify result preserves nested structure
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["cin"], "ADD-5165")
        self.assertEqual(
            result["data"]["companyName"],
            "ACME GLOBAL TECHNOLOGIES PRIVATE LIMITED",
        )
        self.assertEqual(len(result["data"]["cIN_DINs"]), 3)
        self.assertEqual(len(result["data"]["cIN_Charges"]), 1)

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
                "app.cin.cin_router.execute_cin_advance_search",
                new_callable=AsyncMock,
            ) as mock_exec:
                mock_exec.return_value = SAMPLE_FACT_CIN_RESPONSE

                # Test /api/v1/cin/advance-search
                res1 = client.get(
                    "/api/v1/cin/advance-search",
                    params={"searchNumber": "ADB-0675"},
                )
                self.assertEqual(res1.status_code, 200)
                data1 = res1.json()
                self.assertTrue(data1["success"])
                self.assertEqual(data1["data"]["cin"], "ADD-5165")

                # Test alias /api/cin/advance-search
                res2 = client.get(
                    "/api/cin/advance-search",
                    params={"searchNumber": "ADB-0675"},
                )
                self.assertEqual(res2.status_code, 200)
                data2 = res2.json()
                self.assertTrue(data2["success"])

                # Test invalid searchNumber (returns 422)
                res3 = client.get(
                    "/api/v1/cin/advance-search",
                    params={"searchNumber": "@@"},
                )
                self.assertEqual(res3.status_code, 422)

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_postman_cin_response_structure_preserved(self):
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
            "successMessage": "CIN Details Fetched Successfully",
            "isFromDB": False,
            "errorMessage": None,
            "data": {
                "autoId": 90210,
                "cin": "ADD-5165",
                "companyName": "ZENITH ENTERPRISES PRIVATE LIMITED",
                "companyStatus": "Active",
                "companyCategory": None,
                "companySubCategory": None,
                "companyClass": None,
                "authorizedCapital": 0.0,
                "paidupCapital": 0.0,
                "companyRegistrationdate_date": "26/10/2026",
                "companyROCcode": "RoC-Hyderabad",
                "listingstatus": "Unlisted",
                "companyIndian": "Indian",
                "nofDirectors": 0,
                "registered_Office_Address": "Plot No 42, Hitech City, Madhapur, Hyderabad, Telangana, 500081",
                "city": "Hyderabad",
                "state": "Telangana",
                "pincode": "500081",
                "country": "India",
                "rdName": "RD South East",
                "rdRegion": "South East Region",
                "email": "compliance@zenithenterprises.com",
                "last_AGM": None,
                "last_BalanceSheet": None,
                "number_Of_Members": None,
                "cIN_DINs": [
                    {
                        "name": "ANIL KAPOOR",
                        "din": "00112233",
                        "designation": "Managing Director",
                        "datE_JOIN": "26/10/2026",
                        "datE_RESIGN": None,
                        "dsC_EXPIRY": "2028-12-31",
                        "noOfCompanies": 3,
                    },
                    {
                        "name": "ANIL KAPOOR",
                        "din": "00112233",
                        "designation": "Chief Executive Officer",
                        "datE_JOIN": "26/10/2026",
                        "datE_RESIGN": None,
                        "dsC_EXPIRY": "2028-12-31",
                        "noOfCompanies": 3,
                    },
                ],
                "cIN_Charges": [],
                "annualReturnFillingInfo": [],
                "balanceSheet": [],
            },
        }

        try:
            with patch(
                "app.cin.cin_router.execute_cin_advance_search",
                new_callable=AsyncMock,
            ) as mock_exec:
                mock_exec.return_value = postman_payload

                res = client.get(
                    "/api/v1/cin/advance-search",
                    params={"searchNumber": "ADD-5165"},
                )
                self.assertEqual(res.status_code, 200)
                json_data = res.json()

                self.assertTrue(json_data["success"])
                data = json_data["data"]
                self.assertEqual(data["cin"], "ADD-5165")
                self.assertEqual(data["nofDirectors"], 0)
                self.assertEqual(data["authorizedCapital"], 0.0)
                self.assertEqual(len(data["cIN_DINs"]), 2)
                self.assertEqual(data["cIN_DINs"][0]["datE_JOIN"], "26/10/2026")
                self.assertEqual(data["cIN_DINs"][0]["noOfCompanies"], 3)
                self.assertEqual(len(data["cIN_Charges"]), 0)
        finally:
            app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    unittest.main()
