import assert from "node:assert";
import { exportCinReportPdf } from "./cinPdfExport.js";

// =========================================================================
// 1. SAMPLE POSTMAN RESPONSE FIXTURE FOR CIN ADD-5165
// =========================================================================
const POSTMAN_SAMPLE_ADD5165 = {
  success: true,
  statusCode: 200,
  successMessage: "CIN Details Fetched Successfully",
  isFromDB: false,
  errorMessage: null,
  data: {
    autoId: 90210,
    cin: "ADD-5165",
    companyName: "ZENITH ENTERPRISES PRIVATE LIMITED",
    companyStatus: "Active",
    companyCategory: null,
    companySubCategory: null,
    companyClass: null,
    authorizedCapital: 0,
    paidupCapital: 0,
    companyRegistrationdate_date: "26/10/2026",
    companyROCcode: "RoC-Hyderabad",
    listingstatus: "Unlisted",
    companyIndian: "Indian",
    nofDirectors: 0,
    registered_Office_Address:
      "Plot No 42, , Hitech City,  , Madhapur, , Hyderabad, Telangana, 500081, ",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    country: "India",
    rdName: "RD South East",
    rdRegion: "South East Region",
    companyStateCode: "36",
    email: "compliance@zenithenterprises.com",
    last_AGM: null,
    last_BalanceSheet: null,
    number_Of_Members: null,
    cIN_DINs: [
      {
        name: "ANIL KAPOOR",
        din: "00112233",
        designation: "Managing Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2028-12-31",
        noOfCompanies: 3,
      },
      {
        name: "ANIL KAPOOR",
        din: "00112233",
        designation: "Chief Executive Officer",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2028-12-31",
        noOfCompanies: 3,
      },
      {
        name: "BHAVNA SHAH",
        din: "00223344",
        designation: "Whole-time Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2027-05-15",
        noOfCompanies: 2,
      },
      {
        name: "BHAVNA SHAH",
        din: "00223344",
        designation: "Chief Financial Officer",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2027-05-15",
        noOfCompanies: 2,
      },
      {
        name: "BHAVNA SHAH",
        din: "00223344",
        designation: "Manager",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2027-05-15",
        noOfCompanies: 2,
      },
      {
        name: "CHANDRAKANT REDDY",
        din: "00334455",
        designation: "Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: null,
        noOfCompanies: 1,
      },
      {
        name: "CHANDRAKANT REDDY",
        din: "00334455",
        designation: "Company Secretary",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: null,
        noOfCompanies: 1,
      },
      {
        name: "DEEPAK MEHTA",
        din: "00445566",
        designation: "Independent Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: "2027-01-01",
        dsC_EXPIRY: "2026-11-30",
        noOfCompanies: 4,
      },
      {
        name: "DEEPAK MEHTA",
        din: "00445566",
        designation: "Additional Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: "2026-12-15",
        dsC_EXPIRY: "2026-11-30",
        noOfCompanies: 4,
      },
      {
        name: "DEEPAK MEHTA",
        din: "00445566",
        designation: "Alternate Director",
        datE_JOIN: "26/10/2026",
        datE_RESIGN: null,
        dsC_EXPIRY: "2026-11-30",
        noOfCompanies: 4,
      },
    ],
    cIN_Charges: [],
    annualReturnFillingInfo: [],
    balanceSheet: [],
  },
};

// =========================================================================
// 2. ALTERNATIVE CIN RESPONSE FIXTURE (With charges & filings)
// =========================================================================
const ALT_CIN_RESPONSE = {
  success: true,
  statusCode: 200,
  data: {
    cin: "U72200TG2020PTC123456",
    companyName: "INNOVATION TECHNOLOGIES PRIVATE LIMITED",
    companyStatus: "Active",
    companyCategory: "Company limited by shares",
    companySubCategory: "Non-government company",
    companyClass: "Private",
    authorizedCapital: 25000000.0,
    paidupCapital: 10000000.0,
    companyRegistrationdate_date: "15/08/2020",
    companyROCcode: "RoC-Bangalore",
    listingstatus: "Unlisted",
    companyIndian: "Indian",
    nofDirectors: 2,
    registered_Office_Address:
      "Brigade Tech Gardens, Brookefield, Bangalore, Karnataka, 560066",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560066",
    country: "India",
    rdName: "RD South",
    rdRegion: "South Region",
    companyStateCode: "29",
    email: "info@innovationtech.com",
    last_AGM: "2024-09-25",
    last_BalanceSheet: "2024-03-31",
    number_Of_Members: 3,
    cIN_DINs: [
      {
        name: "VIKRAM JOSHI",
        din: "09876543",
        designation: "Director",
        datE_JOIN: "15/08/2020",
        datE_RESIGN: null,
        dsC_EXPIRY: "2026-10-30",
        noOfCompanies: 1,
      },
      {
        name: "ANANYA RAO",
        din: "08765432",
        designation: "Director",
        datE_JOIN: "15/08/2020",
        datE_RESIGN: null,
        dsC_EXPIRY: "2027-02-28",
        noOfCompanies: 2,
      },
    ],
    cIN_Charges: [
      {
        chargeId: "10012345",
        holderName: "HDFC BANK LIMITED",
        dateOfCreation: "2021-06-10",
        dateOfModification: null,
        dateOfSatisfaction: null,
        chargeAmount: 5000000.0,
        status: "OPEN",
      },
    ],
    annualReturnFillingInfo: [
      {
        financialYear: "2023-24",
        agmDate: "2024-09-25",
        filingDate: "2024-10-20",
        form: "MGT-7",
        srn: "F11223344",
      },
    ],
    balanceSheet: [
      {
        financialYear: "2023-24",
        filingDate: "2024-10-22",
        form: "AOC-4",
        srn: "F55667788",
      },
    ],
  },
};

