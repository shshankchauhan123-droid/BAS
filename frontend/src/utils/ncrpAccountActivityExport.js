import * as XLSX from "xlsx";

function formatCurrency(val) {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = Number(val);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
}

/**
 * Export NCRP Account Activity & Exit Report data to multi-sheet Excel (.xlsx)
 */
export function exportAccountActivityReportToExcel(reportData, filename = "NCRP_Account_Activity_Exit_Report.xlsx") {
  if (!reportData) return;

  const wb = XLSX.utils.book_new();

  // 1. Sheet: Executive Summary & KPIs
  const kpis = reportData.kpi_cards || {};
  const recon = reportData.amount_reconciliation || {};
  const profile = reportData.account_profile || {};

  const summaryRows = [
    ["NCRP ACCOUNT ACTIVITY & EXIT REPORT - EXECUTIVE SUMMARY"],
    ["Report Title", reportData.report_title || "NCRP Account Activity & Exit Report"],
    ["File Name", reportData.filename || "N/A"],
    ["Generated At", reportData.generated_at || new Date().toISOString()],
    ["Selected Account", profile.account || reportData.selected_account || "N/A"],
    ["Account Bank", profile.bank || "Unknown Bank"],
    [],
    ["EXECUTIVE METRICS (SECTION 3)", "VALUE"],
    ["Total Transactions", kpis.total_transactions || 0],
    ["Total Incoming (Rs.)", formatCurrency(kpis.total_incoming)],
    ["Total Outgoing (Rs.)", formatCurrency(kpis.total_outgoing)],
    ["Transfer Outflow (Rs.)", formatCurrency(kpis.transfer_outflow)],
    ["Cash Withdrawal (Rs.)", formatCurrency(kpis.cash_withdrawal)],
    ["Verified Held Amount (Rs.)", formatCurrency(kpis.verified_held_amount)],
    ["Estimated Unresolved Amount (Rs.)", formatCurrency(kpis.estimated_unresolved_amount)],
    ["Linked Destination Accounts", kpis.linked_destination_accounts || 0],
    ["Last Recorded Activity", kpis.last_recorded_activity?.date || "N/A"],
    [],
    ["AMOUNT RECONCILIATION BREAKDOWN (SECTION 11)"],
    ["Component", "Amount (Rs.)", "Analytical Note"],
    ["Total Incoming Credits", formatCurrency(recon.total_incoming_credits), "Recorded credits into selected account"],
    ["Recorded Outgoing Transfers", formatCurrency(recon.recorded_outgoing_transfers), "Account-to-account outbound transfers"],
    ["Recorded Cash Withdrawals", formatCurrency(recon.recorded_cash_withdrawals), "ATM, POS, Cheque cash dispersals"],
    ["Recorded Other Debits", formatCurrency(recon.recorded_other_debits), "Other recorded debit entries"],
    ["Verified Held Amount", formatCurrency(recon.verified_held_amount), "Statutory hold/lien marked on account"],
    ["Estimated Unresolved Amount", formatCurrency(recon.estimated_unresolved_amount), "max(0, In - Transfers - Withdrawals - Held)"],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Overview_KPIs");

  // 2. Sheet: Account Profile
  const profileRows = [
    ["ACCOUNT PROFILE SUMMARY (SECTION 5)"],
    ["Account Number", profile.account || "N/A"],
    ["Bank Name", profile.bank || "Unknown Bank"],
    ["Account Holder", profile.holder_name || "Not provided"],
    ["Layers Recorded", (profile.layers || []).join(", ") || "1"],
    ["First Recorded Transaction", profile.first_recorded_date || "N/A"],
    ["Last Recorded Transaction", profile.last_recorded_date || "N/A"],
    ["Incoming Transactions Count", profile.incoming_count || 0],
    ["Outgoing Transactions Count", profile.outgoing_count || 0],
    ["Linked Beneficiary Accounts", profile.linked_destinations_count || 0],
    ["Records Requiring Verification", profile.records_requiring_verification || 0],
    [],
    ["LAST TRACEABLE ACTIVITY (SECTION 10)"],
    ["Last Transaction Date", reportData.last_traceable_activity?.last_transaction?.date || "N/A"],
    ["Last Direction", reportData.last_traceable_activity?.last_transaction?.direction || "N/A"],
    ["Last Amount (Rs.)", formatCurrency(reportData.last_traceable_activity?.last_transaction?.amount)],
    ["Reason Available Trace Ends", reportData.last_traceable_activity?.reason_trace_ends || "N/A"],
  ];
  const profileWs = XLSX.utils.aoa_to_sheet(profileRows);
  XLSX.utils.book_append_sheet(wb, profileWs, "Account_Profile");

  // 3. Sheet: Chronological Transaction Timeline
  const timelineRows = [
    [
      "Row",
      "Date",
      "Direction",
      "Amount (Rs.)",
      "Sender Account",
      "Sender Bank",
      "Beneficiary Account",
      "Beneficiary Bank",
      "UTR / Ref No",
      "Type",
      "Layer",
      "Link Status",
      "Source Sheet",
      "Source Row",
      "Narration",
      "Post-Major Credit",
    ],
  ];

  (reportData.timeline_transactions || []).forEach((t, idx) => {
    timelineRows.push([
      idx + 1,
      t.datetime || t.date || "N/A",
      t.direction_label,
      formatCurrency(t.amount),
      t.sender_account,
      t.sender_bank,
      t.beneficiary_account,
      t.beneficiary_bank,
      t.utr || "Unrecorded",
      t.transaction_type,
      `Layer ${t.layer}`,
      t.link_status,
      t.sheet_name,
      t.row_number,
      t.narration || "",
      t.is_after_major_credit ? "YES" : "NO",
    ]);
  });
  const timelineWs = XLSX.utils.aoa_to_sheet(timelineRows);
  XLSX.utils.book_append_sheet(wb, timelineWs, "Transaction_Timeline");

  // 4. Sheet: Rapid Fund Movement Analysis
  const rapidRows = [
    [
      "Association ID",
      "Incoming Date",
      "Incoming Amount (Rs.)",
      "Incoming Sender",
      "Incoming UTR",
      "Outgoing Date",
      "Outgoing Amount (Rs.)",
      "Outgoing Destination",
      "Outgoing UTR",
      "Time Gap",
      "Threshold Applied",
      "Dispersal Ratio (%)",
      "Link Classification",
    ],
  ];

  (reportData.rapid_fund_movement?.records || []).forEach((r) => {
    rapidRows.push([
      r.association_id,
      r.incoming_date,
      formatCurrency(r.incoming_amount),
      r.incoming_sender,
      r.incoming_utr,
      r.outgoing_date,
      formatCurrency(r.outgoing_amount),
      r.outgoing_dest,
      r.outgoing_utr,
      r.time_gap_formatted,
      r.threshold_label,
      `${r.amount_ratio_pct}%`,
      r.link_status,
    ]);
  });
  const rapidWs = XLSX.utils.aoa_to_sheet(rapidRows);
  XLSX.utils.book_append_sheet(wb, rapidWs, "Rapid_Movement");

  // 5. Sheet: Exit Destinations
  const exitRows = [
    [
      "Beneficiary Account",
      "Beneficiary Bank",
      "Total Amount Transferred (Rs.)",
      "Transfer Count",
      "Last Transfer Date",
      "Onward Transfers Recorded in Workbook",
      "Status Description",
    ],
  ];

  (reportData.exit_activity?.top_destinations || []).forEach((d) => {
    exitRows.push([
      d.beneficiary_account,
      d.beneficiary_bank,
      formatCurrency(d.total_amount),
      d.transfer_count,
      d.last_transfer_date || "N/A",
      d.has_onward_transfers ? "YES" : "NO",
      d.status_description,
    ]);
  });
  const exitWs = XLSX.utils.aoa_to_sheet(exitRows);
  XLSX.utils.book_append_sheet(wb, exitWs, "Exit_Destinations");

  // 6. Sheet: Gaps & Actions
  const gapsRows = [
    ["INVESTIGATION GAPS AUDIT"],
    ["Gap ID", "Issue Category", "Affected Record", "Source Sheet", "Details", "Evidence Required"],
  ];
  (reportData.data_quality_gaps || []).forEach((g) => {
    gapsRows.push([
      g.gap_id,
      g.category,
      g.affected_record,
      g.source_sheet,
      g.details,
      g.evidence_required,
    ]);
  });
  gapsRows.push([]);
  gapsRows.push(["SUGGESTED INVESTIGATIVE ACTIONS"]);
  gapsRows.push(["Action ID", "Priority", "Finding", "Recommended Action", "Target Entity", "Legal Provision"]);
  (reportData.suggested_actions || []).forEach((a) => {
    gapsRows.push([
      a.action_id,
      a.priority,
      a.finding,
      a.recommended_action,
      a.target_entity,
      a.legal_provision,
    ]);
  });
  const gapsWs = XLSX.utils.aoa_to_sheet(gapsRows);
  XLSX.utils.book_append_sheet(wb, gapsWs, "Gaps_and_Actions");

  XLSX.writeFile(wb, filename);
}
