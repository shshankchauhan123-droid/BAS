import * as XLSX from "xlsx";

/**
 * Format Indian currency string
 */
function formatCurrency(val) {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = Number(val);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
}

/**
 * Export NCRP Fund Flow Traceability Report data to multi-sheet Excel (.xlsx)
 */
export function exportTraceabilityReportToExcel(reportData, filename = "NCRP_Fund_Flow_Traceability_Report.xlsx") {
  if (!reportData) return;

  const wb = XLSX.utils.book_new();

  // 1. Sheet: Summary KPIs & Methodology
  const kpis = reportData.summary_kpis || {};
  const summaryRows = [
    ["NCRP FUND FLOW TRACEABILITY REPORT - EXECUTIVE SUMMARY"],
    ["Report Title", reportData.report_title || "NCRP Fund Flow Traceability Report"],
    ["Subtitle", "Trace transaction-level fund movement, validate account relationships, and identify where the available money trail ends."],
    ["File Name", reportData.filename || "N/A"],
    ["Generated At", reportData.generated_at || new Date().toISOString()],
    ["Selected Starting Account", reportData.selected_starting_account || "ALL (All Layer 1 Roots)"],
    [],
    ["EXECUTIVE METRICS (SECTION 3)", "VALUE"],
    ["Total NCRP Transactions", kpis.total_ncrp_transactions || 0],
    ["Total Recorded Inflow (Rs.)", formatCurrency(kpis.total_recorded_inflow)],
    ["Total Recorded Outflow (Rs.)", formatCurrency(kpis.total_recorded_outflow)],
    ["Distinct Accounts in Trail", kpis.distinct_accounts_count || 0],
    ["Confirmed Links (Exact UTR)", kpis.confirmed_links_count || 0],
    ["Possible Links (Account/Bank Match)", kpis.possible_links_count || 0],
    ["Unverified / Unmatched Transactions", kpis.unverified_unmatched_count || ((kpis.unverified_links_count || 0) + (kpis.unmatched_transactions_count || 0))],
    ["Terminal Accounts (Trace Ends)", kpis.terminal_accounts_count || 0],
    [],
    ["LINK CLASSIFICATION METHODOLOGY"],
    ["Tier", "Classification", "Criteria", "Investigative Standard"],
    ["1", "Confirmed Link", "Exact UTR / transaction reference number match between remitter and beneficiary.", "Statutorily confirmed on banking clearing logs."],
    ["2", "Possible Link", "Account & bank match without verified UTR or with timestamp/amount inference.", "Requires UTR reconciliation requisition u/s 91 CrPC."],
    ["3", "Unverified Link", "Contradictory account or missing bank routing details.", "Requires primary bank statement requisition."],
    ["4", "Unmatched Transaction", "Transaction present in workbook but not linked to selected root fund-flow tree.", "Dispersal / separate incident trail."],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Overview_KPIs");

  // 2. Sheet: Terminal Accounts
  const termRows = [
    [
      "Account Number",
      "Bank Name",
      "Account Holder",
      "Layer",
      "Terminal Status",
      "Total Incoming (Rs.)",
      "Held / Lien (Rs.)",
      "Withdrawn (Rs.)",
      "Unresolved Amount (Rs.)",
      "Reason Trace Ends",
      "Suggested Next Investigative Step",
      "Last Sender Account",
      "Last Sender Bank",
      "Last Tx Date",
      "Last Tx UTR",
    ],
  ];

  (reportData.terminal_accounts || []).forEach((t) => {
    termRows.push([
      t.account,
      t.bank,
      t.holder_name || "Not provided",
      `Layer ${t.layer}`,
      t.terminal_status,
      formatCurrency(t.total_incoming),
      formatCurrency(t.held_amount),
      formatCurrency(t.withdrawn_amount),
      formatCurrency(t.unresolved_amount),
      t.reason_trace_ends,
      t.suggested_next_step,
      t.last_incoming_tx?.sender_account || "N/A",
      t.last_incoming_tx?.sender_bank || "N/A",
      t.last_incoming_tx?.date || "N/A",
      t.last_incoming_tx?.utr || "N/A",
    ]);
  });
  const termWs = XLSX.utils.aoa_to_sheet(termRows);
  XLSX.utils.book_append_sheet(wb, termWs, "Terminal_Accounts");

  // 3. Sheet: All Linked Transactions Ledger
  const txRows = [
    [
      "Tx ID",
      "Date",
      "Time",
      "UTR / Reference No",
      "Sender Account",
      "Sender Bank",
      "Beneficiary Account",
      "Beneficiary Bank",
      "Amount (Rs.)",
      "Layer",
      "Link Status",
      "Remarks / Description",
      "Worksheet",
      "Row No",
    ],
  ];

  (reportData.transactions || []).forEach((tx) => {
    txRows.push([
      tx.id,
      tx.date || "Not available",
      tx.datetime || "Not available",
      tx.utr || "Not available",
      tx.sender_account,
      tx.sender_bank,
      tx.beneficiary_account,
      tx.dest_bank,
      formatCurrency(tx.amount),
      tx.layer,
      tx.link_status,
      tx.remarks || "Direct transfer",
      tx.source_sheet,
      tx.row_number,
    ]);
  });
  const txWs = XLSX.utils.aoa_to_sheet(txRows);
  XLSX.utils.book_append_sheet(wb, txWs, "Transactions_Ledger");

  // 4. Sheet: Accounts Financial Summary
  const accRows = [
    [
      "Account Number",
      "Bank Name",
      "Account Holder",
      "IFSC",
      "Layer",
      "Role",
      "Total Incoming (Rs.)",
      "Total Outgoing (Rs.)",
      "Net Movement (Rs.)",
      "Held Amount (Rs.)",
      "Withdrawn Amount (Rs.)",
      "Unresolved Amount (Rs.)",
      "Incoming Tx Count",
      "Outgoing Tx Count",
      "Last Recorded Date",
    ],
  ];

  (reportData.accounts_summary || []).forEach((a) => {
    accRows.push([
      a.account,
      a.bank,
      a.holder_name,
      a.ifsc,
      `Layer ${a.layer}`,
      a.role,
      formatCurrency(a.total_incoming),
      formatCurrency(a.total_outgoing),
      formatCurrency(a.net_movement),
      formatCurrency(a.held_amount),
      formatCurrency(a.withdrawn_amount),
      formatCurrency(a.unresolved_amount),
      a.incoming_count,
      a.outgoing_count,
      a.last_recorded_date,
    ]);
  });
  const accWs = XLSX.utils.aoa_to_sheet(accRows);
  XLSX.utils.book_append_sheet(wb, accWs, "Accounts_Financial_Summary");

  // 5. Sheet: Broken Links & Investigation Gaps
  const gapRows = [
    [
      "Gap ID",
      "Related Account",
      "Bank Name",
      "Layer",
      "Issue Type",
      "Evidence Available",
      "Why Trail Cannot Be Confirmed",
      "Suggested Next Action",
    ],
  ];

  (reportData.broken_links_and_gaps || []).forEach((g) => {
    gapRows.push([
      g.gap_id,
      g.related_account,
      g.bank,
      `Layer ${g.layer}`,
      g.issue_type,
      g.evidence_available,
      g.why_trail_cannot_be_confirmed,
      g.suggested_action,
    ]);
  });
  const gapWs = XLSX.utils.aoa_to_sheet(gapRows);
  XLSX.utils.book_append_sheet(wb, gapWs, "Investigation_Gaps");

  // 6. Sheet: Suggested Investigative Actions
  const actRows = [
    [
      "Action ID",
      "Priority",
      "Category",
      "Target Bank",
      "Target Account",
      "Action Title",
      "Detailed Action Description",
      "Legal Basis",
      "Evidence Ground",
    ],
  ];

  (reportData.suggested_actions || []).forEach((act) => {
    actRows.push([
      act.action_id,
      act.priority,
      act.category,
      act.target_bank,
      act.target_account,
      act.action_title,
      act.action_detail,
      act.legal_basis,
      act.evidence_ground,
    ]);
  });
  const actWs = XLSX.utils.aoa_to_sheet(actRows);
  XLSX.utils.book_append_sheet(wb, actWs, "Suggested_Actions");

  // Write file
  XLSX.writeFile(wb, filename);
}
