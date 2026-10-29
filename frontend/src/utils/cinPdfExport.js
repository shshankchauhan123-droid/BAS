/**
 * CIN Advance Search PDF Export Utility
 * Generates a comprehensive, professional, multi-page vector PDF report
 * containing all available data from the FACT CIN Advance Search API response.
 *
 * Uses jsPDF and jspdf-autotable for pixel-perfect multi-page tables,
 * typography, text-wrapping, and running headers/footers.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  extractCinData,
  mapCompanyDetails,
  mapDirectors,
  mapCharges,
  mapAnnualReturns,
  mapBalanceSheets,
  formatSafeValue,
  formatCurrency,
  formatCinDate,
  cleanOfficeAddress,
} from "./cinMapping.js";

// BAS Branding Colors (RGB)
const COLOR_NAVY = [23, 37, 84]; // #172554 - Deep Navy
const COLOR_EMERALD = [5, 150, 105]; // #059669 - BAS Emerald Green
const COLOR_EMERALD_LIGHT = [209, 250, 229]; // #D1FAE5 - Emerald Tint
const COLOR_SLATE_DARK = [30, 41, 59]; // #1E293B - Dark Slate Text
const COLOR_SLATE_MUTED = [100, 116, 139]; // #64748B - Muted Text
const COLOR_BG_LIGHT = [248, 250, 252]; // #F8FAFC - Alternating Table Row
const COLOR_BORDER = [226, 232, 240]; // #E2E8F0 - Divider / Border Line

/**
 * Generate and download or return the complete CIN Advance Search PDF report.
 *
 * @param {Object} rawResponse - The full API response object returned by backend
 * @param {string} searchedCin - The searched CIN or search identifier
 * @param {Object} options - Export options { returnBuffer: boolean, filename: string }
 * @returns {Promise<jsPDF|ArrayBuffer>}
 */
