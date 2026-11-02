/**
 * NCRP Hold Recovery Report PDF Export Utility
 * Generates a comprehensive, professional, multi-page vector PDF report
 * containing all analytical sections, transaction evidence, and audit notes.
 *
 * Uses jsPDF and jspdf-autotable for pixel-perfect formatting and running footers.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// BAS Branding Colors (RGB)
const COLOR_NAVY = [23, 37, 84]; // #172554 - Deep Navy
const COLOR_EMERALD = [5, 150, 105]; // #059669 - BAS Emerald Green
const COLOR_EMERALD_LIGHT = [209, 250, 229]; // #D1FAE5 - Emerald Tint
const COLOR_SLATE_DARK = [30, 41, 59]; // #1E293B - Dark Slate Text
const COLOR_SLATE_MUTED = [100, 116, 139]; // #64748B - Muted Text
const COLOR_BG_LIGHT = [248, 250, 252]; // #F8FAFC - Alternating Table Row
const COLOR_BORDER = [226, 232, 240]; // #E2E8F0 - Divider / Border Line
const COLOR_ROSE = [225, 29, 72]; // #E11D48 - Alert Rose
const COLOR_AMBER = [217, 119, 6]; // #D97706 - Warning Amber

function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "₹0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "₹0.00";
  return (
    "₹" +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Generate and download the NCRP Hold Recovery Report PDF.
 *
 * @param {Object} reportData - The full API response object from /file/{id}/hold-recovery-report
 * @param {Object} caseData - Active case metadata (case_number, case_name, etc.)
 * @param {Object} options - Export options { filename: string }
 */
