import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import NcrpTraceabilityGraph from "../../../components/reports/NcrpTraceabilityGraph";
import NcrpAccountProfileDrawer from "../../../components/reports/NcrpAccountProfileDrawer";
import NcrpTransactionEvidenceDrawer from "../../../components/reports/NcrpTransactionEvidenceDrawer";

import { getCases } from "../../../services/api/case";
import {
  getCaseNcrpFiles,
  getNcrpFundFlowTraceabilityReport,
} from "../../../services/api/ncrp";
import { exportTraceabilityReportToExcel } from "../../../utils/ncrpTraceabilityExport";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInrAmount(amount) {
  if (amount === undefined || amount === null || amount === "") return "₹0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "₹0.00";
  return inrFormatter.format(num);
}

function formatCount(val) {
  if (val === undefined || val === null || val === "") return "0";
  const num = Number(val);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("en-IN");
}

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function maskAccountNumber(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.length <= 4) return s;
  if (s.length <= 6) return s.slice(0, 1) + "X".repeat(s.length - 2) + s.slice(-1);
  return s.slice(0, 2) + "X".repeat(s.length - 6) + s.slice(-4);
}

export default function NcrpFundFlowTraceabilityReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Case & File selection states
  const [casesList, setCasesList] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(searchParams.get("caseId") || "");

  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(searchParams.get("fileId") || "");

  const [startingAccount, setStartingAccount] = useState(searchParams.get("startingAccount") || "ALL");

  // Report Data
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // UI States
  const [maskAccounts, setMaskAccounts] = useState(true);
  const [selectedAccountNode, setSelectedAccountNode] = useState(null);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [selectedEvidenceTx, setSelectedEvidenceTx] = useState(null);
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);

  // Terminal Accounts filter & search
  const [terminalSearch, setTerminalSearch] = useState("");
  const [terminalStatusFilter, setTerminalStatusFilter] = useState("ALL");

  // Transaction Ledger Table filters & pagination
  const [txSearch, setTxSearch] = useState("");
  const [txLayerFilter, setTxLayerFilter] = useState("ALL");
  const [txStatusFilter, setTxStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isGraphFullscreen) {
        setIsGraphFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGraphFullscreen]);

  // 1. Fetch Cases
  useEffect(() => {
    let isMounted = true;
    async function loadCases() {
      try {
        setLoadingCases(true);
        const res = await getCases();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setCasesList(list);
          if (!selectedCaseId && list.length > 0) {
            setSelectedCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }
    loadCases();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch NCRP Files for selected case
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFiles([]);
      setSelectedFileId("");
      return;
    }
    let isMounted = true;
    async function loadFiles() {
      try {
        setLoadingFiles(true);
        const res = await getCaseNcrpFiles(selectedCaseId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setNcrpFiles(list);
          const currentValid = list.some((f) => String(f.id) === String(selectedFileId));
          if (!currentValid) {
            setSelectedFileId(list.length > 0 ? String(list[0].id) : "");
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP files:", err);
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // 3. Fetch Report Data
  const fetchReport = useCallback(async () => {
    if (!selectedFileId) {
      setReportData(null);
      return;
    }
    try {
      setLoadingReport(true);
      setReportError(null);
      const res = await getNcrpFundFlowTraceabilityReport(selectedFileId, {
        caseId: selectedCaseId,
        startingAccount: startingAccount !== "ALL" ? startingAccount : undefined,
      });
      const data = res?.data || res;
      setReportData(data);
      setFitTrigger((v) => v + 1);
    } catch (err) {
      console.error("Failed to fetch traceability report:", err);
      setReportError(err?.message || "Failed to generate NCRP Fund Flow Traceability Report");
    } finally {
      setLoadingReport(false);
    }
  }, [selectedFileId, selectedCaseId, startingAccount]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Handle case change
  const handleCaseChange = (e) => {
    const newCaseId = e.target.value;
    setSelectedCaseId(newCaseId);
    setSelectedFileId("");
    setStartingAccount("ALL");
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("caseId", newCaseId);
      p.delete("fileId");
      p.delete("startingAccount");
      return p;
    });
  };

  // Handle file change
  const handleFileChange = (e) => {
    const newFileId = e.target.value;
    setSelectedFileId(newFileId);
    setStartingAccount("ALL");
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("fileId", newFileId);
      p.delete("startingAccount");
      return p;
    });
  };

  // Handle starting account change
  const handleStartingAccountChange = (e) => {
    const acc = e.target.value;
    setStartingAccount(acc);
    setPage(1);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (acc === "ALL") p.delete("startingAccount");
      else p.set("startingAccount", acc);
      return p;
    });
  };

  // Node & Edge selection handlers
  const handleNodeClick = (node) => {
    setSelectedAccountNode(node);
    setIsAccountDrawerOpen(true);
  };

  const handleEdgeClick = (edge) => {
    setSelectedEvidenceTx(edge);
    setIsEvidenceDrawerOpen(true);
  };

  const handleRowClickEvidence = (tx) => {
    setSelectedEvidenceTx(tx);
    setIsEvidenceDrawerOpen(true);
  };

  // Export handler
  const handleExport = () => {
    if (!reportData) return;
    const fname = `NCRP_Fund_Flow_Traceability_${reportData.filename || "Case"}.xlsx`;
    exportTraceabilityReportToExcel(reportData, fname);
    Swal.fire({
      icon: "success",
      title: "Traceability Report Exported",
      text: `Workbook successfully generated and saved as ${fname}`,
      timer: 2200,
      showConfirmButton: false,
    });
  };

  // Filtered Terminal Accounts
  const filteredTerminals = useMemo(() => {
    if (!reportData?.terminal_accounts) return [];
    return reportData.terminal_accounts.filter((t) => {
      if (terminalStatusFilter !== "ALL" && t.terminal_status !== terminalStatusFilter) {
        return false;
      }
      if (terminalSearch.trim()) {
        const q = terminalSearch.trim().toLowerCase();
        const matchAcc = (t.account || "").toLowerCase().includes(q);
        const matchBank = (t.bank || "").toLowerCase().includes(q);
        const matchStatus = (t.terminal_status || "").toLowerCase().includes(q);
        const matchHolder = (t.holder_name || "").toLowerCase().includes(q);
        if (!matchAcc && !matchBank && !matchStatus && !matchHolder) return false;
      }
      return true;
    });
  }, [reportData, terminalSearch, terminalStatusFilter]);

  // Filtered and Sorted Ledger Transactions
  const filteredTransactions = useMemo(() => {
    if (!reportData?.transactions) return [];
    let list = reportData.transactions.filter((tx) => {
      if (txLayerFilter !== "ALL" && String(tx.layer_num) !== String(txLayerFilter)) return false;
      if (txStatusFilter !== "ALL" && tx.link_status !== txStatusFilter) return false;
      if (txSearch.trim()) {
        const q = txSearch.trim().toLowerCase();
        const matchSender = (tx.sender_account || "").toLowerCase().includes(q);
        const matchBene = (tx.beneficiary_account || "").toLowerCase().includes(q);
        const matchUtr = (tx.utr || "").toLowerCase().includes(q);
        const matchBank =
          (tx.sender_bank || "").toLowerCase().includes(q) ||
          (tx.dest_bank || "").toLowerCase().includes(q);
        const matchRemarks = (tx.remarks || "").toLowerCase().includes(q);
        if (!matchSender && !matchBene && !matchUtr && !matchBank && !matchRemarks) return false;
      }
      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === "amount") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortField === "layer") {
        valA = Number(a.layer_num) || 0;
        valB = Number(b.layer_num) || 0;
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [reportData, txLayerFilter, txStatusFilter, txSearch, sortField, sortOrder]);

  // Pagination for Ledger
  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const kpis = reportData?.summary_kpis || {};

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col font-sans">
      <BASNavbar />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-7">
        {/* Breadcrumb & Title Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] mb-1">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/cases/${selectedCaseId}/reports/ncrp`)}
                className="hover:text-blue-600 transition-colors"
              >
                NCRP Reports Hub
              </button>
              <span>/</span>
              <span className="text-[#1E293B]">Report 06</span>
            </div>
            <h1 className="text-2xl font-black text-[#172554] tracking-tight flex items-center gap-3">
              NCRP Fund Flow Traceability Report
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Decision Support
              </span>
            </h1>
            <p className="text-xs text-[#64748B] mt-1 max-w-4xl">
              Trace transaction-level fund movement, validate account relationships, and identify where the available money trail ends.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchReport}
              disabled={loadingReport || !selectedFileId}
              title="Refresh Report Data"
              className="p-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#334155] hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg
                className={`w-4 h-4 text-[#64748B] ${loadingReport ? "animate-spin text-blue-600" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>

            {/* Mask/Reveal Toggle */}
            <button
              type="button"
              onClick={() => setMaskAccounts((v) => !v)}
              className="px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#334155] hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {maskAccounts ? (
                <>
                  <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                  Reveal Accounts
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Mask Accounts
                </>
              )}
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={!reportData || loadingReport}
              className="px-4 py-2 bg-[#172554] text-white rounded-xl text-xs font-bold hover:bg-[#1E3A8A] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report (.xlsx)
            </button>
          </div>
        </div>

        {/* Global Selectors Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#CBD5E1] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Case Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
              Select Active Case
            </label>
            <select
              value={selectedCaseId}
              onChange={handleCaseChange}
              disabled={loadingCases}
              className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172554] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {casesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_name || "Untitled Case"} — {c.case_number || `Case #${c.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* NCRP Workbook Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
              Select NCRP Workbook
            </label>
            <select
              value={selectedFileId}
              onChange={handleFileChange}
              disabled={loadingFiles || ncrpFiles.length === 0}
              className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172554] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ncrpFiles.length === 0 ? (
                <option value="">No NCRP workbooks uploaded</option>
              ) : (
                ncrpFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.original_filename} ({f.imported_rows || 0} rows)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Starting Account Selector (Layer 1 Root) */}
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
              Starting Account (Layer 1 Root)
            </label>
            <select
              value={startingAccount}
              onChange={handleStartingAccountChange}
              disabled={loadingReport || !reportData}
              className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172554] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Starting Accounts ({reportData?.starting_accounts?.length || 0} Roots)</option>
              {(reportData?.starting_accounts || []).map((sa) => (
                <option key={sa.account} value={sa.account}>
                  {maskAccounts ? sa.masked_account : sa.account} • {sa.bank} (₹{formatIndianCurrency(sa.total_outflow)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading / Error States */}
        {loadingReport && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-[#CBD5E1]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm font-bold text-[#172554]">Tracing multi-layer fund flow graph...</p>
            <p className="text-xs text-[#64748B]">Auditing linked UTRs, terminal endpoints, and investigation gaps</p>
          </div>
        )}

        {reportError && !loadingReport && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900">
            <h3 className="font-bold text-sm">Failed to generate report</h3>
            <p className="text-xs mt-1 text-rose-700">{reportError}</p>
            <button
              type="button"
              onClick={fetchReport}
              className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {!loadingReport && !reportError && reportData && (
          <>
            {/* 8 SUMMARY KPI CARDS (SECTION 3 OF SPECIFICATION) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3.5">
              {/* Card 1: Total Transactions */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Total Transactions
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#172554] mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(kpis.total_ncrp_transactions)}
                  </span>
                </div>
                <span className="text-[10px] text-[#94A3B8] block mt-1 font-medium">Workbook records</span>
              </div>

              {/* Card 2: Layer 1 Inflow */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Layer 1 Inflow
                  </span>
                  <span
                    className="text-base sm:text-lg font-black text-emerald-700 mt-1 block break-words whitespace-normal leading-tight"
                    title={formatInrAmount(kpis.total_recorded_inflow)}
                  >
                    {formatInrAmount(kpis.total_recorded_inflow)}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 block mt-1 font-medium">Entry fund volume</span>
              </div>

              {/* Card 3: Traced Outflow */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider block">
                    Traced Outflow
                  </span>
                  <span
                    className="text-base sm:text-lg font-black text-rose-700 mt-1 block break-words whitespace-normal leading-tight"
                    title={formatInrAmount(kpis.total_recorded_outflow)}
                  >
                    {formatInrAmount(kpis.total_recorded_outflow)}
                  </span>
                </div>
                <span className="text-[10px] text-rose-600 block mt-1 font-medium">Total transfers</span>
              </div>

              {/* Card 4: Distinct Accounts */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Distinct Accounts
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#172554] mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(kpis.distinct_accounts_count)}
                  </span>
                </div>
                <span className="text-[10px] text-[#94A3B8] block mt-1 font-medium">Network entities</span>
              </div>

              {/* Card 5: Confirmed Links */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider block">
                    Confirmed Links
                  </span>
                  <span className="text-base sm:text-lg font-black text-blue-700 mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(kpis.confirmed_links_count)}
                  </span>
                </div>
                <span className="text-[10px] text-blue-600 block mt-1 font-medium">Exact UTR match</span>
              </div>

              {/* Card 6: Possible Links */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider block">
                    Possible Links
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-700 mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(kpis.possible_links_count)}
                  </span>
                </div>
                <span className="text-[10px] text-amber-600 block mt-1 font-medium">Account/bank match</span>
              </div>

              {/* Card 7: Unverified / Unmatched Links */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-purple-700 uppercase tracking-wider block">
                    Unverified / Unmatched Links
                  </span>
                  <span className="text-base sm:text-lg font-black text-purple-700 mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(
                      kpis.unverified_unmatched_count ??
                        (kpis.unverified_links_count || 0) + (kpis.unmatched_transactions_count || 0)
                    )}
                  </span>
                </div>
                <span className="text-[10px] text-purple-600 block mt-1 font-medium">Gaps in chain</span>
              </div>

              {/* Card 8: Terminal Accounts */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider block">
                    Terminal Accounts
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-700 mt-1 block break-words whitespace-normal leading-tight">
                    {formatCount(kpis.terminal_accounts_count)}
                  </span>
                </div>
                <span className="text-[10px] text-rose-600 block mt-1 font-medium">Last traceable points</span>
              </div>
            </div>

            {/* SECTION 1: LAYER-WISE FUND FLOW TRACEABILITY DIAGRAM */}
            <div
              className={
                isGraphFullscreen
                  ? "fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col p-4 w-screen h-screen overflow-hidden"
                  : "bg-white rounded-2xl border border-[#CBD5E1] shadow-sm p-4 space-y-3"
              }
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#E2E8F0] shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    Layer-wise Fund Flow Traceability Diagram
                  </h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Click any account node to inspect its 360° profile, or click any transfer line to inspect UTR and evidence details.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGraphFullscreen((v) => !v)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-[#334155] transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={
                          isGraphFullscreen
                            ? "M6 18L18 6M6 6l12 12"
                            : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        }
                      />
                    </svg>
                    {isGraphFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  </button>
                </div>
              </div>

              {/* Interactive SVG Graph */}
              <div className={isGraphFullscreen ? "flex-1 w-full min-h-0" : "w-full"}>
                <NcrpTraceabilityGraph
                  nodes={reportData.graph?.nodes || []}
                  edges={reportData.graph?.edges || []}
                  selectedAccount={selectedAccountNode?.id}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  maskAccounts={maskAccounts}
                  fitTrigger={fitTrigger}
                  isFullscreen={isGraphFullscreen}
                  onToggleFullscreen={() => setIsGraphFullscreen((v) => !v)}
                />
              </div>
            </div>

            {/* SECTION 2: TERMINAL ACCOUNTS & TRACE-ENDING ANALYSIS */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                    Terminal Accounts & Trace-Ending Analysis
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 ml-1">
                      {filteredTerminals.length} Endpoints
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Accounts that received suspected funds but have no further recorded outgoing transfers in the workbook.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <select
                    value={terminalStatusFilter}
                    onChange={(e) => setTerminalStatusFilter(e.target.value)}
                    className="h-9 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172554]"
                  >
                    <option value="ALL">All Terminal Statuses</option>
                    <option value="Terminal — No Further Outgoing Record">No Further Outgoing Record</option>
                    <option value="Trace Ends — Missing Transaction Data">Missing Transaction Data</option>
                    <option value="Possible Cash-Out — Evidence Required">Possible Cash-Out</option>
                    <option value="Unverified Terminal">Unverified Terminal</option>
                  </select>

                  <div className="w-full sm:w-60">
                    <input
                      type="text"
                      value={terminalSearch}
                      onChange={(e) => setTerminalSearch(e.target.value)}
                      placeholder="Search account, bank, reason..."
                      className="w-full h-9 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase border-b border-[#E2E8F0]">
                      <th className="py-3 px-3.5">Terminal Account & Bank</th>
                      <th className="py-3 px-3">Layer</th>
                      <th className="py-3 px-3">Terminal Status</th>
                      <th className="py-3 px-3 text-right">Incoming (₹)</th>
                      <th className="py-3 px-3 text-right">Held / Lien (₹)</th>
                      <th className="py-3 px-3 text-right">Withdrawn (₹)</th>
                      <th className="py-3 px-3 text-right">Unresolved (₹)</th>
                      <th className="py-3 px-3">Reason Trace Ends</th>
                      <th className="py-3 px-3">Recommended Next Step</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredTerminals.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="py-8 text-center text-xs text-[#94A3B8]">
                          No terminal accounts match search query or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTerminals.map((term) => (
                        <tr
                          key={term.account}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2.5 px-3.5">
                            <div className="font-mono font-bold text-[#0F172A]">
                              {maskAccounts ? term.masked_account : term.account}
                            </div>
                            <div className="text-[10px] text-[#64748B]">{term.bank}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#334155]">Layer {term.layer}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                term.terminal_status?.includes("Cash-Out")
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : term.terminal_status?.includes("Missing")
                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                  : "bg-rose-100 text-rose-800 border-rose-300"
                              }`}
                            >
                              {term.terminal_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            ₹{formatIndianCurrency(term.total_incoming)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                            ₹{formatIndianCurrency(term.held_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                            ₹{formatIndianCurrency(term.withdrawn_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-700">
                            ₹{formatIndianCurrency(term.unresolved_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#475569] max-w-xs" title={term.reason_trace_ends}>
                            <p className="line-clamp-2">{term.reason_trace_ends}</p>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-semibold text-rose-900 max-w-xs" title={term.suggested_next_step}>
                            <p className="line-clamp-2">{term.suggested_next_step}</p>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const n = reportData.graph?.nodes?.find((x) => x.id === term.account);
                                if (n) handleNodeClick(n);
                                else {
                                  // Construct synthetic node for drawer
                                  handleNodeClick({
                                    id: term.account,
                                    account: term.account,
                                    masked_account: term.masked_account,
                                    bank: term.bank,
                                    layer: term.layer,
                                    role: "Terminal Account",
                                    is_terminal: true,
                                    terminal_status: term.terminal_status,
                                    total_incoming: term.total_incoming,
                                    total_outgoing: term.total_outgoing,
                                    held_amount: term.held_amount,
                                    withdrawn_amount: term.withdrawn_amount,
                                    unresolved_amount: term.unresolved_amount,
                                    reason_trace_ends: term.reason_trace_ends,
                                    suggested_next_step: term.suggested_next_step,
                                  });
                                }
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#334155] rounded-lg text-[10px] font-bold transition-colors"
                            >
                              Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: INVESTIGATION GAPS & SUGGESTED NEXT ACTIONS */}
            
            {/* SECTION 4: TRANSACTION DETAILS TABLE (TRACEABILITY LEDGER) */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    Transaction Details Table (Traceability Ledger)
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 ml-1">
                      {filteredTransactions.length} of {reportData.transactions?.length || 0} Transfers
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Exhaustive record-level ledger of all canonical fund transfers with UTR validation and provenance. Click any row to view its evidence audit.
                  </p>
                </div>
              </div>

              {/* Filters & Sorting Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] items-center">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Search Transfers
                  </label>
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => {
                      setTxSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Account, bank, UTR, remarks..."
                    className="w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Filter Layer
                  </label>
                  <select
                    value={txLayerFilter}
                    onChange={(e) => {
                      setTxLayerFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                  >
                    <option value="ALL">All Layers</option>
                    <option value="1">Layer 1</option>
                    <option value="2">Layer 2</option>
                    <option value="3">Layer 3</option>
                    <option value="4">Layer 4</option>
                    <option value="5">Layer 5+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Link Confidence
                  </label>
                  <select
                    value={txStatusFilter}
                    onChange={(e) => {
                      setTxStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                  >
                    <option value="ALL">All Confidences</option>
                    <option value="CONFIRMED">Confirmed Only (Exact UTR)</option>
                    <option value="POSSIBLE">Possible Only (Missing UTR)</option>
                    <option value="UNVERIFIED">Unverified Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Sort By
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={sortField}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                    >
                      <option value="date">Date & Time</option>
                      <option value="amount">Amount</option>
                      <option value="layer">Layer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                      title={`Order: ${sortOrder.toUpperCase()}`}
                      className="h-8 w-8 px-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#334155] flex items-center justify-center hover:bg-slate-50"
                    >
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Rows Per Page
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                  >
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                    <option value={100}>100 rows</option>
                  </select>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase border-b border-[#E2E8F0]">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">UTR / Ref Number</th>
                      <th className="py-2.5 px-3">Sender (Source)</th>
                      <th className="py-2.5 px-3">Beneficiary (Target)</th>
                      <th className="py-2.5 px-3">Layer</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-3">Link Status</th>
                      <th className="py-2.5 px-3">Narration / Remarks</th>
                      <th className="py-2.5 px-3 text-center">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paginatedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-xs text-[#94A3B8]">
                          No transactions match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => handleRowClickEvidence(tx)}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-3 font-mono text-[11px] text-[#334155]">{tx.date}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#1E293B]">
                            {tx.utr && tx.utr !== "Not available" ? (
                              <span className="font-bold text-blue-800">{tx.utr}</span>
                            ) : (
                              <span className="text-amber-700 italic">Unrecorded</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-[#0F172A]">
                              {maskAccounts ? tx.sender_masked : tx.sender_account}
                            </div>
                            <div className="text-[10px] text-[#64748B]">{tx.sender_bank}</div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-[#0F172A]">
                              {maskAccounts ? tx.beneficiary_masked : tx.beneficiary_account}
                            </div>
                            <div className="text-[10px] text-[#64748B]">{tx.dest_bank}</div>
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#334155]">{tx.layer}</td>
                          <td className="py-2 px-3 text-right font-black text-rose-600">
                            ₹{formatIndianCurrency(tx.amount)}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                tx.link_status === "CONFIRMED"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : tx.link_status === "POSSIBLE"
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              {tx.link_status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[#475569] max-w-xs truncate" title={tx.remarks}>
                            {tx.remarks}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClickEvidence(tx);
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-200 transition-colors"
                            >
                              Audit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-[#64748B]">
                <div>
                  Showing <strong className="text-[#172554]">{paginatedTransactions.length}</strong> of{" "}
                  <strong className="text-[#172554]">{filteredTransactions.length}</strong> transfers (Page {page} of {totalTxPages})
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-3 py-1 bg-slate-100 rounded-lg font-mono font-bold text-[#172554]">
                    {page}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalTxPages, p + 1))}
                    disabled={page >= totalTxPages}
                    className="px-3 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalTxPages)}
                    disabled={page >= totalTxPages}
                    className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Last »
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Account Profile Slide-out Drawer */}
      <NcrpAccountProfileDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
        accountNode={selectedAccountNode}
        allTransactions={reportData?.transactions || []}
        allGaps={reportData?.broken_links_and_gaps || []}
        allActions={reportData?.suggested_actions || []}
        maskAccountsDefault={maskAccounts}
      />

      {/* Transaction Evidence Slide-out Drawer */}
      <NcrpTransactionEvidenceDrawer
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
        evidenceData={selectedEvidenceTx}
        maskAccountsDefault={maskAccounts}
      />

      <UserFooter />
    </div>
  );
}
