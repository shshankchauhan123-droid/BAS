import assert from "node:assert";
import { extractAllFilingRecords, exportGstReportPdf } from "./gstPdfExport.js";

// =========================================================================
// 1. EXACT SAMPLE POSTMAN RESPONSE FIXTURE
// =========================================================================
const POSTMAN_SAMPLE_RESPONSE = {
  success: true,
  statusCode: 200,
  successMessage: "GST Details Fetched Successfully",
  isFromDB: false,
  errorMessage: null,
  data: {
    status: true,
    errdata: null,
    data: {
      basicDetails: {
        gstin: "37EREPR9114M1Z4",
        registrationStatus: "Active",
        registrationType: "Regular",
        registrationDate: "01/07/2017",
        aggreTurnOver: "Slab: Rs. 0 to 40 lakhs",
        aggreTurnOverFY: null,
        legal_Name: "MUDDISETTY LAKSHMI RAJESWARI",
        tradeNam: "M/S LAKSHMI INDUSTRIAL BRAKE SYSTEMS",
        constitution: "Proprietorship",
        jurisdiction: "Proddatur Circle",
        ctj: "Range - Proddatur",
        eInvoiceStatus: "No",
        mandatedeInvoice: "No",
        aadharVerified: "Yes",
        businessNature: "Manufacturing, Retail Business",
        cancellationDate: null,
      },
      branchDetails: {
        permanentAdd: {
          address: "4/1576/1/2, Kummara Kottala, Proddatur, YSR Kadapa, Andhra Pradesh, 516360",
          dealsIn: "Industrial Brake Systems and Components",
        },
        additionalAdd: [],
      },
      hsnDetails: {
        goods: [
          {
            hsnCode: "6813",
            hsnDescription: "friction material and articles for brakes, clutches or similar applications.",
          },
          {
            hsnCode: "8431",
            hsnDescription: "parts suitable for machinery in headings 8425 to 8430.",
          },
          {
            hsnCode: "8479",
            hsnDescription: "machines and mechanical appliances with individual functions not specified elsewhere in the chapter.",
          },
        ],
        services: [],
      },
      filingDetails: {
        currentYear: {
          filingStatus: [
            [
              {
                finYear: "2026-2027",
                period: "April",
                returnType: "GSTR1",
                filingDate: "11/05/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3704260000001",
              },
              {
                finYear: "2026-2027",
                period: "April",
                returnType: "GSTR3B",
                filingDate: "20/05/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3704260000002",
              },
              {
                finYear: "2026-2027",
                period: "May",
                returnType: "GSTR1",
                filingDate: "11/06/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3705260000003",
              },
              {
                finYear: "2026-2027",
                period: "May",
                returnType: "GSTR3B",
                filingDate: "20/06/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3705260000004",
              },
              {
                finYear: "2026-2027",
                period: "June",
                returnType: "GSTR1",
                filingDate: "11/07/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3706260000005",
              },
              {
                finYear: "2026-2027",
                period: "June",
                returnType: "GSTR1A",
                filingDate: "15/07/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3706260000006",
              },
            ],
          ],
        },
        previousYear: {
          filingStatus: [
            [
              {
                finYear: "2025-2026",
                period: "March",
                returnType: "GSTR3B",
                filingDate: "20/04/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3703260000007",
              },
              {
                finYear: "2025-2026",
                period: "March",
                returnType: "GSTR1",
                filingDate: "11/04/2026",
                mode: "ONLINE",
                status: "Filed",
                arn: "AA3703260000008",
              },
            ],
          ],
        },
      },
      liabilityPaidDetails: {
        currFinYear: "2026-2027",
        prevFinYear: "2025-2026",
        prevTotal_pct: 0,
        currDetails: [
          { period: "April", liabPaid_Pct: 0 },
          { period: "May", liabPaid_Pct: 0 },
          { period: "June", liabPaid_Pct: 0 },
          { period: "July", liabPaid_Pct: 0 },
          { period: "August", liabPaid_Pct: 0 },
          { period: "September", liabPaid_Pct: 0 },
        ],
        prevDetails: [
          { period: "April", liabPaid_Pct: 0 },
          { period: "May", liabPaid_Pct: 0 },
          { period: "June", liabPaid_Pct: 0 },
          { period: "July", liabPaid_Pct: 0 },
          { period: "August", liabPaid_Pct: 0 },
          { period: "September", liabPaid_Pct: 0 },
          { period: "October", liabPaid_Pct: 0 },
          { period: "November", liabPaid_Pct: 0 },
          { period: "December", liabPaid_Pct: 0 },
          { period: "January", liabPaid_Pct: 0 },
          { period: "February", liabPaid_Pct: 0 },
          { period: "March", liabPaid_Pct: 0 },
        ],
      },
      filingFrequency: null,
      filingFrequencyLastYear: null,
    },
    message: "Success",
  },
};

