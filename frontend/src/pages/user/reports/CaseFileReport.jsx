import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";

import { getCase } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import {
  searchCaseTransactions,
  getFileTransactionSummary,
} from "../../../services/api/bankTransaction";
import TransactionGraphView from "./TransactionGraphView";

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function CaseFileReport() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlFileId = searchParams.get("fileId");

  // Case & Files state
  const [caseData, setCaseData] = useState(null);
  const [files, setFiles] = useState([]);
  const [isCaseLoading, setIsCaseLoading] = useState(true);
  const [caseError, setCaseError] = useState("");

  // Selected file
  const [selectedFileId, setSelectedFileId] = useState(
    urlFileId ? Number(urlFileId) : null
  );

  // Summary report for selected file
  const [summary, setSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Transactions list for selected file
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  // Filters State
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
    transactionType: "", // "", "debit", "credit"
    minAmount: "",
    maxAmount: "",
    channel: "", // "", "upi", "imps", "neft_rtgs", "atm", "cash_deposit", "cheque", "pos", "charges", "nach"
    dayType: "", // "", "weekday", "weekend"
    amountPattern: "", // "", "above_50k", "above_100k", "above_1000k", "round_figure", "smurfing_sub50k"
    excludeKeyword: "",
    minBalance: "",
    maxBalance: "",
    isLowBalance: false,
    hasChequeOnly: false,
    hasReferenceOnly: false,
    sourcePage: "",
    page: 1,
    pageSize: 50,
  });

  // View Mode: "grid" (tabular) or "graph" (visual analytics)
  const [viewMode, setViewMode] = useState("grid");

  // Advanced Filter Drawer Toggle & Active Tab
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("channel");

  // Search input with debouncing and validation
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");

  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (!val || !val.trim()) {
      setSearchError("");
      return;
    }
    // Validation: allow letters, numbers, spaces, and safe standard symbols: - / . , # @ _
    const validPattern = /^[a-zA-Z0-9\s\-_./,#@]*$/;
    if (!validPattern.test(val)) {
      setSearchError(
        "Only letters, numbers, spaces, and standard symbols (-, /, ., #, @) are allowed."
      );
    } else {
      setSearchError("");
    }
  };

  // Debounced search sync to filters
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      const validPattern = /^[a-zA-Z0-9\s\-_./,#@]*$/;

      if (!trimmed) {
        setFilters((prev) =>
          prev.search === "" ? prev : { ...prev, search: "", page: 1 }
        );
      } else if (!validPattern.test(trimmed)) {
        // Invalid query, do not search
      } else if (trimmed.length === 1) {
        // Wait for at least 2 characters before executing search
      } else {
        setFilters((prev) =>
          prev.search === trimmed ? prev : { ...prev, search: trimmed, page: 1 }
        );
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDateFromChange = (val) => {
    setFilters((prev) => {
      if (prev.dateTo && val && val > prev.dateTo) {
        setDateRangeError("From Date cannot be after To Date.");
      } else {
        setDateRangeError("");
      }
      return { ...prev, dateFrom: val, page: 1 };
    });
    setActiveQuickFilter("custom");
  };

  const handleDateToChange = (val) => {
    setFilters((prev) => {
      if (prev.dateFrom && val && val < prev.dateFrom) {
        setDateRangeError("To Date cannot be earlier than From Date.");
      } else {
        setDateRangeError("");
      }
      return { ...prev, dateTo: val, page: 1 };
    });
    setActiveQuickFilter("custom");
  };

  // Compute total active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.transactionType) count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.channel) count++;
    if (filters.dayType) count++;
    if (filters.amountPattern) count++;
    if (filters.excludeKeyword) count++;
    if (filters.minBalance) count++;
    if (filters.maxBalance) count++;
    if (filters.isLowBalance) count++;
    if (filters.hasChequeOnly) count++;
    if (filters.hasReferenceOnly) count++;
    if (filters.sourcePage) count++;
    return count;
  }, [filters]);

  // Active quick filter preset
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");

  // ------------------------------------------------------------
  // Load Case & Case Files
  // ------------------------------------------------------------
  const loadCaseAndFiles = useCallback(async () => {
    if (!caseId) return;

    try {
      setIsCaseLoading(true);
      setCaseError("");

      const [caseRes, filesRes] = await Promise.all([
        getCase(caseId),
        getCaseFiles(caseId),
      ]);

      const loadedCase = caseRes?.data || caseRes;
      const loadedFiles = Array.isArray(filesRes?.data)
        ? filesRes.data
        : Array.isArray(filesRes)
        ? filesRes
        : [];

      setCaseData(loadedCase);
      setFiles(loadedFiles);

      // Automatically select initial file:
      // Priority: URL fileId -> first completed file -> first file
      if (urlFileId && loadedFiles.some((f) => f.id === Number(urlFileId))) {
        setSelectedFileId(Number(urlFileId));
      } else {
        const completedFile = loadedFiles.find(
          (f) => String(f.status || "").toUpperCase() === "COMPLETED"
        );
        const fallbackId = completedFile?.id || loadedFiles[0]?.id || null;
        if (fallbackId) {
          setSelectedFileId(fallbackId);
          setSearchParams({ fileId: String(fallbackId) });
        }
      }
    } catch (err) {
      console.error("Failed to load case data:", err);
      setCaseError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load case files."
      );
    } finally {
      setIsCaseLoading(false);
    }
  }, [caseId, urlFileId, setSearchParams]);

  useEffect(() => {
    loadCaseAndFiles();
  }, [loadCaseAndFiles]);

  // ------------------------------------------------------------
  // Selected File Object
  // ------------------------------------------------------------
  const selectedFile = useMemo(() => {
    return files.find((f) => f.id === selectedFileId) || null;
  }, [files, selectedFileId]);

  // ------------------------------------------------------------
  // Handle File Selection Change
  // ------------------------------------------------------------
  const handleSelectFile = (fileId) => {
    setSelectedFileId(fileId);
    setSearchParams({ fileId: String(fileId) });
    // Reset filters and page
    setFilters((prev) => ({
      ...prev,
      search: "",
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      page: 1,
    }));
    setActiveQuickFilter("all");
  };

  // ------------------------------------------------------------
  // Load Summary for Selected File
  // ------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    if (!selectedFileId) {
      setSummary(null);
      return;
    }

    try {
      setIsSummaryLoading(true);
      const res = await getFileTransactionSummary(selectedFileId);
      setSummary(res?.data || null);
    } catch (err) {
      console.error("Failed to load file summary:", err);
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [selectedFileId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ------------------------------------------------------------
  // Load Filtered Transactions for Selected File
  // ------------------------------------------------------------
  const loadFilteredTransactions = useCallback(async () => {
    if (!caseId || !selectedFileId) {
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(0);
      return;
    }

    try {
      setIsTxLoading(true);
      setTxError("");

      const res = await searchCaseTransactions(caseId, {
        fileId: selectedFileId,
        search: filters.search,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        transactionType: filters.transactionType,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
        channel: filters.channel,
        dayType: filters.dayType,
        amountPattern: filters.amountPattern,
        excludeKeyword: filters.excludeKeyword,
        minBalance: filters.minBalance,
        maxBalance: filters.maxBalance,
        isLowBalance: filters.isLowBalance,
        hasChequeOnly: filters.hasChequeOnly,
        hasReferenceOnly: filters.hasReferenceOnly,
        sourcePage: filters.sourcePage,
        page: filters.page,
        pageSize: filters.pageSize,
      });

      const list = Array.isArray(res?.data) ? res.data : [];
      setTransactions(list);
      setTotalTransactions(res?.total || 0);
      setTotalPages(res?.total_pages || 0);
    } catch (err) {
      console.error("Failed to load transactions for file:", err);
      setTxError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to load transactions for this file."
      );
      setTransactions([]);
    } finally {
      setIsTxLoading(false);
    }
  }, [caseId, selectedFileId, filters]);

  useEffect(() => {
    loadFilteredTransactions();
  }, [loadFilteredTransactions]);

  // ------------------------------------------------------------
  // Quick Filters
  // ------------------------------------------------------------
  const applyQuickFilter = (type) => {
    setActiveQuickFilter(type);
    if (type === "all") {
      setFilters((prev) => ({
        ...prev,
        transactionType: "",
        minAmount: "",
        maxAmount: "",
        channel: "",
        dayType: "",
        amountPattern: "",
        isLowBalance: false,
        page: 1,
      }));
    } else if (type === "debit") {
      setFilters((prev) => ({
        ...prev,
        transactionType: "debit",
        page: 1,
      }));
    } else if (type === "credit") {
      setFilters((prev) => ({
        ...prev,
        transactionType: "credit",
        page: 1,
      }));
    } else if (type === "upi") {
      setFilters((prev) => ({
        ...prev,
        channel: "upi",
        page: 1,
      }));
    } else if (type === "atm") {
      setFilters((prev) => ({
        ...prev,
        channel: "atm",
        transactionType: "debit",
        page: 1,
      }));
    } else if (type === "cash_deposit") {
      setFilters((prev) => ({
        ...prev,
        channel: "cash_deposit",
        transactionType: "credit",
        page: 1,
      }));
    } else if (type === "above_50k") {
      setFilters((prev) => ({
        ...prev,
        amountPattern: "above_50k",
        page: 1,
      }));
    } else if (type === "round_amount") {
      setFilters((prev) => ({
        ...prev,
        amountPattern: "round_figure",
        page: 1,
      }));
    } else if (type === "smurfing") {
      setFilters((prev) => ({
        ...prev,
        amountPattern: "smurfing_sub50k",
        page: 1,
      }));
    } else if (type === "weekend") {
      setFilters((prev) => ({
        ...prev,
        dayType: "weekend",
        page: 1,
      }));
    }
  };

  const handleResetFilters = () => {
    setActiveQuickFilter("all");
    setSearchInput("");
    setSearchError("");
    setDateRangeError("");
    setFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      channel: "",
      dayType: "",
      amountPattern: "",
      excludeKeyword: "",
      minBalance: "",
      maxBalance: "",
      isLowBalance: false,
      hasChequeOnly: false,
      hasReferenceOnly: false,
      sourcePage: "",
      page: 1,
      pageSize: 50,
    });
  };

  const clearSingleFilter = (key) => {
    if (key === "search") {
      setSearchInput("");
      setSearchError("");
    }
    if (key === "dateRange") {
      setDateRangeError("");
      setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "", page: 1 }));
      return;
    }
    if (key === "amountRange") {
      setFilters((prev) => ({ ...prev, minAmount: "", maxAmount: "", page: 1 }));
      return;
    }
    if (key === "balanceRange") {
      setFilters((prev) => ({ ...prev, minBalance: "", maxBalance: "", page: 1 }));
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [key]:
        key === "isLowBalance" ||
        key === "hasChequeOnly" ||
        key === "hasReferenceOnly"
          ? false
          : "",
      page: 1,
    }));
  };

  // ------------------------------------------------------------
  // CSV Export
  // ------------------------------------------------------------
  const handleExportCSV = () => {
    if (!transactions.length) {
      Swal.fire({
        icon: "info",
        title: "No Data",
        text: "There are no transactions to export.",
        background: "#07110f",
        color: "#f8fafc",
      });
      return;
    }

    const headers = [
      "Date",
      "Description",
      "Cheque No",
      "Reference No",
      "Debit (INR)",
      "Credit (INR)",
      "Balance (INR)",
      "Source Page",
      "Source Row",
    ];

    const rows = transactions.map((tx) => [
      tx.transaction_date || "",
      `"${String(tx.description || "").replace(/"/g, '""')}"`,
      tx.cheque_number || "",
      tx.reference_number || "",
      tx.debit !== null ? tx.debit : "",
      tx.credit !== null ? tx.credit : "",
      tx.balance !== null ? tx.balance : "",
      tx.source_page || "",
      tx.source_row || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Report_${selectedFile?.original_filename || "file"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen bg-[#020b09] text-white">
      {/* Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-400/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute top-[600px] right-[-100px] h-[450px] w-[450px] rounded-full bg-violet-400/[0.025] blur-3xl" />

      <BASNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ===================================================
            HEADER & NAVIGATION
        ==================================================== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-400/10 pb-6">
          <div>
            <div className="flex items-center gap-3 text-xs mb-3">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/cases/${caseId}/reports`)}
                className="inline-flex items-center gap-2 font-semibold text-slate-400 hover:text-emerald-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Reports Center
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/cases/${caseId}`)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                Case Details
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                {caseData?.case_number || `CASE #${caseId}`}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                File Transaction Report
              </h1>
            </div>

            <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
              {caseData?.case_name ? (
                <>Case: <span className="font-semibold text-slate-200">{caseData.case_name}</span> &bull; </>
              ) : null}
              Select any file uploaded in this case to inspect its fully filtered transactions and financial summary.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!transactions.length}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* ===================================================
            CASE FILES SELECTOR ("us case pe jitni bhi file add ki hain")
        ==================================================== */}
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                1. Select File from this Case ({files.length} {files.length === 1 ? "File" : "Files"})
              </h2>
              <p className="text-xs text-slate-500">
                Click on any file to load that specific file's filtered transactions and statement report.
              </p>
            </div>
            {selectedFile && (
              <span className="text-xs text-emerald-400 font-semibold hidden sm:inline-block">
                Currently Viewing: {selectedFile.original_filename}
              </span>
            )}
          </div>

          {isCaseLoading ? (
            <div className="flex items-center gap-3 py-6 text-xs text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Loading case files...
            </div>
          ) : caseError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
              {caseError}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#061411] p-6 text-center text-xs text-slate-400">
              No files have been uploaded to this case yet. Please upload a bank statement PDF in Case Details first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((file) => {
                const isSelected = file.id === selectedFileId;
                const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleSelectFile(file.id)}
                    className={`
                      relative flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all
                      ${
                        isSelected
                          ? "border-emerald-400/50 bg-emerald-400/[0.08] shadow-[0_4px_25px_rgba(52,211,153,0.12)] ring-1 ring-emerald-400/40"
                          : "border-white/[0.08] bg-[#061411] hover:border-white/[0.18] hover:bg-white/[0.02]"
                      }
                    `}
                  >
                    {/* File Icon */}
                    <div
                      className={`
                        flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border
                        ${
                          isSelected
                            ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-300"
                            : "border-white/10 bg-white/[0.03] text-slate-400"
                        }
                      `}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-emerald-300" : "text-white"}`}>
                          {file.original_filename}
                        </p>
                        {isSelected && (
                          <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>&bull;</span>
                        <span
                          className={`
                            rounded-md px-1.5 py-0.2 text-[10px] font-semibold uppercase
                            ${
                              isCompleted
                                ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20"
                                : "bg-amber-400/15 text-amber-300 border border-amber-400/20"
                            }
                          `}
                        >
                          {file.status || "PENDING"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================================================
            FILE REPORT SUMMARY CARDS
        ==================================================== */}
        {selectedFile && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Report Summary:</span>
                  <span className="text-emerald-400">{selectedFile.original_filename}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Statement Period:{" "}
                  <span className="text-slate-200 font-medium">
                    {summary?.start_date ? formatDate(summary.start_date) : "N/A"}
                  </span>{" "}
                  to{" "}
                  <span className="text-slate-200 font-medium">
                    {summary?.end_date ? formatDate(summary.end_date) : "N/A"}
                  </span>
                </p>
              </div>

              {isSummaryLoading && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Updating summary...
                </span>
              )}
            </div>

            {/* 4 Financial Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Transactions */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#061411] p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Transactions
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-white">
                  {summary ? summary.total_transactions : "-"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Extracted from statement file
                </p>
              </div>

              {/* Total Debits (Withdrawals) */}
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                    Total Debits (Dr)
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-rose-400">
                  {summary ? formatCurrency(summary.total_debit) : "-"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Peak Debit: {summary?.max_debit ? formatCurrency(summary.max_debit) : "-"}
                </p>
              </div>

              {/* Total Credits (Deposits) */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Total Credits (Cr)
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-emerald-400">
                  {summary ? formatCurrency(summary.total_credit) : "-"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Peak Credit: {summary?.max_credit ? formatCurrency(summary.max_credit) : "-"}
                </p>
              </div>

              {/* Net Movement / Inflow-Outflow */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#061411] p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Net Movement
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/10 text-violet-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div
                  className={`mt-3 text-2xl font-bold ${
                    (summary?.net_movement || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {summary ? formatCurrency(summary.net_movement) : "-"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Closing Balance: {summary?.closing_balance !== null ? formatCurrency(summary?.closing_balance) : "-"}
                </p>
              </div>
            </div>

            {/* ===================================================
                FILTER CONTROLS ("fully filterd hona chahiye")
            ==================================================== */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#061411] p-5 shadow-xl space-y-4">
              {/* PRIMARY SEARCH & QUICK CONTROL BAR */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
                {/* Search Input with Validation */}
                <div className="lg:col-span-5">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchInput}
                      maxLength={80}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search description, reference, cheque #..."
                      className={`w-full rounded-xl border bg-[#020b09] pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition ${
                        searchError
                          ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-400"
                          : filters.search
                          ? "border-emerald-400/50 focus:border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.12)]"
                          : "border-white/[0.08] focus:border-emerald-400"
                      }`}
                    />
                    <svg
                      className={`absolute left-3.5 top-3 h-4 w-4 transition ${
                        searchError
                          ? "text-rose-400"
                          : filters.search
                          ? "text-emerald-400"
                          : "text-slate-500"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>

                    {/* Clear Search Button */}
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setSearchError("");
                          setFilters((prev) => ({ ...prev, search: "", page: 1 }));
                        }}
                        className="absolute right-3 top-2.5 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                        title="Clear search"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Search Validation / Status message */}
                  {searchError ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-rose-400">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{searchError}</span>
                    </p>
                  ) : searchInput.trim().length === 1 ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-400/90">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Type at least 2 characters to search</span>
                    </p>
                  ) : filters.search ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/80">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Filtered by: &quot;{filters.search}&quot; ({totalTransactions} matches)</span>
                    </p>
                  ) : null}
                </div>

                {/* Flow Direction / Type */}
                <div className="lg:col-span-2">
                  <select
                    value={filters.transactionType}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        transactionType: e.target.value,
                        page: 1,
                      }))
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="">All Flow (Dr & Cr)</option>
                    <option value="debit">🔴 Debits Only (Outflow)</option>
                    <option value="credit">🟢 Credits Only (Inflow)</option>
                  </select>
                </div>

                {/* Date From */}
                <div className="lg:col-span-2">
                  <div className="relative">
                    <input
                      ref={fromDateRef}
                      type="date"
                      value={filters.dateFrom}
                      max={filters.dateTo || undefined}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (_) {}
                      }}
                      onFocus={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (_) {}
                      }}
                      onChange={(e) => handleDateFromChange(e.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 pr-9 text-xs text-white [color-scheme:dark] transition focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          fromDateRef.current?.showPicker();
                        } catch (_) {}
                      }}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-400 transition"
                      title="Open calendar"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Date To */}
                <div className="lg:col-span-2">
                  <div className="relative">
                    <input
                      ref={toDateRef}
                      type="date"
                      value={filters.dateTo}
                      min={filters.dateFrom || undefined}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (_) {}
                      }}
                      onFocus={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (_) {}
                      }}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 pr-9 text-xs text-white [color-scheme:dark] transition focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          toDateRef.current?.showPicker();
                        } catch (_) {}
                      }}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-400 transition"
                      title="Open calendar"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Advanced Filters Drawer Toggle */}
                <div className="lg:col-span-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters((prev) => !prev)}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      showAdvancedFilters || activeFiltersCount > 0
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "border-white/[0.08] bg-[#020b09] text-slate-300 hover:border-emerald-500/30 hover:text-white"
                    }`}
                    title="Toggle Forensic Filters Suite"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-emerald-400 px-1.5 py-0.2 text-[10px] font-bold text-black">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Date range error warning */}
              {dateRangeError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-3.5 py-2 text-xs font-medium text-rose-400">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{dateRangeError}</span>
                </div>
              )}

              {/* ADVANCED FORENSIC FILTERS DRAWER */}
              {showAdvancedFilters && (
                <div className="rounded-xl border border-emerald-500/20 bg-[#020b09]/80 p-4 transition duration-200">
                  {/* Filter Suite Tabs */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("channel")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        activeFilterTab === "channel"
                          ? "bg-emerald-400 text-black font-semibold shadow"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>💳 Payment Mode / Channel</span>
                      {filters.channel && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("amount")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        activeFilterTab === "amount"
                          ? "bg-emerald-400 text-black font-semibold shadow"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>💰 Amount & Structuring</span>
                      {(filters.amountPattern || filters.minAmount || filters.maxAmount) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("timing")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        activeFilterTab === "timing"
                          ? "bg-emerald-400 text-black font-semibold shadow"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>⏱️ Timing & Days</span>
                      {filters.dayType && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("keywords")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        activeFilterTab === "keywords"
                          ? "bg-emerald-400 text-black font-semibold shadow"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>🔍 Exclusions & Audit Trail</span>
                      {(filters.excludeKeyword || filters.hasChequeOnly || filters.hasReferenceOnly) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("balance")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        activeFilterTab === "balance"
                          ? "bg-emerald-400 text-black font-semibold shadow"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>📊 Balance & Source Page</span>
                      {(filters.minBalance || filters.maxBalance || filters.isLowBalance || filters.sourcePage) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div className="pt-3.5">
                    {/* TAB 1: Payment Channel */}
                    {activeFilterTab === "channel" && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Select Channel / Instrument:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "", label: "All Modes" },
                            { id: "upi", label: "📱 UPI (GPay, PhonePe, Paytm)" },
                            { id: "imps", label: "⚡ IMPS Instant" },
                            { id: "neft_rtgs", label: "🏦 NEFT / RTGS" },
                            { id: "atm", label: "🏧 ATM Cash Withdrawal" },
                            { id: "cash_deposit", label: "💵 Cash Deposit / CDM" },
                            { id: "cheque", label: "📜 Cheque Clearing" },
                            { id: "pos", label: "💳 POS / Merchant Card" },
                            { id: "charges", label: "⚠️ Bank Charges / Penalty" },
                            { id: "nach", label: "🔁 NACH / ECS Auto-Debit" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFilters((prev) => ({ ...prev, channel: item.id, page: 1 }));
                                setActiveQuickFilter("custom");
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                                filters.channel === item.id
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-semibold"
                                  : "bg-white/[0.03] text-slate-300 border border-white/[0.06] hover:bg-white/[0.08]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Amount & Structuring */}
                    {activeFilterTab === "amount" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Amount Pattern & Forensic Structuring:
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "", label: "Any Amount" },
                              { id: "above_50k", label: "⚡ High Value > ₹50,000" },
                              { id: "above_100k", label: "💎 High Value > ₹1,00,000" },
                              { id: "above_1000k", label: "👑 Major Value > ₹10,00,000" },
                              { id: "round_figure", label: "🎯 Round Figures (e.g. ₹5K, ₹10K, ₹50K)" },
                              { id: "smurfing_sub50k", label: "🚨 Smurfing Structuring (₹45,000 to < ₹50,000)" },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, amountPattern: item.id, page: 1 }));
                                  setActiveQuickFilter("custom");
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                                  filters.amountPattern === item.id
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold"
                                    : "bg-white/[0.03] text-slate-300 border border-white/[0.06] hover:bg-white/[0.08]"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Min / Max Amount */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                              Custom Min Amount (₹)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={filters.minAmount}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  minAmount: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                              Custom Max Amount (₹)
                            </label>
                            <input
                              type="number"
                              placeholder="No limit"
                              value={filters.maxAmount}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  maxAmount: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: Timing & Days */}
                    {activeFilterTab === "timing" && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Day of the Week Filter:
                        </label>
                        <p className="text-xs text-slate-400">
                          Isolate off-hour activities and non-business banking cycles.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {[
                            { id: "", label: "All Days (Monday - Sunday)" },
                            { id: "weekday", label: "🏢 Weekdays Only (Monday to Friday)" },
                            { id: "weekend", label: "🏖️ Weekends Only (Saturday & Sunday)" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFilters((prev) => ({ ...prev, dayType: item.id, page: 1 }));
                                setActiveQuickFilter("custom");
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                                filters.dayType === item.id
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 font-semibold"
                                  : "bg-white/[0.03] text-slate-300 border border-white/[0.06] hover:bg-white/[0.08]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 4: Keywords & Audit */}
                    {activeFilterTab === "keywords" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                            Exclude Routine Keywords (Comma Separated)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. SALARY, INTEREST, CASHBACK, DIVIDEND"
                            value={filters.excludeKeyword}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                excludeKeyword: e.target.value,
                                page: 1,
                              }))
                            }
                            className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            Removes regular salary or interest noise to expose suspect transactions.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-white/[0.06]">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                            <input
                              type="checkbox"
                              checked={filters.hasChequeOnly}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  hasChequeOnly: e.target.checked,
                                  page: 1,
                                }))
                              }
                              className="rounded border-white/20 bg-black/40 text-emerald-400 focus:ring-0"
                            />
                            <span>Has Cheque Number Only (Paper Clearing Audit)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                            <input
                              type="checkbox"
                              checked={filters.hasReferenceOnly}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  hasReferenceOnly: e.target.checked,
                                  page: 1,
                                }))
                              }
                              className="rounded border-white/20 bg-black/40 text-emerald-400 focus:ring-0"
                            />
                            <span>Has UTR / Reference ID Only (Electronic Audit)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: Balance & Source Page */}
                    {activeFilterTab === "balance" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                              Min Post-Tx Balance (₹)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={filters.minBalance}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  minBalance: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                              Max Post-Tx Balance (₹)
                            </label>
                            <input
                              type="number"
                              placeholder="No limit"
                              value={filters.maxBalance}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  maxBalance: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06] items-center">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-rose-300 hover:text-rose-200">
                            <input
                              type="checkbox"
                              checked={filters.isLowBalance}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  isLowBalance: e.target.checked,
                                  page: 1,
                                }))
                              }
                              className="rounded border-white/20 bg-black/40 text-rose-400 focus:ring-0"
                            />
                            <span>⚠️ Low Balance Dips (Balance ≤ ₹1,000)</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">
                              PDF Source Page:
                            </label>
                            <input
                              type="number"
                              placeholder="e.g. 1"
                              value={filters.sourcePage}
                              onChange={(e) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  sourcePage: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-24 rounded-xl border border-white/[0.08] bg-[#020b09] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ACTIVE FILTER REMOVABLE PILLS */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1">
                    Active Filters ({activeFiltersCount}):
                  </span>

                  {filters.search && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] text-emerald-300">
                      Search: &quot;{filters.search}&quot;
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("search")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.transactionType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] text-white">
                      Type: {filters.transactionType.toUpperCase()}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("transactionType")}
                        className="hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {(filters.dateFrom || filters.dateTo) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] text-white">
                      Date: {filters.dateFrom || "Start"} to {filters.dateTo || "End"}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("dateRange")}
                        className="hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.channel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] text-emerald-300">
                      Mode: {filters.channel.toUpperCase()}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("channel")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.amountPattern && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] text-amber-300">
                      Pattern: {filters.amountPattern}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("amountPattern")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {(filters.minAmount || filters.maxAmount) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] text-white">
                      Amount: ₹{filters.minAmount || "0"} - ₹{filters.maxAmount || "∞"}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("amountRange")}
                        className="hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.dayType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[11px] text-purple-300">
                      Days: {filters.dayType}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("dayType")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.excludeKeyword && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] text-rose-300">
                      Excluding: &quot;{filters.excludeKeyword}&quot;
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("excludeKeyword")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {(filters.minBalance || filters.maxBalance) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] text-white">
                      Balance: ₹{filters.minBalance || "0"} - ₹{filters.maxBalance || "∞"}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("balanceRange")}
                        className="hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.isLowBalance && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[11px] text-rose-300">
                      Low Balance (&le; ₹1k)
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("isLowBalance")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.hasChequeOnly && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] text-blue-300">
                      Cheque Only
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("hasChequeOnly")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.hasReferenceOnly && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] text-blue-300">
                      Reference Only
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("hasReferenceOnly")}
                        className="hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {filters.sourcePage && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] text-white">
                      PDF Page: {filters.sourcePage}
                      <button
                        type="button"
                        onClick={() => clearSingleFilter("sourcePage")}
                        className="hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="ml-auto text-xs text-rose-400 hover:text-rose-300 underline font-medium transition"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* QUICK FILTER PRESETS & PAGE SIZE ROW */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Quick Presets:
                  </span>

                  {[
                    { id: "all", label: "All" },
                    { id: "debit", label: "🔴 Debits" },
                    { id: "credit", label: "🟢 Credits" },
                    { id: "upi", label: "📱 UPI" },
                    { id: "atm", label: "🏧 ATM Cash" },
                    { id: "cash_deposit", label: "💵 Cash Deposit" },
                    { id: "above_50k", label: "> ₹50K" },
                    { id: "round_amount", label: "🎯 Round Figures" },
                    { id: "smurfing", label: "🚨 Smurfing (< ₹50k)" },
                    { id: "weekend", label: "🏖️ Weekends" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyQuickFilter(preset.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        activeQuickFilter === preset.id
                          ? "bg-emerald-400 text-black font-bold shadow"
                          : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={filters.pageSize}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        pageSize: Number(e.target.value),
                        page: 1,
                      }))
                    }
                    className="rounded-xl border border-white/[0.08] bg-[#020b09] px-2.5 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value={200}>200 / page</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-slate-400 hover:text-white underline transition"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>

            {/* ===================================================
                FILTERED TRANSACTIONS TABLE
            ==================================================== */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#061411] overflow-hidden shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {viewMode === "grid" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Filtered Transactions Ledger (Grid View)
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        Forensic Financial Analytics (Graph View)
                      </>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Showing {transactions.length} of {totalTransactions} filtered transactions
                  </p>
                </div>

                {/* View Switcher: Grid View vs Graph View */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#020b09] p-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        viewMode === "grid"
                          ? "bg-emerald-400 text-black shadow-md shadow-emerald-400/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Switch to Tabular Grid View"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Grid View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode("graph")}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        viewMode === "graph"
                          ? "bg-cyan-400 text-black shadow-md shadow-cyan-400/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Switch to Visual Graphs & Charts View"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Graph View</span>
                    </button>
                  </div>

                  {viewMode === "grid" && totalPages > 0 && (
                    <div className="hidden sm:block text-xs text-slate-400 border-l border-white/[0.08] pl-3">
                      Page <span className="font-bold text-white">{filters.page}</span> of{" "}
                      <span className="font-bold text-white">{totalPages || 1}</span>
                    </div>
                  )}
                </div>
              </div>

              {isTxLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <p className="text-xs text-slate-400">Loading filtered transactions...</p>
                </div>
              ) : txError ? (
                <div className="p-8 text-center text-xs text-rose-300">
                  {txError}
                </div>
              ) : viewMode === "graph" ? (
                <div className="p-6">
                  <TransactionGraphView
                    transactions={transactions}
                    summary={summary}
                    formatDate={formatDate}
                  />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] text-slate-500 mb-3">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-white">No Matching Transactions</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    No transactions match the selected filter criteria for this file. Try adjusting your dates or amount ranges.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-white transition"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                        <th className="py-3.5 px-4 min-w-[280px]">Narration / Description</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Chq / Ref No</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap text-rose-400">Debit (Dr)</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap text-emerald-400">Credit (Cr)</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap">Balance</th>
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {transactions.map((tx, idx) => {
                        const rowNumber = (filters.page - 1) * filters.pageSize + idx + 1;
                        return (
                          <tr key={tx.id || idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                              {rowNumber}
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap text-slate-200">
                              {formatDate(tx.transaction_date)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-200 break-words leading-relaxed max-w-md">
                              {tx.description || tx.raw_narration || "-"}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {tx.cheque_number || tx.reference_number || "-"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-400 whitespace-nowrap">
                              {tx.debit !== null && tx.debit !== undefined ? formatCurrency(tx.debit) : "-"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                              {tx.credit !== null && tx.credit !== undefined ? formatCurrency(tx.credit) : "-"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-200 whitespace-nowrap">
                              {tx.balance !== null && tx.balance !== undefined ? formatCurrency(tx.balance) : "-"}
                            </td>
                            <td className="py-3.5 px-4 text-center text-[10px] text-slate-500 font-mono whitespace-nowrap">
                              {tx.source_page ? `P.${tx.source_page}` : ""}
                              {tx.source_row ? ` R.${tx.source_row}` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: Math.max(prev.page - 1, 1),
                      }))
                    }
                    disabled={filters.page <= 1 || isTxLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    &larr; Previous
                  </button>

                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>Page</span>
                    <span className="font-bold text-white">{filters.page}</span>
                    <span>of</span>
                    <span className="font-bold text-white">{totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: Math.min(prev.page + 1, totalPages),
                      }))
                    }
                    disabled={filters.page >= totalPages || isTxLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <BASFooter />
    </div>
  );
}

export default CaseFileReport;
