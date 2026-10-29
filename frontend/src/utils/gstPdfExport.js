/**
 * GST Advance Search PDF Export Utility
 * Generates a comprehensive, professional, multi-page vector PDF report
 * containing all available data from the FACT GST Advance Search API response.
 *
 * Uses jsPDF and jspdf-autotable for pixel-perfect multi-page tables,
 * typography, text-wrapping, and running headers/footers.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  extractGstData,
  mapBasicDetails,
  mapBranchDetails,
  mapHsnDetails,
  mapLiabilityDetails,
  mapFilingFrequency,
  normalizeRecords,
  formatPercentage,
} from "./gstMapping.js";

// BAS Branding Colors (RGB)
const COLOR_NAVY = [23, 37, 84]; // #172554 - Deep Navy
const COLOR_EMERALD = [5, 150, 105]; // #059669 - BAS Emerald Green
const COLOR_EMERALD_LIGHT = [209, 250, 229]; // #D1FAE5 - Emerald Tint
const COLOR_SLATE_DARK = [30, 41, 59]; // #1E293B - Dark Slate Text
const COLOR_SLATE_MUTED = [100, 116, 139]; // #64748B - Muted Text
const COLOR_BG_LIGHT = [248, 250, 252]; // #F8FAFC - Alternating Table Row
const COLOR_BORDER = [226, 232, 240]; // #E2E8F0 - Divider / Border Line

/**
 * Helper to safely format string values or return fallback
 */
function safeStr(val, fallback = "Not available") {
  if (val === 0 || val === "0") return "0";
  if (val === false) return "No";
  if (val === true) return "Yes";
  if (val === undefined || val === null || val === "" || String(val).trim() === "") {
    return fallback;
  }
  return String(val).trim();
}

/**
 * Flatten all filing history records across all available financial years
 * (Current Year, Previous Year, or additional FY keys).
 */
export function extractAllFilingRecords(filingDetails) {
  if (!filingDetails || typeof filingDetails !== "object") return [];

  const allRecords = [];

  // Helper to extract records from a year object
  const processYearObject = (yearObj, defaultFy) => {
    if (!yearObj) return;
    const fyLabel = safeStr(yearObj.fy || defaultFy, "-");
    const records = normalizeRecords(yearObj);

    records.forEach((r) => {
      allRecords.push({
        fy: safeStr(r.fy || r.finYear || fyLabel, "-"),
        period: safeStr(r.taxp || r.period || r.taxPeriod, "-"),
        returnType: safeStr(r.rtntype || r.returnType, "-"),
        filingDate: safeStr(r.dof || r.filingDate, "-"),
        mode: safeStr(r.mof || r.mode || r.filingMode, "-"),
        status: safeStr(r.status || "Filed", "-"),
        arn: safeStr(r.arn || r.referenceNumber, "-"),
      });
    });
  };

  // Process currentYear
  if (filingDetails.currentYear) {
    processYearObject(filingDetails.currentYear, "Current FY");
  }

  // Process previousYear
  if (filingDetails.previousYear) {
    processYearObject(filingDetails.previousYear, "Previous FY");
  }

  // Process any other financial years if present dynamically
  Object.keys(filingDetails).forEach((key) => {
    if (key !== "currentYear" && key !== "previousYear") {
      const val = filingDetails[key];
      if (val && typeof val === "object") {
        processYearObject(val, key);
      }
    }
  });

  return allRecords;
}

/**
 * Generate and download or return the complete GST Advance Search PDF report.
 *
 * @param {Object} rawResponse - The full API response object returned by backend
 * @param {string} searchedGstin - The searched GSTIN string
 * @param {Object} options - Export options { returnBuffer: boolean, filename: string }
 * @returns {jsPDF|ArrayBuffer}
 */