export async function exportCinReportPdf(rawResponse, searchedCin = "", options = {}) {
  if (!rawResponse) {
    throw new Error("No CIN response data available for PDF generation.");
  }

  const companyData = extractCinData(rawResponse);
  if (!companyData || typeof companyData !== "object") {
    throw new Error("Invalid or unparseable CIN data payload in response.");
  }

  // Normalized data models
  const company = mapCompanyDetails(companyData);
  const directors = mapDirectors(companyData?.cIN_DINs, companyData?.nofDirectors);
  const charges = mapCharges(companyData?.cIN_Charges);
  const annualReturns = mapAnnualReturns(companyData?.annualReturnFillingInfo);
  const balanceSheets = mapBalanceSheets(companyData?.balanceSheet);

  const cleanCin = formatSafeValue(
    company.cin !== "Not available" ? company.cin : searchedCin,
    "CIN"
  );
  const cleanCompanyName = formatSafeValue(company.companyName, "Company");
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
  doc.text(
    "ArthBodh Intelligence Platform • FACT External Corporate Registry",
    marginX,
    15
  );

  // Header Title - Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("CIN ADVANCE SEARCH REPORT", pageWidth - marginX, 10, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${reportDateStr}`, pageWidth - marginX, 15, {
    align: "right",
  });

  currentY = headerHeight + 5;

  // =========================================================================
  // 2. COMPANY RECORD SUMMARY BANNER
  // =========================================================================
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(`CIN: ${cleanCin}`, marginX + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_SLATE_DARK);
  doc.text(`Company Name: ${cleanCompanyName}`, marginX + 4, currentY + 10.5);

  // Status Badge on Right
  const isStatusActive =
    String(company.companyStatus || "").toLowerCase() === "active";
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
  doc.text(
    company.companyStatus || "Status",
    badgeX + badgeWidth / 2,
    badgeY + 4.8,
    { align: "center" }
  );

  currentY += 19;

  // Helper for section headings
  const drawSectionHeader = (title) => {
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
  // 3. SECTION 1: COMPANY INFORMATION & CAPITAL STRUCTURE
  // =========================================================================
  drawSectionHeader("1. Company Information & Capital Structure");

  const directorCountsSummary =
    directors.uniqueDirectorCount > 0
      ? `${directors.uniqueDirectorCount} Unique (${directors.totalRoleRecords} Roles / API: ${company.apiDirectorCountFormatted})`
      : `API Reported: ${company.apiDirectorCountFormatted}`;

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
      0: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      1: { cellWidth: 49 },
      2: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      3: { cellWidth: 49 },
    },
    body: [
      ["Company CIN", company.cin, "Legal Company Name", company.companyName],
      [
        "Company Status",
        company.companyStatus,
        "Origin Type",
        company.originType,
      ],
      [
        "Company Category",
        company.companyCategory,
        "Company Subcategory",
        company.companySubCategory,
      ],
      [
        "Company Class",
        company.companyClass,
        "Listing Status",
        company.listingStatus,
      ],
      [
        "Authorized Capital",
        company.authorizedCapitalFormatted,
        "Paid-up Capital",
        company.paidupCapitalFormatted,
      ],
      [
        "Registration Date",
        company.registrationDate,
        "ROC Code",
        company.rocCode,
      ],
      [
        "Directors Reported",
        directorCountsSummary,
        "Entity Class / Status",
        `${company.companyClass} • ${company.companyStatus}`,
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 4. SECTION 2: REGISTERED OFFICE & LOCATION DETAILS
  // =========================================================================
  drawSectionHeader("2. Registered Office & Location Details");

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
      0: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      1: { cellWidth: contentWidth - 42 },
    },
    body: [
      ["Registered Office Address", company.registeredOfficeAddress],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 2;

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
      0: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      1: { cellWidth: 49 },
      2: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      3: { cellWidth: 49 },
    },
    body: [
      ["City", company.city, "State", company.state],
      ["Pincode", company.pincode, "Country", company.country],
      ["Regional Director (RD)", company.rdName, "RD Region", company.rdRegion],
      ["State Code", company.stateCode, "Official Email", company.officialEmail],
      [
        "Number of Members",
        company.numberOfMembers,
        "Last AGM Date",
        company.lastAgm,
      ],
      [
        "Last Balance Sheet",
        company.lastBalanceSheet,
        "Jurisdiction Office",
        `${company.rdRegion} (${company.rocCode})`,
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 5. SECTION 3: DIRECTORS & KEY MANAGERIAL PERSONNEL
  // =========================================================================
  const directorHeaderLabel =
    directors.records.length > 0
      ? `3. Directors & Key Managerial Personnel (${directors.records.length} Role Records • ${directors.uniqueDirectorCount} Unique DINs)`
      : "3. Directors & Key Managerial Personnel (0 Records)";
  drawSectionHeader(directorHeaderLabel);

  const directorRows = directors.records.map((d) => [
    d.name,
    d.din,
    d.designation,
    d.dateJoin,
    d.dateResign,
    d.dscExpiry,
    d.noOfCompanies,
  ]);

  if (directorRows.length === 0) {
    directorRows.push([
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "No director or managerial personnel records reported.",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [
      [
        "Director Name",
        "DIN",
        "Designation",
        "Appt. Date",
        "Resign Date",
        "DSC Expiry",
        "Cos.",
      ],
    ],
    body: directorRows,
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
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 38 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: contentWidth - 164, halign: "center" },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 6. SECTION 4: REGISTERED CHARGES & ENCUMBRANCES
  // =========================================================================
  const chargeHeaderLabel =
    charges.length > 0
      ? `4. Registered Charges & Encumbrances (${charges.length} Records)`
      : "4. Registered Charges & Encumbrances (0 Records)";
  drawSectionHeader(chargeHeaderLabel);

  const chargeRows = charges.map((chg) => [
    chg.chargeId,
    chg.holderName,
    chg.dateOfCreation,
    chg.dateOfModification,
    chg.dateOfSatisfaction,
    chg.chargeAmountFormatted,
    chg.status,
  ]);

  if (chargeRows.length === 0) {
    chargeRows.push([
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "No registered charge or encumbrance records reported.",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [
      [
        "Charge ID",
        "Charge Holder",
        "Created",
        "Modified",
        "Satisfied",
        "Amount",
        "Status",
      ],
    ],
    body: chargeRows,
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
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 42 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 28, fontStyle: "bold", textColor: COLOR_EMERALD },
      6: { cellWidth: contentWidth - 158 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 7. SECTION 5: ANNUAL RETURN FILINGS
  // =========================================================================
  const annualReturnHeaderLabel =
    annualReturns.length > 0
      ? `5. Annual Return Filings (${annualReturns.length} Records)`
      : "5. Annual Return Filings (0 Records)";
  drawSectionHeader(annualReturnHeaderLabel);

  const annualReturnRows = annualReturns.map((ret) => [
    ret.financialYear,
    ret.agmDate,
    ret.filingDate,
    ret.form,
    ret.srn,
  ]);

  if (annualReturnRows.length === 0) {
    annualReturnRows.push([
      "-",
      "-",
      "-",
      "-",
      "No annual return filing records reported.",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [["Financial Year", "AGM Date", "Filing Date", "Form", "SRN"]],
    body: annualReturnRows,
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
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32, fontStyle: "bold" },
      4: { cellWidth: contentWidth - 128, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 8. SECTION 6: BALANCE SHEET FILINGS
  // =========================================================================
  const balanceSheetHeaderLabel =
    balanceSheets.length > 0
      ? `6. Balance Sheet Filings (${balanceSheets.length} Records)`
      : "6. Balance Sheet Filings (0 Records)";
  drawSectionHeader(balanceSheetHeaderLabel);

  const balanceSheetRows = balanceSheets.map((bs) => [
    bs.financialYear,
    bs.filingDate,
    bs.form,
    bs.srn,
  ]);

  if (balanceSheetRows.length === 0) {
    balanceSheetRows.push([
      "-",
      "-",
      "-",
      "No balance sheet filing records reported.",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    showHead: "everyPage",
    theme: "striped",
    head: [["Financial Year", "Filing Date", "Form", "SRN"]],
    body: balanceSheetRows,
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
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 42 },
      2: { cellWidth: 42, fontStyle: "bold" },
      3: { cellWidth: contentWidth - 126, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 9. SECTION 7: TECHNICAL AUDIT & SYSTEM METADATA
  // =========================================================================
  drawSectionHeader("7. Query & Audit Verification Metadata");

  const isFromDbDisplay = rawResponse?.isFromDB
    ? "Cached / Internal DB"
    : "Live FACT Corporate Registry Query";
  const statusCodeDisplay = rawResponse?.statusCode
    ? `HTTP ${rawResponse.statusCode} (Success)`
    : "Success (200)";
  const autoIdVal = formatSafeValue(companyData.autoId, "-");

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
      0: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      1: { cellWidth: 49 },
      2: {
        fontStyle: "bold",
        textColor: COLOR_SLATE_MUTED,
        cellWidth: 42,
        fillColor: COLOR_BG_LIGHT,
      },
      3: { cellWidth: 49 },
    },
    body: [
      [
        "Queried Identifier",
        cleanCin,
        "API Execution Status",
        statusCodeDisplay,
      ],
      [
        "Data Source",
        isFromDbDisplay,
        "System Record AutoId",
        autoIdVal,
      ],
      [
        "API Message",
        formatSafeValue(
          rawResponse?.successMessage,
          "CIN Details Fetched Successfully"
        ),
        "Platform Version",
        "BAS Intelligence v2.0",
      ],
      [
        "Report Timestamp",
        new Date().toISOString(),
        "Compliance Scope",
        "Ministry of Corporate Affairs (MCA)",
      ],
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
      "Banking Analysis System (BAS) • CIN Advance Search Report • Confidential",
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
  const sanitizedCin = cleanCin.replace(/[^A-Za-z0-9_-]/g, "");
  const defaultFilename = `CIN_Report_${sanitizedCin || "SEARCH"}.pdf`;
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
