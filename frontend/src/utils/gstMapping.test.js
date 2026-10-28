import assert from "node:assert";
import {
  formatAddress,
  getFieldVal,
  formatSafeValue,
  formatPercentage,
  formatRegistrationDate,
  normalizeRecords,
  extractGstData,
  mapBasicDetails,
  mapBranchDetails,
  mapHsnDetails,
  mapLiabilityDetails,
  mapFilingFrequency,
} from "./gstMapping.js";

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
// 2. ALTERNATIVE GST RESPONSE FIXTURE (Testing non-hardcoded generalization)
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

console.log("Starting GST Advance Search mapping verification suite...\n");

// =========================================================================
// RUN TESTS FOR POSTMAN SAMPLE RESPONSE
// =========================================================================
const extracted = extractGstData(POSTMAN_SAMPLE_RESPONSE);
assert.ok(extracted, "extractGstData should unwrap data.data container");

// Verification 1: Registration status shows Active
const basic = mapBasicDetails(extracted.basicDetails, "37EREPR9114M1Z4");
assert.strictEqual(basic.regStatus, "Active", "1. Registration status must show Active");

// Verification 2: Legal name is populated
assert.strictEqual(basic.legalName, "MUDDISETTY LAKSHMI RAJESWARI", "2. Legal name must show MUDDISETTY LAKSHMI RAJESWARI");
assert.strictEqual(basic.tradeName, "M/S LAKSHMI INDUSTRIAL BRAKE SYSTEMS", "Trade Name must show M/S LAKSHMI INDUSTRIAL BRAKE SYSTEMS");
assert.strictEqual(basic.regType, "Regular", "Taxpayer Type must show Regular");
assert.strictEqual(basic.constitution, "Proprietorship", "Constitution must show Proprietorship");

// Verification 3: Aggregate turnover shows returned slab
assert.strictEqual(basic.aggregateTurnover, "Slab: Rs. 0 to 40 lakhs", "3. Aggregate turnover must show Slab: Rs. 0 to 40 lakhs");
assert.strictEqual(basic.turnoverFY, null, "Turnover FY is null in sample response");

// Verification 4: Principal address is populated
const branch = mapBranchDetails(extracted.branchDetails);
assert.strictEqual(
  branch.principalAddress,
  "4/1576/1/2, Kummara Kottala, Proddatur, YSR Kadapa, Andhra Pradesh, 516360",
  "4. Principal address must show 4/1576/1/2, Kummara Kottala, Proddatur, YSR Kadapa, Andhra Pradesh, 516360"
);
assert.strictEqual(branch.principalDealsIn, "Industrial Brake Systems and Components");

// Verification 5: All three HSN codes have their actual descriptions
const hsn = mapHsnDetails(extracted.hsnDetails);
assert.strictEqual(hsn.goodsList.length, 3, "5. Should have 3 goods records");
assert.strictEqual(hsn.goodsList[0].code, "6813");
assert.strictEqual(
  hsn.goodsList[0].description,
  "friction material and articles for brakes, clutches or similar applications."
);
assert.strictEqual(hsn.goodsList[1].code, "8431");
assert.strictEqual(
  hsn.goodsList[1].description,
  "parts suitable for machinery in headings 8425 to 8430."
);
assert.strictEqual(hsn.goodsList[2].code, "8479");
assert.strictEqual(
  hsn.goodsList[2].description,
  "machines and mechanical appliances with individual functions not specified elsewhere in the chapter."
);

// Verification 6 & 7: Current and previous year filing tables show actual field values and normalized counts
const currFilings = normalizeRecords(extracted.filingDetails?.currentYear);
const prevFilings = normalizeRecords(extracted.filingDetails?.previousYear);
assert.strictEqual(currFilings.length, 6, "7. Current year normalized count must be 6");
assert.strictEqual(prevFilings.length, 2, "7. Previous year normalized count must be 2");

assert.strictEqual(currFilings[0].finYear, "2026-2027", "6. Current year finYear must show 2026-2027");
assert.strictEqual(currFilings[0].period, "April");
assert.strictEqual(currFilings[0].returnType, "GSTR1");
assert.strictEqual(currFilings[0].filingDate, "11/05/2026");
assert.strictEqual(currFilings[0].mode, "ONLINE");
assert.strictEqual(currFilings[0].status, "Filed");
assert.strictEqual(currFilings[0].arn, "AA3704260000001");

assert.strictEqual(prevFilings[0].finYear, "2025-2026", "6. Previous year finYear must show 2025-2026");
assert.strictEqual(prevFilings[0].returnType, "GSTR3B");

// Verification 8 & 9: Liability tables show 6 current-year and 12 previous-year records, zero displayed as 0%
const liab = mapLiabilityDetails(extracted.liabilityPaidDetails);
assert.strictEqual(liab.currDetails.length, 6, "8. Liability current-year must have 6 records");
assert.strictEqual(liab.prevDetails.length, 12, "8. Liability previous-year must have 12 records");
assert.strictEqual(liab.currFinYear, "2026-2027");
assert.strictEqual(liab.prevFinYear, "2025-2026");
assert.strictEqual(formatPercentage(liab.prevTotal_pct), "0%", "9. Previous year total 0 must display as 0%");
assert.strictEqual(formatPercentage(liab.currDetails[0].liabPaid_Pct), "0%", "9. Record 0 percentage must display as 0%");
assert.strictEqual(formatPercentage(liab.prevDetails[0].liabPaid_Pct), "0%", "9. Record 0 percentage must display as 0%");

