/**
 * NCRP Investigation Priority Report PDF Export Utility
 * Generates an executive, evidence-backed vector PDF report
 * containing priority scoring, triage ranking, exposure breakdown,
 * investigation gaps, and actionable next steps.
 *
 * Uses jsPDF and jspdf-autotable for consistent vector printing.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ArthBODH / BAS Theme Palette
const COLOR_NAVY = [23, 37, 84];        // #172554
const COLOR_EMERALD = [5, 150, 105];    // #059669
const COLOR_SLATE_DARK = [30, 41, 59];  // #1E293B
const COLOR_SLATE_MUTED = [100, 116, 139]; // #64748B
const COLOR_BG_LIGHT = [248, 250, 252]; // #F8FAFC
const COLOR_BORDER = [226, 232, 240];   // #E2E8F0
const COLOR_ROSE = [225, 29, 72];       // #E11D48 - Critical
const COLOR_AMBER = [217, 119, 6];      // #D97706 - High

function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === "" || Number.isNaN(Number(amount))) return "₹0.00";
  const num = Number(amount);
  return (
    "₹" +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Generate and download the NCRP Investigation Priority Report PDF.
 */
export async function exportNcrpPriorityPdf(reportData, caseData = {}, options = {}) {
  if (!reportData) {
    throw new Error("No report data available for PDF generation.");
  }

  const overview = reportData.overview || {};
  const distribution = reportData.priority_distribution?.distribution || reportData.priority_distribution || {};
  const layerHeatmap = reportData.layer_heatmap || reportData.layer_risk_heatmap || [];
  const highPriority = reportData.high_priority_items || [];
  const gaps = reportData.investigation_gaps || [];
  const actions = reportData.recommended_actions || [];
  const cashWithdrawals = reportData.cash_out_analysis || reportData.cash_withdrawals || {};
  const summary = reportData.investigation_summary || {};

  const caseNumber = caseData?.case_number || (reportData.case_id ? `#${reportData.case_id}` : "N/A");
  const caseName = caseData?.case_name || "Investigation Case";
  const filename = reportData.filename || "NCRP_Workbook.xlsx";
  const ackNo = reportData.acknowledgement_no || overview.acknowledgement_no || "N/A";
  const reportDateStr = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  // Header Banner
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(margin, currentY, pageWidth - margin * 2, 28, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ArthBODH — NCRP Investigation Priority Report", margin + 6, currentY + 10);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Case: ${caseNumber} (${caseName})  |  Workbook: ${filename}  |  Ack No: ${ackNo}`,
    margin + 6,
    currentY + 18
  );
  doc.text(`Generated: ${reportDateStr}  |  Scoring Policy: 5-Factor Weighted Engine (v1.0)`, margin + 6, currentY + 23);

  currentY += 34;

  // Disclaimer Box
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 12, 1.5, 1.5, "FD");
  doc.setTextColor(...COLOR_ROSE);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("INVESTIGATION DECISION-SUPPORT NOTICE:", margin + 3, currentY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_SLATE_DARK);
  doc.text(
    "This report provides evidence-grounded prioritization to assist LEA officers and investigators. It does NOT declare final fraud guilt or recoverability.",
    margin + 3,
    currentY + 8.5
  );

  currentY += 16;

  // KPI Summary Table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_NAVY);
  doc.text("1. Executive Summary & Exposure Metrics", margin, currentY);
  currentY += 4;

  const kpiRows = [
    [
      "Disputed Exposure (Corpus)",
      formatCurrency(overview.disputed_amount ?? overview.disputed_exposure ?? 0),
      "Total Critical Priority Items",
      overview.critical_count ?? 0,
    ],
    [
      "Unique Traced Amount",
      formatCurrency(overview.unique_traced_amount ?? 0),
      "Total High Priority Items",
      overview.high_count ?? 0,
    ],
    [
      "Immediate Cash-Out Amount",
      formatCurrency(overview.cash_out_amount ?? 0),
      "Medium / Low Priority Items",
      `${overview.medium_count ?? 0} / ${overview.low_count ?? 0}`,
    ],
    [
      "Verified Held Amount",
      formatCurrency(overview.verified_held_amount ?? overview.verified_hold_amount ?? 0),
      "Identified Investigation Gaps",
      overview.identified_gaps_count ?? overview.investigation_gaps_count ?? gaps.length,
    ],
    [
      "Net Unsecured Exposure",
      formatCurrency(overview.unsecured_exposure ?? 0),
      "High-Priority Actionable Steps",
      overview.high_priority_actions_count ?? overview.recommended_actions_count ?? actions.length,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Exposure Metric", "Value", "Triage & Gap Metric", "Count"]],
    body: kpiRows,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "right", fontStyle: "bold", textColor: COLOR_EMERALD, cellWidth: 35 },
      2: { fontStyle: "bold", cellWidth: 60 },
      3: { halign: "center", fontStyle: "bold", textColor: COLOR_ROSE, cellWidth: 32 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // High-Priority Triage Items
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_NAVY);
  doc.text("2. Top Priority Suspect Accounts & Fund-Flow Events", margin, currentY);
  currentY += 4;

  const topItems = highPriority.slice(0, 10);
  const triageRows = topItems.map((item, idx) => {
    const tier = item.tier || item.priority || "LOW";
    const acc = item.account || item.account_number || "N/A";
    const bank = item.bank_name || item.bank || "Unknown";
    const layer = item.layer_name || (typeof item.layer === "number" ? `Layer ${item.layer}` : item.layer) || "Layer 1";
    const evtType = item.event_type || "TRANSFER";
    const reason = item.primary_reason || item.risk_reason || (item.reasons && item.reasons[0]) || "Evidence flagged";
    const sheet = item.source_sheet || item.source_evidence?.sheet || "NCRP";
    const row = item.source_row || item.source_evidence?.row || "-";

    return [
      idx + 1,
      `${item.score ?? 0} / 100\n(${tier})`,
      `${acc}\n${bank}`,
      layer,
      evtType,
      formatCurrency(item.amount),
      reason.substring(0, 85) + (reason.length > 85 ? "..." : ""),
      `${sheet} (R:${row})`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["#", "Score", "Account & Bank", "Layer", "Type", "Amount", "Primary Priority Evidence Reason", "Source Sheet"]],
    body: triageRows.length > 0 ? triageRows : [["-", "-", "No high priority items found", "-", "-", "-", "-", "-"]],
    margin: { left: margin, right: margin },
    theme: "striped",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 30, fontStyle: "bold" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 18 },
      5: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 46 },
      7: { cellWidth: 25, fontSize: 6.5 },
    },
  });

  // Layer-wise Heatmap & Missing Evidence
  doc.addPage();
  currentY = 16;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_NAVY);
  doc.text("3. Layer-wise Risk Heatmap & Missing Evidence", margin, currentY);
  currentY += 4;

  const layerRows = layerHeatmap.map((layer) => {
    const lName = layer.layer_name || (typeof layer.layer === "number" ? `Layer ${layer.layer}` : layer.layer) || "Layer";
    const accCount = layer.accounts_count ?? (layer.accounts || []).length ?? 0;
    const bCount = layer.banks_count ?? (layer.banks || []).length ?? 0;
    const isHeld = layer.has_verified_hold || (layer.verified_hold_amount > 0) || (layer.verified_held_amount > 0);

    return [
      lName,
      accCount,
      bCount,
      formatCurrency(layer.unique_traced_amount ?? 0),
      formatCurrency(layer.cash_out_amount ?? 0),
      isHeld ? "HELD" : "UNSECURED",
      layer.critical_count ?? 0,
      layer.high_count ?? 0,
      layer.missing_evidence_summary || "Complete",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Layer", "Accounts", "Banks", "Traced Amt", "Cash-Out", "Hold Status", "Critical", "High", "Investigation Gaps"]],
    body: layerRows.length > 0 ? layerRows : [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 18 },
      1: { halign: "center", cellWidth: 14 },
      2: { halign: "center", cellWidth: 12 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 25 },
      4: { halign: "right", textColor: COLOR_ROSE, fontStyle: "bold", cellWidth: 25 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", fontStyle: "bold", textColor: COLOR_ROSE, cellWidth: 14 },
      7: { halign: "center", fontStyle: "bold", textColor: COLOR_AMBER, cellWidth: 14 },
      8: { cellWidth: 42, fontSize: 6.5 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Investigation Gaps
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_NAVY);
  doc.text("4. Bank-wise Investigation Gaps & Missing Evidence", margin, currentY);
  currentY += 4;

  const gapRows = gaps.slice(0, 10).map((g) => {
    const bank = g.bank_name || g.bank || "Unknown";
    const acc = g.account || "N/A";
    const layer = g.layer || g.affected_layer || "Layer 1";
    const missing = g.missing_evidence || "Unspecified";
    const why = g.why_it_matters || "";
    const action = g.recommended_action || "";

    return [
      bank,
      acc,
      layer,
      missing,
      why.substring(0, 75) + (why.length > 75 ? "..." : ""),
      action.substring(0, 75) + (action.length > 75 ? "..." : ""),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Bank", "Account", "Layer", "Missing Evidence", "Why It Matters", "Recommended Follow-up Action"]],
    body: gapRows.length > 0 ? gapRows : [["-", "-", "-", "No unverified gaps detected", "-", "-"]],
    margin: { left: margin, right: margin },
    theme: "striped",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 35, textColor: COLOR_ROSE, fontStyle: "bold" },
      4: { cellWidth: 40 },
      5: { cellWidth: 40 },
    },
  });

  // Recommended Next Actions
  currentY = doc.lastAutoTable.finalY + 8;
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_NAVY);
  doc.text("5. Prioritized Recommended Investigation Actions", margin, currentY);
  currentY += 4;

  const actionRows = actions.slice(0, 12).map((a, idx) => {
    const urgency = a.urgency || a.action_priority || "HIGH";
    const actionText = a.action || a.action_description || "Follow up with bank";
    const target = a.target_entity || a.bank_name || a.bank || "Target Bank/Entity";
    const acc = a.account || a.supporting_account || "N/A";
    const evidence = a.evidence_basis || a.reason || a.source_reference || "";

    return [
      idx + 1,
      urgency,
      actionText,
      target,
      acc,
      evidence.substring(0, 80) + (evidence.length > 80 ? "..." : ""),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["#", "Urgency", "Action Item", "Target Bank / Entity", "Account", "Evidence Basis"]],
    body: actionRows.length > 0 ? actionRows : [["-", "-", "No immediate actions required", "-", "-", "-"]],
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLOR_SLATE_DARK,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 45, fontStyle: "bold" },
      3: { cellWidth: 32 },
      4: { cellWidth: 28 },
      5: { cellWidth: 51 },
    },
  });

  // Page Numbers Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.setDrawColor(...COLOR_BORDER);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.text(
      `ArthBODH Banking Analysis System — Confidential NCRP Law Enforcement Investigation Report`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 6);
  }

  // Save the PDF
  const downloadName = options.filename || `NCRP_Priority_Report_${reportData.case_id || "Case"}_${Date.now()}.pdf`;
  doc.save(downloadName);
}