// =========================================================================
// 2. ALTERNATIVE GST RESPONSE FIXTURE
// =========================================================================
const ALTERNATIVE_GST_RESPONSE = {
  data: {
    basicDetails: {
      gstin: "27AAAAA0000A1Z5",
      lgnm: "BHARAT ENTERPRISES PRIVATE LIMITED",
      tradeName: "BHARAT TECH",
      sts: "Active",
      taxpayerType: "Regular",
      registrationDate: "2020-03-15",
      aggregateTurnover: "₹25 Cr - ₹100 Cr",
      turnoverFY: "2024-25",
      constitution: "Private Limited",
      jurisdiction: "Mumbai Ward 4",
      ctj: "Range 10, Division 2",
      einvoiceStatus: true,
      aadharVerified: true,
      businessNature: ["IT Services", "Consulting"],
    },
    branchDetails: {
      pradr: {
        addr: {
          bno: "501",
          bnm: "Nariman Point Tower",
          st: "Marine Drive",
          loc: "Nariman Point",
          dst: "Mumbai",
          stcd: "Maharashtra",
          pncd: "400021",
        },
        ntr: "Headquarters",
      },
      additionalAdd: [
        {
          address: "Unit 3, Pune Tech Park, Pune, Maharashtra 411001",
          dealsIn: "Software Development",
        },
      ],
    },
    hsnDetails: {
      goods: [],
      services: [
        {
          sacCode: "998313",
          description: "Information technology consulting and support services",
        },
      ],
    },
    filingDetails: {
      currentYear: {
        filingStatus: [
          [
            {
              fy: "2024-25",
              taxp: "January",
              rtntype: "GSTR3B",
              dof: "20/02/2025",
              mof: "ONLINE",
              status: "Filed",
              arn: "AA2701250000001",
            },
          ],
        ],
      },
      previousYear: {
        filingStatus: [],
      },
    },
    liabilityPaidDetails: [
      { fy: "2024-25", taxp: "January", liabilityPaid: "100.00%" },
    ],
    filingFrequency: "Monthly",
    filingFrequencyLastYear: "Monthly",
  },
};

async function runTests() {
  console.log("Starting GST Advance Search PDF Export verification suite...\n");

  // =========================================================================
  // Test 1: extractAllFilingRecords - Flatten multi-year records correctly
  // =========================================================================
  const postmanFilingDetails = POSTMAN_SAMPLE_RESPONSE.data.data.filingDetails;
  const records = extractAllFilingRecords(postmanFilingDetails);

  assert.strictEqual(records.length, 8, "Should extract all 8 filing records across all years");
  assert.strictEqual(records[0].fy, "2026-2027");
  assert.strictEqual(records[0].period, "April");
  assert.strictEqual(records[0].returnType, "GSTR1");
  assert.strictEqual(records[0].filingDate, "11/05/2026");
  assert.strictEqual(records[0].mode, "ONLINE");
  assert.strictEqual(records[0].status, "Filed");
  assert.strictEqual(records[0].arn, "AA3704260000001");

  // Previous year records (indexes 6 & 7)
  assert.strictEqual(records[6].fy, "2025-2026");
  assert.strictEqual(records[6].period, "March");
  assert.strictEqual(records[6].returnType, "GSTR3B");
  assert.strictEqual(records[7].returnType, "GSTR1");

  console.log("✓ Test 1 Passed: extractAllFilingRecords flattens multi-year filing history into 8 records");

  // =========================================================================
  // Test 2: exportGstReportPdf generates valid PDF buffer from Postman Response
  // =========================================================================
  const pdfBuffer = await exportGstReportPdf(POSTMAN_SAMPLE_RESPONSE, "37EREPR9114M1Z4", {
    returnBuffer: true,
  });

  assert.ok(pdfBuffer, "PDF buffer must be generated");
  assert.ok(pdfBuffer.byteLength > 10000, `PDF size must be substantial (actual: ${pdfBuffer.byteLength} bytes)`);

  const uint8 = new Uint8Array(pdfBuffer);
  const pdfHeader = String.fromCharCode(...uint8.slice(0, 5));
  assert.strictEqual(pdfHeader, "%PDF-", "Generated document must have valid %PDF- magic bytes");

  console.log(`✓ Test 2 Passed: Generated vector PDF for 37EREPR9114M1Z4 (${pdfBuffer.byteLength} bytes)`);

  // =========================================================================
  // Test 3: exportGstReportPdf with Alternative Response (dynamic/services)
  // =========================================================================
  const altPdfBuffer = await exportGstReportPdf(ALTERNATIVE_GST_RESPONSE, "27AAAAA0000A1Z5", {
    returnBuffer: true,
  });

  assert.ok(altPdfBuffer, "Alternative PDF buffer must be generated");
  assert.ok(altPdfBuffer.byteLength > 8000, `Alternative PDF size must be substantial (actual: ${altPdfBuffer.byteLength} bytes)`);

  const altUint8 = new Uint8Array(altPdfBuffer);
  const altPdfHeader = String.fromCharCode(...altUint8.slice(0, 5));
  assert.strictEqual(altPdfHeader, "%PDF-", "Alternative document must have valid %PDF- magic bytes");

  console.log(`✓ Test 3 Passed: Generated vector PDF for alternative response (${altPdfBuffer.byteLength} bytes)`);

  // =========================================================================
  // Test 4: Edge Case - Sparse / Empty Response
  // =========================================================================
  const sparseResponse = {
    data: {
      data: {
        basicDetails: {
          gstin: "07AAAAA0000A1Z5",
          legalName: "SPARSE TRADERS",
        },
        branchDetails: {},
        hsnDetails: {},
        filingDetails: {},
        liabilityPaidDetails: null,
      },
    },
  };

  const sparseBuffer = await exportGstReportPdf(sparseResponse, "07AAAAA0000A1Z5", {
    returnBuffer: true,
  });
  assert.ok(sparseBuffer.byteLength > 5000, "Sparse response PDF should still generate cleanly");

  console.log(`✓ Test 4 Passed: Generated vector PDF for sparse response (${sparseBuffer.byteLength} bytes)`);

  // =========================================================================
  // Test 5: Error Handling - Missing or invalid data
  // =========================================================================
  let errorCaught = false;
  try {
    await exportGstReportPdf(null);
  } catch (err) {
    errorCaught = true;
    assert.strictEqual(err.message, "No GST response data available for PDF generation.");
  }
  assert.ok(errorCaught, "Should throw on null input");

  console.log("✓ Test 5 Passed: Error handling triggers correctly for invalid inputs");

  console.log("\nALL GST PDF EXPORT TESTS PASSED SUCCESSFULLY (5/5)!\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