// Verification 10: Filing frequency displays as unavailable because both returned values are null
const freq = mapFilingFrequency(extracted);
assert.strictEqual(freq.filingFrequencyCurrent, "Unavailable", "10. Null filing frequency must show Unavailable");
assert.strictEqual(freq.filingFrequencyPrevious, "Unavailable", "10. Null previous filing frequency must show Unavailable");

// Verification 11: Empty optional arrays show appropriate empty states
assert.strictEqual(branch.additionalAddresses.length, 0, "11. Empty additional addresses");
assert.strictEqual(hsn.servicesList.length, 0, "11. Empty services list");

console.log("✓ All Postman Sample Response verifications passed (1-11)!");

// =========================================================================
// Verification 12: DIFFERENT GST RESPONSE RENDERS CORRECTLY (Generalization)
// =========================================================================
const altExtracted = extractGstData(ALTERNATIVE_GST_RESPONSE);
const altBasic = mapBasicDetails(altExtracted.basicDetails);
assert.strictEqual(altBasic.legalName, "BHARAT ENTERPRISES PRIVATE LIMITED");
assert.strictEqual(altBasic.tradeName, "BHARAT TECH");
assert.strictEqual(altBasic.regStatus, "Active");
assert.strictEqual(altBasic.regType, "Regular");
assert.strictEqual(altBasic.aggregateTurnover, "₹25 Cr - ₹100 Cr");
assert.strictEqual(altBasic.turnoverFY, "2024-25");
assert.strictEqual(altBasic.einvoiceStatus, "Enabled");
assert.strictEqual(altBasic.aadhaarStatus, "Verified");

const altBranch = mapBranchDetails(altExtracted.branchDetails);
assert.ok(altBranch.principalAddress.includes("Nariman Point"), "Should format nested address object");
assert.strictEqual(altBranch.additionalAddresses.length, 1);
assert.strictEqual(altBranch.additionalAddresses[0].address, "Unit 3, Pune Tech Park, Pune, Maharashtra 411001");

const altHsn = mapHsnDetails(altExtracted.hsnDetails);
assert.strictEqual(altHsn.goodsList.length, 0);
assert.strictEqual(altHsn.servicesList.length, 1);
assert.strictEqual(altHsn.servicesList[0].code, "998313");

const altFilings = normalizeRecords(altExtracted.filingDetails?.currentYear);
assert.strictEqual(altFilings.length, 1);
assert.strictEqual(altFilings[0].fy, "2024-25");

const altLiab = mapLiabilityDetails(altExtracted.liabilityPaidDetails);
assert.strictEqual(altLiab.currDetails.length, 1);
assert.strictEqual(formatPercentage(altLiab.currDetails[0].liabilityPaid), "100.00%");

const altFreq = mapFilingFrequency(altExtracted);
assert.strictEqual(altFreq.filingFrequencyCurrent, "Monthly");
assert.strictEqual(altFreq.filingFrequencyPrevious, "Monthly");

console.log("✓ Verification 12 passed: Alternative GST response parsed dynamically without hardcoded sample data!");

// =========================================================================
// Edge Case Tests: formatSafeValue & formatPercentage
// =========================================================================
assert.strictEqual(formatSafeValue(null), "-");
assert.strictEqual(formatSafeValue(undefined), "-");
assert.strictEqual(formatSafeValue(""), "-");
assert.strictEqual(formatSafeValue("   "), "-");
assert.strictEqual(formatSafeValue(0), "0");
assert.strictEqual(formatSafeValue(false), "No");
assert.strictEqual(formatSafeValue(true), "Yes");

assert.strictEqual(formatPercentage(0), "0%");
assert.strictEqual(formatPercentage("0"), "0%");
assert.strictEqual(formatPercentage("0%"), "0%");
assert.strictEqual(formatPercentage(50.5), "50.5%");
assert.strictEqual(formatPercentage(null), "-");
assert.strictEqual(formatPercentage(undefined), "-");

// formatAddress and getFieldVal tests
assert.strictEqual(formatAddress(null), "-");
assert.strictEqual(formatAddress("Single Line Address"), "Single Line Address");
assert.strictEqual(
  formatAddress({ bno: "12", bnm: "Plaza", loc: "Sector 1", dst: "Delhi" }),
  "Building 12, Plaza, Sector 1, Delhi"
);
assert.strictEqual(getFieldVal({ a: null, b: "", c: 0 }, "a", "b", "c"), 0);
assert.strictEqual(getFieldVal(null, "key"), null);

// formatRegistrationDate tests
assert.strictEqual(formatRegistrationDate("01/07/2017"), "01/07/2017");
assert.strictEqual(formatRegistrationDate("2020-03-15"), "15/03/2020");
assert.strictEqual(formatRegistrationDate(null), "-");

console.log("✓ Edge cases for safe-value and percentage formatting passed!");
console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY (12/12)!");
