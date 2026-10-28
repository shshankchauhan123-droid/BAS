import assert from "node:assert";
import {
  formatSafeValue,
  formatCurrency,
  formatCinDate,
  cleanOfficeAddress,
  extractCinData,
  mapCompanyDetails,
  mapDirectors,
  mapCharges,
  mapAnnualReturns,
  mapBalanceSheets,
} from "./cinMapping.js";

console.log("Starting CIN Advance Search mapping verification suite...\n");

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
    companyCategory: null, // Null in sample response
    companySubCategory: null, // Null in sample response
    companyClass: null, // Null in sample response
    authorizedCapital: 0, // Must format as ₹0.00
    paidupCapital: 0, // Must format as ₹0.00
    companyRegistrationdate_date: "26/10/2026",
    companyROCcode: "RoC-Hyderabad",
    listingstatus: "Unlisted",
    companyIndian: "Indian",
    nofDirectors: 0, // API reports 0, but cIN_DINs has 10 records / 4 unique DINs
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
    last_AGM: null, // Null in sample response
    last_BalanceSheet: null, // Null in sample response
    number_Of_Members: null, // Null in sample response
    // 10 Role records across 4 distinct DINs (00112233, 00223344, 00334455, 00445566)
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
    cIN_Charges: [], // Empty array in sample
    annualReturnFillingInfo: [], // Empty array in sample
    balanceSheet: [], // Empty array in sample
  },
};

// =========================================================================
// TEST 1: Response extraction handles various wrappers
// =========================================================================
const extractedData = extractCinData(POSTMAN_SAMPLE_ADD5165);
assert.ok(extractedData, "Extracted data should be present");
assert.strictEqual(extractedData.cin, "ADD-5165");
assert.strictEqual(extractedData.companyName, "ZENITH ENTERPRISES PRIVATE LIMITED");

// Alternative wrapper test: double nested
const doubleWrapped = { data: { data: POSTMAN_SAMPLE_ADD5165.data } };
assert.strictEqual(extractCinData(doubleWrapped).cin, "ADD-5165");

// Alternative wrapper test: raw object
assert.strictEqual(extractCinData(POSTMAN_SAMPLE_ADD5165.data).cin, "ADD-5165");
console.log("✓ Test 1 Passed: Response extraction unwraps all wrapper levels safely");

// =========================================================================
// TEST 2: Company details mapping & zero currency formatting
// =========================================================================
const company = mapCompanyDetails(extractedData);
assert.strictEqual(company.cin, "ADD-5165");
assert.strictEqual(company.companyName, "ZENITH ENTERPRISES PRIVATE LIMITED");
assert.strictEqual(company.companyStatus, "Active");
assert.strictEqual(company.registrationDate, "26/10/2026");
assert.strictEqual(company.rocCode, "RoC-Hyderabad");
assert.strictEqual(company.listingStatus, "Unlisted");
assert.strictEqual(company.originType, "Indian");
assert.strictEqual(company.apiDirectorCount, 0);
assert.strictEqual(company.apiDirectorCountFormatted, "0");

// Verify zero currency formats as ₹0.00
assert.strictEqual(company.authorizedCapitalFormatted, "₹0.00");
assert.strictEqual(company.paidupCapitalFormatted, "₹0.00");
console.log("✓ Test 2 Passed: Company basic details and zero capital (₹0.00) mapped correctly");

// =========================================================================
// TEST 3: Null and missing optional fields map to "Not available"
// =========================================================================
assert.strictEqual(company.companyCategory, "Not available");
assert.strictEqual(company.companySubCategory, "Not available");
assert.strictEqual(company.companyClass, "Not available");
assert.strictEqual(company.lastAgm, "Not available");
assert.strictEqual(company.lastBalanceSheet, "Not available");
assert.strictEqual(company.numberOfMembers, "Not available");
console.log("✓ Test 3 Passed: Optional/null fields fall back to 'Not available' without crashing");