async function runTests() {
  console.log("Starting CIN Advance Search PDF Export verification suite...\n");

  // =========================================================================
  // Test 1: exportCinReportPdf generates valid PDF buffer from Postman Response
  // =========================================================================
  const pdfBuffer = await exportCinReportPdf(POSTMAN_SAMPLE_ADD5165, "ADD-5165", {
    returnBuffer: true,
  });

  assert.ok(pdfBuffer, "PDF buffer must be generated");
  assert.ok(
    pdfBuffer.byteLength > 8000,
    `PDF size must be substantial (actual: ${pdfBuffer.byteLength} bytes)`
  );

  const uint8 = new Uint8Array(pdfBuffer);
  const pdfHeader = String.fromCharCode(...uint8.slice(0, 5));
  assert.strictEqual(
    pdfHeader,
    "%PDF-",
    "Generated document must have valid %PDF- magic bytes"
  );

  console.log(
    `✓ Test 1 Passed: Generated vector PDF for ADD-5165 (${pdfBuffer.byteLength} bytes)`
  );

  // =========================================================================
  // Test 2: exportCinReportPdf with Alternative Response (with charges & filings)
  // =========================================================================
  const altPdfBuffer = await exportCinReportPdf(
    ALT_CIN_RESPONSE,
    "U72200TG2020PTC123456",
    {
      returnBuffer: true,
    }
  );

  assert.ok(altPdfBuffer, "Alternative PDF buffer must be generated");
  assert.ok(
    altPdfBuffer.byteLength > 8000,
    `Alternative PDF size must be substantial (actual: ${altPdfBuffer.byteLength} bytes)`
  );

  const altUint8 = new Uint8Array(altPdfBuffer);
  const altPdfHeader = String.fromCharCode(...altUint8.slice(0, 5));
  assert.strictEqual(
    altPdfHeader,
    "%PDF-",
    "Alternative document must have valid %PDF- magic bytes"
  );

  console.log(
    `✓ Test 2 Passed: Generated vector PDF for alternative response (${altPdfBuffer.byteLength} bytes)`
  );

  // =========================================================================
  // Test 3: Edge Case - Sparse / Empty Response
  // =========================================================================
  const sparseResponse = {
    data: {
      cin: "SPARSE-001",
      companyName: "SPARSE HOLDINGS LIMITED",
      companyStatus: "Active",
      cIN_DINs: [],
      cIN_Charges: [],
      annualReturnFillingInfo: [],
      balanceSheet: [],
    },
  };

  const sparseBuffer = await exportCinReportPdf(sparseResponse, "SPARSE-001", {
    returnBuffer: true,
  });
  assert.ok(
    sparseBuffer.byteLength > 5000,
    "Sparse response PDF should still generate cleanly"
  );

  console.log(
    `✓ Test 3 Passed: Generated vector PDF for sparse response (${sparseBuffer.byteLength} bytes)`
  );

  // =========================================================================
  // Test 4: Error Handling - Missing or invalid data
  // =========================================================================
  let errorCaught = false;
  try {
    await exportCinReportPdf(null);
  } catch (err) {
    errorCaught = true;
    assert.strictEqual(
      err.message,
      "No CIN response data available for PDF generation."
    );
  }
  assert.ok(errorCaught, "Should throw on null input");

  console.log(
    "✓ Test 4 Passed: Error handling triggers correctly for invalid inputs"
  );

  console.log("\nALL CIN PDF EXPORT TESTS PASSED SUCCESSFULLY (4/4)!\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