export async function exportGstReportPdf(rawResponse, searchedGstin = "", options = {}) {
  if (!rawResponse) {
    throw new Error("No GST response data available for PDF generation.");
  }

  const gstData = extractGstData(rawResponse);
  if (!gstData || typeof gstData !== "object") {
    throw new Error("Invalid or unparseable GST data payload in response.");
  }

  // Normalized data models
  const basic = mapBasicDetails(gstData.basicDetails, searchedGstin);
  const branch = mapBranchDetails(gstData.branchDetails);
  const hsn = mapHsnDetails(gstData.hsnDetails);
  const liability = mapLiabilityDetails(gstData.liabilityPaidDetails);
  const frequency = mapFilingFrequency(gstData);
  const filingRecords = extractAllFilingRecords(gstData.filingDetails);

  const cleanGstin = safeStr(basic.gstinVal || searchedGstin, "GSTIN");
  const reportDateStr = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Initialize jsPDF (A4 portrait)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 14;

  // =========================================================================
  // 1. REPORT HEADER BANNER
  // =========================================================================
  const headerHeight = 26;
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Top accent green bar
  doc.setFillColor(...COLOR_EMERALD);
  doc.rect(0, headerHeight - 1.5, pageWidth, 1.5, "F");

  // Header Title - Left
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("BANKING ANALYSIS SYSTEM (BAS)", marginX, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229); // Light emerald
  doc.text("ArthBodh Intelligence Platform • FACT External Taxpayer Registry", marginX, 15);

  // Header Title - Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("GST ADVANCE SEARCH REPORT", pageWidth - marginX, 10, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${reportDateStr}`, pageWidth - marginX, 15, { align: "right" });

  currentY = headerHeight + 5;

  // =========================================================================
  // 2. GST RECORD SUMMARY BANNER
  // =========================================================================
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(`GSTIN: ${cleanGstin}`, marginX + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_SLATE_DARK);
  const legalNameDisplay = basic.legalName !== "-" ? basic.legalName : cleanGstin;
  doc.text(`Legal Name: ${legalNameDisplay}`, marginX + 4, currentY + 10.5);

  // Status Badge on Right
  const isStatusActive = String(basic.regStatus || "").toLowerCase() === "active";
  const badgeWidth = 26;
  const badgeHeight = 7;
  const badgeX = pageWidth - marginX - badgeWidth - 4;
  const badgeY = currentY + 3.5;

  if (isStatusActive) {
    doc.setFillColor(...COLOR_EMERALD_LIGHT);
    doc.setDrawColor(...COLOR_EMERALD);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, "FD");
    doc.setTextColor(6, 95, 70);
  } else {
    doc.setFillColor(254, 226, 226); // Red tint
    doc.setDrawColor(220, 38, 38);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, "FD");
    doc.setTextColor(153, 27, 27);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(basic.regStatus || "Status", badgeX + badgeWidth / 2, badgeY + 4.8, { align: "center" });

  currentY += 19;

  // Helper for section headings
  const drawSectionHeader = (title) => {
    // If close to page bottom, autoTable will handle it, but for text headers check spacing
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFillColor(...COLOR_EMERALD);
    doc.rect(marginX, currentY, 2.5, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(title, marginX + 5, currentY + 4.5);
    currentY += 8;
  };

  // =========================================================================
  // 3. REGISTRATION AND BUSINESS OVERVIEW
  // =========================================================================
  drawSectionHeader("1. Registration & Business Overview");

  const stateCodeDerived = cleanGstin.length >= 2 ? cleanGstin.substring(0, 2) : "-";
  const turnoverDisplay =
    basic.aggregateTurnover !== "-"
      ? basic.turnoverFY
        ? `${basic.aggregateTurnover} (FY: ${basic.turnoverFY})`
        : `${basic.aggregateTurnover} (FY: Unavailable)`
      : "Not available";

  const businessActivitiesDisplay =
    Array.isArray(basic.businessActivities) && basic.businessActivities.length > 0
      ? basic.businessActivities.join(", ")
      : "Not available";

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: COLOR_SLATE_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 42, fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: 49 },
      2: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 42, fillColor: COLOR_BG_LIGHT },
      3: { cellWidth: 49 },
    },
    body: [
      ["GSTIN", basic.gstinVal, "Legal Name", basic.legalName],
      ["Trade Name", basic.tradeName, "Constitution", basic.constitution],
      ["Registration Status", basic.regStatus, "Taxpayer Type", basic.regType],
      ["Registration Date", basic.regDate, "State Code", stateCodeDerived],
      ["Aggregate Turnover", turnoverDisplay, "Center Jurisdiction", basic.jurisdiction],
      ["Range Jurisdiction", basic.ctj, "e-Invoice Status", basic.einvoiceStatus],
      ["Aadhaar Verified", basic.aadhaarStatus, "Business Nature", businessActivitiesDisplay],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 4. BUSINESS ADDRESS AND JURISDICTION
  // =========================================================================
  drawSectionHeader("2. Business Address & Jurisdiction Details");

  const addressRows = [
    ["Principal Place of Business", safeStr(branch.principalAddress)],
    ["Principal Nature / Deals In", safeStr(branch.principalDealsIn, "Not specified")],
  ];

  if (Array.isArray(branch.additionalAddresses) && branch.additionalAddresses.length > 0) {
    branch.additionalAddresses.forEach((item, idx) => {
      const addrText = typeof item === "string" ? item : item.address || item.addr || JSON.stringify(item);
      const dealsInText = item.dealsIn || item.ntr || "Not specified";
      addressRows.push([`Additional Place #${idx + 1}`, `${safeStr(addrText)} (Activity: ${safeStr(dealsInText)})`]);
    });
  } else {
    addressRows.push(["Additional Places of Business", "No additional places of business recorded."]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: COLOR_SLATE_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 48, fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: contentWidth - 48 },
    },
    body: addressRows,
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 5. HSN / SAC CLASSIFICATION
  // =========================================================================
  drawSectionHeader("3. HSN / SAC Classification (Goods & Services)");

  const hsnRows = [];
  if (hsn.goodsList.length > 0) {
    hsn.goodsList.forEach((g) => {
      hsnRows.push(["Goods", safeStr(g.code), safeStr(g.description)]);
    });
  }
  if (hsn.servicesList.length > 0) {
    hsn.servicesList.forEach((s) => {
      hsnRows.push(["Services", safeStr(s.code), safeStr(s.description)]);
    });
  }

  if (hsnRows.length === 0) {
    hsnRows.push(["-", "-", "No goods or services classification records available."]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "striped",
    head: [["Classification", "HSN / SAC Code", "Description"]],
    body: hsnRows,
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: COLOR_SLATE_DARK,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 32, fontStyle: "bold" },
      2: { cellWidth: contentWidth - 58 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 6. GST RETURN FILING HISTORY (COMPLETE ARCHIVE)
  // =========================================================================
  const filingCountLabel = filingRecords.length > 0 ? `(${filingRecords.length} Records)` : "(0 Records)";
  drawSectionHeader(`4. GST Return Filing History ${filingCountLabel}`);

  const filingTableBody = filingRecords.map((r) => [
    r.fy,
    r.period,
    r.returnType,
    r.filingDate,
    r.mode,
    r.status,
    r.arn,
  ]);

  if (filingTableBody.length === 0) {
    filingTableBody.push(["-", "-", "-", "-", "-", "-", "No GST return filing records available."]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [["FY", "Period", "Return", "Filing Date", "Mode", "Status", "ARN"]],
    body: filingTableBody,
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: COLOR_SLATE_DARK,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20 },
      2: { cellWidth: 18, fontStyle: "bold" },
      3: { cellWidth: 22 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18, fontStyle: "bold", textColor: [6, 95, 70] },
      6: { cellWidth: contentWidth - 118, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 7. FILING FREQUENCY OVERVIEW
  // =========================================================================
  drawSectionHeader("5. Filing Frequency Overview");

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: COLOR_SLATE_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 48, fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: contentWidth / 2 - 48 },
      2: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 48, fillColor: COLOR_BG_LIGHT },
      3: { cellWidth: contentWidth / 2 - 48 },
    },
    body: [
      [
        "Current Year Frequency",
        safeStr(frequency.filingFrequencyCurrent),
        "Previous Year Frequency",
        safeStr(frequency.filingFrequencyPrevious),
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 8. PERIOD-WISE LIABILITY PAID ANALYSIS
  // =========================================================================
  drawSectionHeader("6. Period-wise Liability Paid Analysis");

  // Summary row
  const currYearTitle = liability.currFinYear || "Current Financial Year";
  const prevYearTitle = liability.prevFinYear || "Previous Financial Year";
  const prevTotalPctStr =
    liability.prevTotal_pct !== null && liability.prevTotal_pct !== undefined
      ? formatPercentage(liability.prevTotal_pct)
      : "Not available";

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: COLOR_SLATE_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 48, fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: contentWidth / 2 - 48 },
      2: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 48, fillColor: COLOR_BG_LIGHT },
      3: { cellWidth: contentWidth / 2 - 48 },
    },
    body: [
      [
        "Current Financial Year",
        safeStr(currYearTitle),
        "Previous Total Liability Paid",
        prevTotalPctStr,
      ],
      [
        "Previous Financial Year",
        safeStr(prevYearTitle),
        "Records Reported",
        `${liability.currDetails.length} Current / ${liability.prevDetails.length} Previous`,
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 4;

  // Combine monthly liability details into a structured side-by-side or stacked table
  const maxLiabilityRows = Math.max(liability.currDetails.length, liability.prevDetails.length);
  const liabilityTableRows = [];

  for (let i = 0; i < maxLiabilityRows; i++) {
    const currItem = liability.currDetails[i];
    const prevItem = liability.prevDetails[i];

    liabilityTableRows.push([
      currItem ? safeStr(currItem.period || currItem.month) : "-",
      currItem ? formatPercentage(currItem.liabPaid_Pct ?? currItem.liabilityPaid) : "-",
      prevItem ? safeStr(prevItem.period || prevItem.month) : "-",
      prevItem ? formatPercentage(prevItem.liabPaid_Pct ?? prevItem.liabilityPaid) : "-",
    ]);
  }

  if (liabilityTableRows.length === 0) {
    liabilityTableRows.push(["-", "-", "-", "No monthly liability paid records available."]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [[
      `Period (${currYearTitle})`,
      "Liability Paid %",
      `Period (${prevYearTitle})`,
      "Liability Paid %",
    ]],
    body: liabilityTableRows,
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: COLOR_SLATE_DARK,
    },
    columnStyles: {
      0: { cellWidth: contentWidth / 4 },
      1: { cellWidth: contentWidth / 4, fontStyle: "bold", textColor: COLOR_EMERALD },
      2: { cellWidth: contentWidth / 4 },
      3: { cellWidth: contentWidth / 4, fontStyle: "bold", textColor: COLOR_EMERALD },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 9. TECHNICAL AUDIT & SYSTEM METADATA
  // =========================================================================
  drawSectionHeader("7. Query & Audit Verification Metadata");

  const isFromDbDisplay = rawResponse?.isFromDB ? "Cached / Internal DB" : "Live FACT Portal Query";
  const statusCodeDisplay = rawResponse?.statusCode ? `HTTP ${rawResponse.statusCode} (Success)` : "Success (200)";

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: COLOR_SLATE_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 42, fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: 49 },
      2: { fontStyle: "bold", textColor: COLOR_SLATE_MUTED, cellWidth: 42, fillColor: COLOR_BG_LIGHT },
      3: { cellWidth: 49 },
    },
    body: [
      ["Queried GSTIN", cleanGstin, "API Execution Status", statusCodeDisplay],
      ["Data Source", isFromDbDisplay, "API Message", safeStr(rawResponse?.successMessage, "GST Details Fetched Successfully")],
      ["Report Timestamp", new Date().toISOString(), "Platform Version", "BAS Intelligence v2.0"],
    ],
  });

  // =========================================================================
  // 10. RUNNING FOOTER & PAGE NUMBERING (ALL PAGES)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom divider line
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.text(
      "Banking Analysis System (BAS) • GST Advance Search Report • Confidential",
      marginX,
      pageHeight - 7
    );

    // Page Number
    doc.setFont("helvetica", "bold");
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 7,
      { align: "right" }
    );
  }

  // Filename formatting
  const sanitizedGstin = cleanGstin.replace(/[^A-Za-z0-9]/g, "");
  const defaultFilename = `GST_Report_${sanitizedGstin || "SEARCH"}.pdf`;
  const exportFilename = options.filename || defaultFilename;

  // Return buffer for test environments if requested
  if (options.returnBuffer) {
    return doc.output("arraybuffer");
  }

  // Trigger browser download
  if (typeof doc.save === "function") {
    doc.save(exportFilename);
  }

  return doc;
}