// =========================================================================
// TEST 4: Address cleaning preserves content and cleans duplicate commas
// =========================================================================
assert.strictEqual(
  company.registeredOfficeAddress,
  "Plot No 42, Hitech City, Madhapur, Hyderabad, Telangana, 500081"
);
assert.strictEqual(company.city, "Hyderabad");
assert.strictEqual(company.state, "Telangana");
assert.strictEqual(company.pincode, "500081");
assert.strictEqual(company.country, "India");
assert.strictEqual(company.rdName, "RD South East");
assert.strictEqual(company.rdRegion, "South East Region");
assert.strictEqual(company.officialEmail, "compliance@zenithenterprises.com");
console.log("✓ Test 4 Passed: Registered office address cleaned up and location fields mapped");

// =========================================================================
// TEST 5: Director mapping with exact properties and appointment date from datE_JOIN
// =========================================================================
const directors = mapDirectors(extractedData.cIN_DINs, extractedData.nofDirectors);

// Verify total records and unique director counts
assert.strictEqual(directors.totalRoleRecords, 10, "Total role records must be 10");
assert.strictEqual(directors.uniqueDirectorCount, 4, "Unique director count must be 4");
assert.strictEqual(directors.apiReportedCount, 0, "API reported count must be preserved as 0");
assert.strictEqual(directors.distinctDins.length, 4);

// First record checks
const r0 = directors.records[0];
assert.strictEqual(r0.name, "ANIL KAPOOR");
assert.strictEqual(r0.din, "00112233");
assert.strictEqual(r0.designation, "Managing Director");
assert.strictEqual(r0.dateJoin, "26/10/2026");
assert.strictEqual(r0.dateResign, "-");
assert.strictEqual(r0.dscExpiry, "31/12/2028"); // Formatted from 2028-12-31
assert.strictEqual(r0.noOfCompanies, "3");

// Second record with same DIN but different designation preserved
const r1 = directors.records[1];
assert.strictEqual(r1.name, "ANIL KAPOOR");
assert.strictEqual(r1.din, "00112233");
assert.strictEqual(r1.designation, "Chief Executive Officer");
assert.strictEqual(r1.dateJoin, "26/10/2026");

// Verify record with non-null resignation date
const r7 = directors.records[7];
assert.strictEqual(r7.name, "DEEPAK MEHTA");
assert.strictEqual(r7.din, "00445566");
assert.strictEqual(r7.designation, "Independent Director");
assert.strictEqual(r7.dateResign, "01/01/2027"); // Formatted from 2027-01-01
assert.strictEqual(r7.dscExpiry, "30/11/2026"); // Formatted from 2026-11-30
console.log("✓ Test 5 Passed: Director records mapped from datE_JOIN, datE_RESIGN, dsC_EXPIRY, noOfCompanies");

// =========================================================================
// TEST 6: Unique director count vs total role records vs API reported count
// =========================================================================
assert.strictEqual(directors.uniqueDirectorCount, 4);
assert.strictEqual(directors.totalRoleRecords, 10);
assert.strictEqual(directors.apiReportedCount, 0);
assert.deepStrictEqual(directors.distinctDins, [
  "00112233",
  "00223344",
  "00334455",
  "00445566",
]);
console.log("✓ Test 6 Passed: Clear distinction between Unique Directors (4), Role Records (10), API Count (0)");

// =========================================================================
// TEST 7: Empty charges and filings arrays return empty lists without crashing
// =========================================================================
const charges = mapCharges(extractedData.cIN_Charges);
assert.strictEqual(charges.length, 0);

const annualReturns = mapAnnualReturns(extractedData.annualReturnFillingInfo);
assert.strictEqual(annualReturns.length, 0);

const balanceSheets = mapBalanceSheets(extractedData.balanceSheet);
assert.strictEqual(balanceSheets.length, 0);
console.log("✓ Test 7 Passed: Empty arrays for charges, annual returns, and balance sheets handled cleanly");