export async function exportNcrpHoldRecoveryPdf(reportData, caseData = {}, options = {}) {
  if (!reportData) {
    throw new Error("No report data available for PDF generation.");
  }

  const overview = reportData.overview || {};
  const holdAllocation = reportData.hold_allocation || {};
  const layerCoverage = reportData.layer_coverage || [];
  const bankMatrix = reportData.bank_matrix || [];
  const withdrawals = reportData.withdrawals || {};
  const recoveryEvidence = reportData.recovery_evidence || {};
  const priorityActions = reportData.priority_actions || [];

  const caseNumber = caseData?.case_number || (reportData.case_id ? `#${reportData.case_id}` : "N/A");
  const caseName = caseData?.case_name || "Investigation Case";
  const filename = reportData.filename || "NCRP_Workbook.xlsx";
  const ackNo = reportData.acknowledgement_no || "N/A";
  const reportDateStr = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
  const headerHeight = 28;
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
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("NCRP Intelligence & Hold Recovery Audit Report", marginX, 16);
  doc.text(`Scope: Case ${caseNumber} • ${filename} • Ack: ${ackNo}`, marginX, 22);

  // Header Metadata - Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  doc.text("STRICTLY CONFIDENTIAL", pageWidth - marginX, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${reportDateStr}`, pageWidth - marginX, 16, { align: "right" });
  doc.text("Investigation Copy", pageWidth - marginX, 22, { align: "right" });

  currentY = headerHeight + 8;

  // Helper for section headings
  function addSectionHeader(title, subtitle = null) {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 16;
    }
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(marginX, currentY, 3, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(title, marginX + 6, currentY + 5.5);

    currentY += 9;

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_SLATE_MUTED);
      doc.text(subtitle, marginX + 6, currentY);
      currentY += 5;
    }
  }

  // =========================================================================
  // 2. SECTION A: FRAUD EXPOSURE OVERVIEW (KPI TABLE)
  // =========================================================================
  addSectionHeader("Section A — Fraud Exposure Overview", "Verified unique fraud exposure, secured hold volume, and cash liquidation metrics.");

  const kpis = [
    [
      "Reported Fraud Amount",
      formatCurrency(overview.reported_fraud_amount?.value),
      "Sum of unique Layer 1 disputed transfers from victim/source accounts.",
      overview.reported_fraud_amount?.verification_status || "VERIFIED",
    ],
    [
      "Reconciled Fraud Exposure",
      formatCurrency(overview.reconciled_fraud_exposure?.value),
      "Verified unique financial loss entering the network (no double counting).",
      overview.reconciled_fraud_exposure?.verification_status || "RECONCILED",
    ],
    [
      "Trace-Linked Transaction Volume",
      formatCurrency(overview.trace_linked_volume?.value),
      "Gross cumulative fund movement across all layers (movement metric only).",
      "MOVEMENT_METRIC",
    ],
    [
      "Amount on Hold (Verified)",
      formatCurrency(overview.amount_on_hold?.value),
      "Sum of unique confirmed holds from 'Transaction put on hold' worksheet.",
      "VERIFIED",
    ],
    [
      "Hold Coverage",
      overview.hold_coverage?.formatted_value || "0.00%",
      "(Verified Hold Amount / Reconciled Fraud Exposure) × 100",
      "RECONCILED",
    ],
    [
      "Actual Amount Recovered",
      formatCurrency(overview.actual_recovered_amount?.value),
      "No explicit refund/credit evidence detected in source workbook.",
      "EVIDENCE_ABSENT",
    ],
    [
      "Unsecured Gap",
      formatCurrency(overview.unsecured_gap?.value),
      "Maximum of (0, Reconciled Fraud Exposure - Verified Hold Amount).",
      "RECONCILED",
    ],
    [
      "Total Withdrawn Amount",
      formatCurrency(overview.total_withdrawn_amount?.value),
      "Cash drain across Cheque, ATM, and POS merchant spending.",
      "VERIFIED",
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Metric", "Value", "Calculation Basis", "Audit Status"]],
    body: kpis,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { fontStyle: "bold", textColor: COLOR_EMERALD, halign: "right", cellWidth: 32 },
      2: { cellWidth: 70 },
      3: { halign: "center", fontStyle: "bold", cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 3. SECTION B: HOLD ALLOCATION & RECOVERY STATUS
  // =========================================================================
  addSectionHeader("Section B — Hold Allocation & Recovery Status", "Breakdown of reconciled exposure into verified holds, partial holds, and unsecured gap.");

  const allocRows = (holdAllocation.categories || []).map((c) => [
    c.category,
    formatCurrency(c.amount),
    `${c.percentage.toFixed(2)}%`,
    String(c.count),
    c.status,
    c.description,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Category", "Amount", "Coverage %", "Accounts", "Status", "Audit Description"]],
    body: allocRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38 },
      1: { halign: "right", fontStyle: "bold", cellWidth: 28 },
      2: { halign: "right", cellWidth: 20 },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "center", fontStyle: "bold", cellWidth: 26 },
      5: { cellWidth: 54 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 4. SECTION C: LAYER-WISE HOLD COVERAGE DECAY
  // =========================================================================
  addSectionHeader("Section C — Layer-wise Hold Coverage Decay", "Tracking how confirmed hold coverage diminishes across subsequent transaction layers.");

  const layerRows = layerCoverage.map((l) => [
    l.layer,
    String(l.accounts_count),
    String(l.tx_count),
    formatCurrency(l.disputed_amount),
    formatCurrency(l.verified_hold_amount),
    `${l.hold_coverage_pct.toFixed(2)}%`,
    formatCurrency(l.unsecured_amount),
    formatCurrency(l.withdrawals_amount),
    l.status,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Layer", "Accs", "Txs", "Disputed Exp.", "Verified Hold", "Coverage %", "Unsecured Gap", "Withdrawals", "Status"]],
    body: layerRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 18 },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "center", cellWidth: 12 },
      3: { halign: "right", cellWidth: 25 },
      4: { halign: "right", fontStyle: "bold", textColor: COLOR_EMERALD, cellWidth: 24 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "right", textColor: COLOR_ROSE, cellWidth: 25 },
      7: { halign: "right", cellWidth: 24 },
      8: { halign: "center", fontStyle: "bold", cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 5. SECTION D: INSTITUTIONAL COMPLIANCE MATRIX
  // =========================================================================
  addSectionHeader("Section D — Institutional Hold Recovery Compliance Matrix", "Bank-wise breakdown of disputed exposure, verified holds, and reported actions.");

  const bankRows = bankMatrix.map((b) => [
    b.bank_name,
    String(b.accounts_count),
    formatCurrency(b.disputed_exposure),
    formatCurrency(b.verified_hold_amount),
    formatCurrency(b.unsecured_gap),
    `${b.hold_coverage_pct.toFixed(2)}%`,
    b.verification_status,
    b.notes || "—",
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Bank / FI Name", "Accs", "Exposure", "Verified Hold", "Unsecured Gap", "Coverage %", "Status", "Investigative Findings"]],
    body: bankRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38 },
      1: { halign: "center", cellWidth: 11 },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "right", fontStyle: "bold", textColor: COLOR_EMERALD, cellWidth: 21 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 17 },
      6: { halign: "center", fontStyle: "bold", cellWidth: 23 },
      7: { cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 6. SECTION E: WITHDRAWAL ANALYSIS
  // =========================================================================
  addSectionHeader("Section E — Cash & Merchant Withdrawal Analysis", "Cash dissipation breakdown across Counter Cheque, ATM, and POS merchant spending.");

  const methodSummaryRows = (withdrawals.methods || []).map((m) => [
    m.method,
    formatCurrency(m.amount),
    String(m.record_count),
    `${m.percentage.toFixed(2)}%`,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Withdrawal Method", "Total Withdrawn", "Records", "% of Total Cash Drain"]],
    body: methodSummaryRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 70 },
      1: { halign: "right", fontStyle: "bold", textColor: COLOR_ROSE, cellWidth: 40 },
      2: { halign: "center", cellWidth: 32 },
      3: { halign: "right", cellWidth: 40 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  const wdrTxRows = (withdrawals.records || []).map((w) => [
    w.method.replace("Withdrawal through ", "").replace("Cash Withdrawal through ", ""),
    w.bank,
    w.account,
    formatCurrency(w.amount),
    w.date || "—",
    w.utr || "—",
    w.details || w.remarks || "—",
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Method", "Bank", "Account", "Amount", "Date / Time", "UTR / Ref No.", "Location / Terminal Details"]],
    body: wdrTxRows,
    theme: "grid",
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 1.8,
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 1.6,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28, fontStyle: "bold" },
      3: { halign: "right", fontStyle: "bold", textColor: COLOR_ROSE, cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 24 },
      6: { cellWidth: 36 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 7. SECTION F: RECOVERY TRACKING & EVIDENCE
  // =========================================================================
  addSectionHeader("Section F — Recovery Tracking & Evidence", "Formal audit of completed returned/refunded funds vs pending judicial releases.");

  const recoveryStatusText = [
    ["Recovery Evidence Status", recoveryEvidence.status_message || "No explicit recovery amount evidence detected."],
    ["Funds Initiated for Recovery", formatCurrency(recoveryEvidence.recovery_initiated_amount)],
    ["Pending Judicial Return", formatCurrency(recoveryEvidence.recovery_pending_amount)],
    ["Completed Victim Credits", formatCurrency(recoveryEvidence.recovery_completed_amount)],
    ["Investigative Definition", "A hold or lien is not a recovery. Completed recovery requires verified bank credit to victim."],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    body: recoveryStatusText,
    theme: "plain",
    bodyStyles: {
      fontSize: 7.5,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: COLOR_NAVY },
      1: { cellWidth: 127 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // 8. SECTION G: PRIORITY INVESTIGATION FOLLOW-UP
  // =========================================================================
  addSectionHeader("Section G — Priority Investigation Follow-up Actions", "Rule-based tactical recommendations for immediate investigative and legal intervention.");

  const priorityRows = priorityActions.map((p) => [
    p.priority,
    p.bank,
    p.account,
    p.layer,
    formatCurrency(p.disputed_amount),
    formatCurrency(p.unsecured_gap),
    p.investigation_reason,
    p.recommended_action,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Priority", "Bank", "Account", "Layer", "Disputed Exp.", "Unsecured Gap", "Investigation Reason", "Recommended Action"]],
    body: priorityRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 16 },
      1: { fontStyle: "bold", cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", fontStyle: "bold", textColor: COLOR_ROSE, cellWidth: 20 },
      6: { cellWidth: 32 },
      7: { cellWidth: 32 },
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  // =========================================================================
  // 9. RUNNING PAGE FOOTERS (Page X of Y)
  // =========================================================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.text(
      "CONFIDENTIAL • BANKING ANALYSIS SYSTEM (BAS) • FOR OFFICIAL USE ONLY",
      marginX,
      pageHeight - 7
    );

    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 7,
      { align: "right" }
    );
  }

  // Save or return
  const safeFilename = `NCRP_Hold_Recovery_Report_${reportData.file_id || "Export"}.pdf`;
  doc.save(safeFilename);
  return doc;
}