// =========================================================================
// TEST 8: Generalization with Alternative CIN Response (e.g. Non-zero capital, charges, filings)
// =========================================================================
const ALT_CIN_RESPONSE = {
  success: true,
  data: {
    cin: "U72200TG2020PTC123456",
    companyName: "INNOVATION TECHNOLOGIES PRIVATE LIMITED",
    companyStatus: "Active",
    companyCategory: "Company limited by shares",
    companySubCategory: "Non-government company",
    companyClass: "Private",
    authorizedCapital: 25000000.0,
    paidupCapital: 10000000.0,
    companyRegistrationdate_date: "2020-08-15",
    companyROCcode: "RoC-Bangalore",
    listingstatus: "Unlisted",
    companyIndian: "Indian",
    nofDirectors: 2,
    registered_Office_Address:
      "4th Floor, Tech Park, Whitefield, Bangalore, Karnataka, 560066",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560066",
    country: "India",
    rdName: "RD South",
    rdRegion: "South Region",
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

const altData = extractCinData(ALT_CIN_RESPONSE);
const altComp = mapCompanyDetails(altData);
assert.strictEqual(altComp.cin, "U72200TG2020PTC123456");
assert.strictEqual(altComp.companyCategory, "Company limited by shares");
assert.strictEqual(altComp.companySubCategory, "Non-government company");
assert.strictEqual(altComp.companyClass, "Private");
assert.strictEqual(altComp.authorizedCapitalFormatted, "₹2,50,00,000.00");
assert.strictEqual(altComp.paidupCapitalFormatted, "₹1,00,00,000.00");
assert.strictEqual(altComp.registrationDate, "15/08/2020");
assert.strictEqual(altComp.lastAgm, "25/09/2024");
assert.strictEqual(altComp.lastBalanceSheet, "31/03/2024");
assert.strictEqual(altComp.numberOfMembers, "3");

const altDirs = mapDirectors(altData.cIN_DINs, altData.nofDirectors);
assert.strictEqual(altDirs.uniqueDirectorCount, 2);
assert.strictEqual(altDirs.totalRoleRecords, 2);
assert.strictEqual(altDirs.apiReportedCount, 2);

const altCharges = mapCharges(altData.cIN_Charges);
assert.strictEqual(altCharges.length, 1);
assert.strictEqual(altCharges[0].chargeId, "10012345");
assert.strictEqual(altCharges[0].holderName, "HDFC BANK LIMITED");
assert.strictEqual(altCharges[0].chargeAmountFormatted, "₹50,00,000.00");
assert.strictEqual(altCharges[0].status, "OPEN");

const altReturns = mapAnnualReturns(altData.annualReturnFillingInfo);
assert.strictEqual(altReturns.length, 1);
assert.strictEqual(altReturns[0].form, "MGT-7");

const altBS = mapBalanceSheets(altData.balanceSheet);
assert.strictEqual(altBS.length, 1);
assert.strictEqual(altBS[0].form, "AOC-4");
console.log("✓ Test 8 Passed: Alternative CIN response parsed dynamically without hardcoded data");

// =========================================================================
// TEST 9: Edge cases for formatSafeValue, formatCurrency, and cleanOfficeAddress
// =========================================================================
assert.strictEqual(formatSafeValue(null), "Not available");
assert.strictEqual(formatSafeValue(undefined), "Not available");
assert.strictEqual(formatSafeValue(""), "Not available");
assert.strictEqual(formatSafeValue("   "), "Not available");
assert.strictEqual(formatSafeValue(0), "0");
assert.strictEqual(formatSafeValue(false), "No");
assert.strictEqual(formatSafeValue(true), "Yes");

assert.strictEqual(formatCurrency(0), "₹0.00");
assert.strictEqual(formatCurrency("0"), "₹0.00");
assert.strictEqual(formatCurrency(0.0), "₹0.00");
assert.strictEqual(formatCurrency(null), "Not available");
assert.strictEqual(formatCurrency(undefined), "Not available");
assert.strictEqual(formatCurrency(""), "Not available");
assert.strictEqual(formatCurrency(5000), "₹5,000.00");

assert.strictEqual(cleanOfficeAddress(null), "Not available");
assert.strictEqual(cleanOfficeAddress(""), "Not available");
assert.strictEqual(
  cleanOfficeAddress("  Road 1 , , , Locality , City  "),
  "Road 1, Locality, City"
);

assert.strictEqual(formatCinDate("26/10/2026"), "26/10/2026");
assert.strictEqual(formatCinDate("2024-03-31"), "31/03/2024");
assert.strictEqual(formatCinDate(null), "Not available");
assert.strictEqual(formatCinDate(""), "Not available");
console.log("✓ Test 9 Passed: Edge cases for safe value, currency, date, and address cleaning passed");

console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY (9/9)!\n");
