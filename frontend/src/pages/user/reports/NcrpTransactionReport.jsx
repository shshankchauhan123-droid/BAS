import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import {
  getCaseNcrpFiles,
  getNcrpFileView,
  getNcrpTransactions,
} from "../../../services/api/ncrp";
import { useAuth } from "../../../context/AuthContext";
import { formatFinancialValue } from "../../../utils/chartFormatter";

/**
 * Format amounts into Indian numbering system (e.g. 1,23,456.78)
 */
function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "-";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format datetime strings for reports display
 */
function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Format byte size into human readable string
 */
function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Extract structured destination information across all NCRP worksheet types
 */
function getDestinationInfo(tx) {
  const raw = tx.raw_data || {};
  const sheet = tx.sheet_name || "";

  if (sheet === "Money Transfer to") {
    const acc = raw["Account No"] || raw["account_no"] || "";
    return {
      type: "TRANSFER",
      account: acc && acc !== "-" ? acc : "Unknown / Pending Account",
      bank: tx.bank_name || raw["Bank/FIs"] || "-",
      badge: "Transfer",
      badgeColor: "emerald",
    };
  }
  if (sheet === "Withdrawal through ATM") {
    const atm = raw["ATM ID"] || raw["Place/Location of ATM"] || "Cash";
    return {
      type: "ATM",
      account: `ATM: ${atm}`,
      bank: raw["Action Taken By bank"] || raw["action_taken_by_bank"] || "ATM Terminal",
      badge: "ATM Cash",
      badgeColor: "sky",
    };
  }
  if (sheet === "Withdrawal through POS") {
    const pos = raw["Merchant Name"] || raw["MID"] || "Terminal";
    return {
      type: "POS",
      account: `POS: ${pos}`,
      bank: raw["Action Taken By bank"] || raw["action_taken_by_bank"] || "Merchant POS",
      badge: "POS",
      badgeColor: "violet",
    };
  }
  if (sheet === "Cash Withdrawal through Cheque") {
    const chq = raw["Cheque No"] || "Cash";
    return {
      type: "CHEQUE",
      account: `Cheque: ${chq}`,
      bank: raw["Action Taken By bank"] || raw["action_taken_by_bank"] || "Cheque Counter",
      badge: "Cheque",
      badgeColor: "purple",
    };
  }
  if (sheet === "Transaction put on hold") {
    return {
      type: "HOLD",
      account: "Lien / Freeze Action",
      bank: raw["Action Taken By bank"] || raw["action_taken_by_bank"] || tx.bank_name || "Lien Bank",
      badge: "Hold Action",
      badgeColor: "amber",
    };
  }
  return {
    type: "OTHER",
    account: raw["Account No"] || "Other / Pending",
    bank: tx.bank_name || "-",
    badge: "Other",
    badgeColor: "slate",
  };
}

/**
 * Custom Searchable Select Dropdown
 */
function SearchableSelect({
  label,
  stepNumber,
  value,
  options = [],
  onSelect,
  placeholder = "Choose an option",
  searchPlaceholder = "Search...",
  disabled = false,
  loading = false,
  emptyMessage = "No options available",
  badgeColor = "emerald",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedItem = useMemo(() => {
    return options.find((opt) => String(opt.id) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(query);
      const matchSubtitle = opt.subtitle?.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      return matchLabel || matchSubtitle || matchBadge;
    });
  }, [options, searchTerm]);

  return (
    <div className="relative flex-1 min-w-[280px]" ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
          {stepNumber && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-extrabold text-emerald-800">
              {stepNumber}
            </span>
          )}
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-xs font-semibold shadow-2xs transition-all ${
          disabled
            ? "border-slate-200 bg-slate-50/70 text-slate-400 cursor-not-allowed"
            : isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/10 text-slate-900"
            : "border-slate-300 text-slate-800 hover:border-slate-400"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
              <span>Loading...</span>
            </div>
          ) : selectedItem ? (
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold text-[#172554]">
                  {selectedItem.label}
                </span>
                {selectedItem.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase shrink-0 ${
                      badgeColor === "purple"
                        ? "border border-purple-200 bg-purple-50 text-purple-700"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {selectedItem.badge}
                  </span>
                )}
              </div>
              {selectedItem.subtitle && (
                <span className="truncate text-[11px] font-normal text-slate-500">
                  {selectedItem.subtitle}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ml-2 ${
            isOpen ? "rotate-180 text-emerald-600" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2">
            <svg
              className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(value);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50/90 text-emerald-950 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold">
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                              badgeColor === "purple"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="truncate text-[10px] text-slate-500 font-normal">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <svg
                        className="h-4 w-4 text-emerald-600 shrink-0 ml-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                {searchTerm ? "No matching options" : emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NcrpTransactionReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Route caseId if provided in URL (e.g. /dashboard/cases/5/reports/ncrp or /reports/ncrp?caseId=90)
  const urlCaseId = params.caseId || searchParams.get("caseId") || "";

  // 1. Cases State
  const [casesList, setCasesList] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(urlCaseId);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [caseError, setCaseError] = useState("");

  // 2. NCRP Files State (Strictly from ncrp_file table)
  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");

  // 3. Transactions State
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");

  // 4. Workbook Metadata & Dynamic Filter Options
  const [availableSheets, setAvailableSheets] = useState([]);
  const [availableBanks, setAvailableBanks] = useState([]);
  const [availableLayers, setAvailableLayers] = useState([]);
  const [availableAcknowledgements, setAvailableAcknowledgements] = useState([]);

  // 7. Filter State
  const [selectedSheet, setSelectedSheet] = useState("ALL");
  const [selectedBank, setSelectedBank] = useState("ALL");
  const [selectedLayer, setSelectedLayer] = useState("ALL");
  const [selectedAckNo, setSelectedAckNo] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // 8. Pagination & Totals State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState({
    total_amount: 0,
    total_disputed_amount: 0,
  });

  // 9. Expandable Row & Download States
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [isDownloadingWorkbook, setIsDownloadingWorkbook] = useState(false);

  // Debounce search term by 350ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load authorized cases on initial mount
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      try {
        setIsLoadingCases(true);
        setCaseError("");
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (isMounted) {
          setCasesList(list);
          if (urlCaseId) {
            setSelectedCaseId(urlCaseId);
          } else if (list.length > 0 && !selectedCaseId) {
            setSelectedCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
        if (isMounted) {
          setCaseError(
            err?.response?.data?.detail ||
              err?.message ||
              "Unable to load investigation cases."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCases(false);
        }
      }
    }
    fetchCases();
    return () => {
      isMounted = false;
    };
  }, [urlCaseId]);

  // When selectedCaseId changes: reset file, transactions, filters, and load NCRP files
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFiles([]);
      setSelectedFileId("");
      setTransactions([]);
      setTotalCount(0);
      setTotalPages(0);
      return;
    }

    let isMounted = true;
    async function fetchNcrpFiles() {
      try {
        setIsLoadingFiles(true);
        setFilesError("");
        setSelectedFileId("");
        setTransactions([]);
        setTotalCount(0);
        setTotalPages(0);
        setAvailableSheets([]);
        setAvailableBanks([]);
        setAvailableLayers([]);
        setAvailableAcknowledgements([]);

        // Reset filters
        setSelectedSheet("ALL");
        setSelectedBank("ALL");
        setSelectedLayer("ALL");
        setSelectedAckNo("ALL");
        setSearchTerm("");
        setDebouncedSearch("");
        setDateFrom("");
        setDateTo("");
        setMinAmount("");
        setMaxAmount("");
        setPage(1);

        const res = await getCaseNcrpFiles(selectedCaseId);
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (isMounted) {
          setNcrpFiles(list);
          if (list.length > 0) {
            setSelectedFileId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP files for case:", err);
        if (isMounted) {
          setFilesError(
            err?.response?.data?.detail ||
              err?.message ||
              "Failed to load NCRP workbooks for this case."
          );
          setNcrpFiles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFiles(false);
        }
      }
    }

    fetchNcrpFiles();

    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // Selected file object
  const activeFile = useMemo(() => {
    return ncrpFiles.find((f) => String(f.id) === String(selectedFileId)) || null;
  }, [ncrpFiles, selectedFileId]);


  // Load transactions when selectedFileId, filters, or pagination changes
  const fetchTransactions = useCallback(async () => {
    if (!selectedFileId || !selectedCaseId) {
      setTransactions([]);
      setTotalCount(0);
      setTotalPages(0);
      return;
    }

    if (activeFile && String(activeFile.status).toUpperCase() !== "COMPLETED") {
      setTransactions([]);
      setTotalCount(0);
      setTotalPages(0);
      return;
    }

    try {
      setIsLoadingTransactions(true);
      setTransactionsError("");

      const skip = (page - 1) * pageSize;
      const res = await getNcrpTransactions(selectedFileId, {
        caseId: selectedCaseId,
        sheetName: selectedSheet !== "ALL" ? selectedSheet : null,
        bankName: selectedBank !== "ALL" ? selectedBank : null,
        layer: selectedLayer !== "ALL" ? selectedLayer : null,
        acknowledgementNo: selectedAckNo !== "ALL" ? selectedAckNo : null,
        search: debouncedSearch.trim() || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        minAmount: minAmount !== "" ? minAmount : null,
        maxAmount: maxAmount !== "" ? maxAmount : null,
        skip,
        limit: pageSize,
      });

      if (res && typeof res === "object") {
        const items = Array.isArray(res.items)
          ? res.items
          : Array.isArray(res.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        setTransactions(items);
        setTotalCount(Number(res.total ?? items.length));
        setTotalPages(Number(res.total_pages ?? Math.ceil(items.length / pageSize)));

        if (Array.isArray(res.sheets) && res.sheets.length > 0) {
          setAvailableSheets(res.sheets);
        }
        if (Array.isArray(res.banks) && res.banks.length > 0) {
          setAvailableBanks(res.banks);
        }
        if (Array.isArray(res.layers) && res.layers.length > 0) {
          setAvailableLayers(res.layers);
        }
        if (Array.isArray(res.acknowledgements) && res.acknowledgements.length > 0) {
          setAvailableAcknowledgements(res.acknowledgements);
        }

        if (res.summary) {
          setSummary({
            total_amount: res.summary.total_amount || 0,
            total_disputed_amount: res.summary.total_disputed_amount || 0,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactionsError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load transactions for this NCRP file."
      );
      setTransactions([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [
    selectedFileId,
    selectedCaseId,
    activeFile,
    selectedSheet,
    selectedBank,
    selectedLayer,
    selectedAckNo,
    debouncedSearch,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset all filters
  const handleClearFilters = () => {
    setSelectedSheet("ALL");
    setSelectedBank("ALL");
    setSelectedLayer("ALL");
    setSelectedAckNo("ALL");
    setSearchTerm("");
    setDebouncedSearch("");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setPage(1);
  };

  const hasActiveFilters =
    selectedSheet !== "ALL" ||
    selectedBank !== "ALL" ||
    selectedLayer !== "ALL" ||
    selectedAckNo !== "ALL" ||
    searchTerm.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    minAmount !== "" ||
    maxAmount !== "";

  // Table transactions for display
  const displayedTransactions = transactions;

  // Download original Excel workbook
  const handleDownloadWorkbook = async () => {
    if (!activeFile?.id || !selectedCaseId) return;
    try {
      setIsDownloadingWorkbook(true);
      const blob = await getNcrpFileView(activeFile.id, selectedCaseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = activeFile.original_filename || `NCRP_Workbook_${activeFile.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Failed to download workbook:", err);
      alert("Unable to download workbook. Please try again.");
    } finally {
      setIsDownloadingWorkbook(false);
    }
  };

  // Prepare Case Options for Dropdown
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: c.case_name || `Case #${c.id}`,
      subtitle: c.case_number ? `Case No: ${c.case_number}` : `Case ID: ${c.id}`,
      badge: c.status?.replaceAll("_", " "),
    }));
  }, [casesList]);

  // Prepare NCRP File Options for Dropdown (strictly ncrp_file)
  const fileOptions = useMemo(() => {
    return ncrpFiles.map((f) => ({
      id: f.id,
      label: f.original_filename,
      subtitle: `${f.sheet_count || 1} sheets • ${
        Number(f.imported_rows ?? f.total_rows ?? 0).toLocaleString("en-IN")
      } rows • ${formatFileSize(f.file_size)}`,
      badge: f.status || "COMPLETED",
    }));
  }, [ncrpFiles]);

  // Effective KPI numbers for transaction grid
  const effectiveKpis = useMemo(() => {
    const ratio = summary.total_amount > 0
      ? ((summary.total_disputed_amount / summary.total_amount) * 100).toFixed(1)
      : "0.0";
    return {
      total_transactions: totalCount,
      total_amount: summary.total_amount,
      total_disputed: summary.total_disputed_amount,
      dispute_ratio: ratio,
      worksheets_count: availableSheets.length,
      banks_count: availableBanks.length,
      layers_count: availableLayers.length,
      layers_represented: availableLayers.map((l) => `Layer ${l}`),
    };
  }, [totalCount, summary, availableSheets.length, availableBanks.length, availableLayers]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col">
      <BASNavbar />

      <main className="flex-1 pb-16">
        {/* ============================================================
            A. PAGE HEADER
        ============================================================ */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                    NCRP Cyber Intelligence
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-500">
                    Worksheet Transaction Grid & Audit Trail
                  </span>
                </div>
                <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                  NCRP Transaction Grid
                </h1>
                <p className="mt-1 text-xs text-[#64748B]">
                  View, search, filter, and audit transactions imported from NCRP Excel workbooks.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start md:self-center">
                <button
                  type="button"
                  onClick={() => navigate(selectedCaseId ? `/reports/ncrp?caseId=${selectedCaseId}` : "/reports/ncrp")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                  title="Return to NCRP Reports Hub"
                >
                  <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to Reports
                </button>

                {activeFile && (
                  <button
                    type="button"
                    onClick={handleDownloadWorkbook}
                    disabled={isDownloadingWorkbook}
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-800 shadow-2xs transition hover:bg-purple-100 disabled:opacity-50"
                    title="Download original uploaded Excel workbook"
                  >
                    {isDownloadingWorkbook ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-600/30 border-t-purple-600" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Excel
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* ============================================================
              B & C. CASE & NCRP FILE SELECTION CARD
          ============================================================ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* B. CASE SELECTOR */}
              <SearchableSelect
                stepNumber="1"
                label="Select Investigation Case"
                value={selectedCaseId}
                options={caseOptions}
                onSelect={(id) => {
                  setSelectedCaseId(String(id));
                  setSearchParams({ caseId: String(id) }, { replace: true });
                }}
                loading={isLoadingCases}
                placeholder="Choose investigation case..."
                searchPlaceholder="Search case by name or number..."
                emptyMessage="No active cases found"
                badgeColor="emerald"
              />

              {/* ARROW SEPARATOR */}
              <div className="hidden lg:flex items-center justify-center pt-5 text-slate-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>

              {/* C. NCRP FILE SELECTOR */}
              <SearchableSelect
                stepNumber="2"
                label="Select NCRP Excel Workbook"
                value={selectedFileId}
                options={fileOptions}
                onSelect={(id) => {
                  setSelectedFileId(String(id));
                  setPage(1);
                }}
                disabled={!selectedCaseId || isLoadingFiles || ncrpFiles.length === 0}
                loading={isLoadingFiles}
                placeholder={
                  !selectedCaseId
                    ? "Select a case first"
                    : ncrpFiles.length === 0
                    ? "No NCRP files uploaded"
                    : "Choose NCRP workbook..."
                }
                searchPlaceholder="Search workbook filename..."
                emptyMessage="No NCRP workbooks in this case"
                badgeColor="purple"
              />
            </div>

            {/* CASE LEVEL NOTICES */}
            {caseError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {caseError}
              </div>
            )}

            {filesError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {filesError}
              </div>
            )}

            {/* EMPTY STATE FOR CASE WITHOUT NCRP FILES */}
            {selectedCaseId && !isLoadingFiles && ncrpFiles.length === 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="h-5 w-5 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    No NCRP statements found for this case. Upload an NCRP Excel workbook to generate transaction reports.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/upload/ncrp")}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 shrink-0"
                >
                  Upload NCRP
                </button>
              </div>
            )}

            {/* NON-COMPLETED FILE STATUS NOTICE */}
            {activeFile && String(activeFile.status).toUpperCase() !== "COMPLETED" && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-800 flex items-center gap-2.5">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600 shrink-0" />
                <span>
                  Current status: <strong>{activeFile.status}</strong>. Transactions will become available as soon as worksheet parsing and database import complete.
                </span>
              </div>
            )}
          </section>

          {/* ============================================================
              D. UNIFIED FILTERS BAR
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Unified Report Filters
                  </h3>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Clear All Filters
                  </button>
                )}
              </div>

              {/* QUICK LAYER SELECTOR PILLS */}
              <div className="border-t border-slate-100 pt-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Filter by Layer:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLayer("ALL");
                      setPage(1);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                      selectedLayer === "ALL"
                        ? "bg-[#172554] text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    All Layers ({availableLayers.length})
                  </button>

                  {availableLayers.map((l) => {
                    const isSelected = selectedLayer === String(l) || selectedLayer === `Layer ${l}`;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setSelectedLayer(String(l));
                          setPage(1);
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                        }`}
                      >
                        Layer {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FILTER CONTROLS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {/* 1. Acknowledgement Number Filter */}
                <div>
                  <label htmlFor="filter-ack" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Acknowledgement No.
                  </label>
                  <select
                    id="filter-ack"
                    value={selectedAckNo}
                    onChange={(e) => {
                      setSelectedAckNo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Acknowledgements ({availableAcknowledgements.length})</option>
                    {availableAcknowledgements.map((ack) => (
                      <option key={ack} value={ack}>
                        {ack}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Worksheet Filter */}
                <div>
                  <label htmlFor="filter-sheet" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Worksheet
                  </label>
                  <select
                    id="filter-sheet"
                    value={selectedSheet}
                    onChange={(e) => {
                      setSelectedSheet(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Worksheets ({availableSheets.length})</option>
                    {availableSheets.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Bank Filter */}
                <div>
                  <label htmlFor="filter-bank" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Bank Name
                  </label>
                  <select
                    id="filter-bank"
                    value={selectedBank}
                    onChange={(e) => {
                      setSelectedBank(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Banks ({availableBanks.length})</option>
                    {availableBanks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Search Filter */}
                <div>
                  <label htmlFor="filter-search" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Search Across Fields
                  </label>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      id="filter-search"
                      type="text"
                      placeholder="Account, UTR, Bank, Ack..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Date From */}
                <div>
                  <label htmlFor="filter-date-from" className="block text-[11px] font-bold text-slate-600 mb-1">
                    From Date
                  </label>
                  <input
                    id="filter-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 6. Date To */}
                <div>
                  <label htmlFor="filter-date-to" className="block text-[11px] font-bold text-slate-600 mb-1">
                    To Date
                  </label>
                  <input
                    id="filter-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 7. Min Amount */}
                <div>
                  <label htmlFor="filter-min-amt" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Min Amount (₹)
                  </label>
                  <input
                    id="filter-min-amt"
                    type="number"
                    placeholder="0"
                    min="0"
                    value={minAmount}
                    onChange={(e) => {
                      setMinAmount(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 8. Max Amount */}
                <div>
                  <label htmlFor="filter-max-amt" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Max Amount (₹)
                  </label>
                  <input
                    id="filter-max-amt"
                    type="number"
                    placeholder="No upper limit"
                    min="0"
                    value={maxAmount}
                    onChange={(e) => {
                      setMaxAmount(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ============================================================
              E. SUMMARY KPI CARDS (TRANSACTION GRID METRICS)
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {/* 1. Total Transactions */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Total Txns</p>
                <p className="mt-1 text-base sm:text-lg font-black text-[#172554]">
                  {Number(effectiveKpis.total_transactions).toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">filtered rows</p>
              </div>

              {/* 2. Total Transaction Amount */}
              <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Txn Amt</p>
                <p className="mt-1 text-base sm:text-lg font-black text-emerald-700 truncate" title={`₹${formatIndianCurrency(effectiveKpis.total_amount)}`}>
                  ₹{formatFinancialValue(effectiveKpis.total_amount)}
                </p>
                <p className="text-[10px] text-emerald-600/70 mt-0.5">gross volume</p>
              </div>

              {/* 3. Total Disputed Amount */}
              <div className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Disputed Amt</p>
                <p className="mt-1 text-base sm:text-lg font-black text-amber-700 truncate" title={`₹${formatIndianCurrency(effectiveKpis.total_disputed)}`}>
                  ₹{formatFinancialValue(effectiveKpis.total_disputed)}
                </p>
                <p className="text-[10px] text-amber-600/70 mt-0.5">complaint value</p>
              </div>

              {/* 4. Dispute Ratio */}
              <div className="rounded-2xl border border-rose-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Dispute Ratio</p>
                <p className="mt-1 text-base sm:text-lg font-black text-rose-700">
                  {effectiveKpis.dispute_ratio}%
                </p>
                <p className="text-[10px] text-rose-600/70 mt-0.5">dispute share</p>
              </div>

              {/* 5. Worksheets */}
              <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Worksheets</p>
                <p className="mt-1 text-base sm:text-lg font-black text-blue-700">
                  {effectiveKpis.worksheets_count}
                </p>
                <p className="text-[10px] text-blue-600/70 mt-0.5">workbook sheets</p>
              </div>

              {/* 6. Layers */}
              <div className="rounded-2xl border border-purple-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Layers</p>
                <p className="mt-1 text-base sm:text-lg font-black text-purple-700">
                  {effectiveKpis.layers_count} {effectiveKpis.layers_count === 1 ? "Layer" : "Layers"}
                </p>
                <p className="text-[10px] text-purple-600/70 mt-0.5 truncate">
                  {availableLayers.length > 0 ? availableLayers.map(l => `L${l}`).join(', ') : "N/A"}
                </p>
              </div>
            </section>
          )}

          {/* ============================================================
              F. TRANSACTION DATA GRID
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#172554] tracking-tight">
                    Transaction Audit Records
                  </h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Displaying imported NCRP workbook transaction rows with synchronized filters
                  </p>
                </div>
              </div>

              {transactionsError && (
                <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                  {transactionsError}
                </div>
              )}

              {isLoadingTransactions ? (
                <div className="flex min-h-[350px] flex-col items-center justify-center p-8">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
                  <p className="mt-4 text-xs font-semibold text-slate-500">
                    Loading NCRP transactions...
                  </p>
                </div>
              ) : displayedTransactions.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-[#172554]">
                    No transactions found
                  </h4>
                  <p className="mt-1 text-xs text-[#64748B] max-w-md">
                    {hasActiveFilters
                      ? "No records matched your selected criteria. Try clearing or expanding your filters."
                      : "This NCRP workbook does not contain any imported transaction records."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      <tr>
                        <th className="px-3 py-3.5 text-center">#</th>
                        <th className="px-3.5 py-3.5">Worksheet</th>
                        <th className="px-3.5 py-3.5">Ack Number</th>
                        <th className="px-3.5 py-3.5">Sender / Source</th>
                        <th className="px-3.5 py-3.5">Receiver / Destination</th>
                        <th className="px-3.5 py-3.5">Transaction ID / UTR</th>
                        <th className="px-3.5 py-3.5">Date</th>
                        <th className="px-3.5 py-3.5 text-right">Amount (₹)</th>
                        <th className="px-3.5 py-3.5 text-right">Disputed (₹)</th>
                        <th className="px-3 py-3.5 text-center">Layer</th>
                        <th className="px-3 py-3.5 text-center">Raw Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {displayedTransactions.map((tx, idx) => {
                        const isExpanded = expandedRowId === tx.id;
                        const rawKeys = tx.raw_data ? Object.keys(tx.raw_data) : [];
                        const destInfo = getDestinationInfo(tx);

                        return (
                          <React.Fragment key={tx.id}>
                            <tr
                              className={`transition-colors hover:bg-slate-50/80 ${
                                isExpanded ? "bg-purple-50/20" : ""
                              }`}
                            >
                              {/* Row index */}
                              <td className="px-3 py-3 text-center text-slate-400 font-mono text-[11px]">
                                {(page - 1) * pageSize + idx + 1}
                              </td>

                              {/* Worksheet */}
                              <td className="px-3.5 py-3">
                                <span
                                  className="inline-block max-w-[130px] truncate rounded-md bg-purple-50 border border-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800"
                                  title={tx.sheet_name}
                                >
                                  {tx.sheet_name}
                                </span>
                              </td>

                              {/* Ack No */}
                              <td className="px-3.5 py-3 font-mono text-[11px] text-[#172554] select-all">
                                {tx.acknowledgement_no || "-"}
                              </td>

                              {/* Sender / Source Account */}
                              <td className="px-3.5 py-3 max-w-[170px]">
                                <div className="font-mono text-[11px] font-bold text-[#172554] select-all truncate" title={tx.account_or_wallet_id}>
                                  {tx.account_or_wallet_id || "-"}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate" title={tx.action_taken_by_bank || tx.bank_name || ""}>
                                  {tx.action_taken_by_bank || tx.bank_name || "Source Bank"}
                                </div>
                              </td>

                              {/* Receiver / Destination Account */}
                              <td className="px-3.5 py-3 max-w-[180px]">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-mono text-[11px] font-bold select-all truncate ${
                                      destInfo.type === "HOLD" ? "text-amber-800 italic" : "text-[#172554]"
                                    }`}
                                    title={destInfo.account}
                                  >
                                    {destInfo.account}
                                  </span>
                                  <span
                                    className={`rounded px-1 py-0.2 text-[8px] font-extrabold uppercase shrink-0 ${
                                      destInfo.badgeColor === "emerald"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : destInfo.badgeColor === "sky"
                                        ? "bg-sky-100 text-sky-800"
                                        : destInfo.badgeColor === "violet"
                                        ? "bg-violet-100 text-violet-800"
                                        : destInfo.badgeColor === "amber"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {destInfo.badge}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate" title={destInfo.bank}>
                                  {destInfo.bank}
                                </div>
                              </td>

                              {/* Transaction ID / UTR */}
                              <td className="px-3.5 py-3 font-mono text-[11px] text-[#172554] select-all max-w-[160px]">
                                <div className="truncate" title={tx.transaction_id_utr || ""}>{tx.transaction_id_utr || "-"}</div>
                                {tx.source_utr && tx.source_utr !== tx.transaction_id_utr && (
                                  <div className="text-[10px] text-slate-500 font-mono tracking-tight mt-0.5 truncate" title={`Src UTR: ${tx.source_utr}`}>
                                    <span className="text-slate-400 font-semibold">Src: </span>{tx.source_utr}
                                  </div>
                                )}
                              </td>

                              {/* Date */}
                              <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 text-[11px]">
                                {formatDateTime(tx.transaction_date)}
                              </td>

                              {/* Amount */}
                              <td className="px-3.5 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                ₹{formatIndianCurrency(tx.transaction_amount)}
                              </td>

                              {/* Disputed Amount */}
                              <td className="px-3.5 py-3 text-right font-bold text-amber-700 whitespace-nowrap">
                                {tx.disputed_amount
                                  ? `₹${formatIndianCurrency(tx.disputed_amount)}`
                                  : "-"}
                              </td>

                              {/* Layer */}
                              <td className="px-3 py-3 text-center">
                                {tx.layer ? (
                                  <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                    {tx.layer}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>

                              {/* Details button */}
                              <td className="px-3 py-3 text-center">
                                {rawKeys.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRowId(isExpanded ? null : tx.id)}
                                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition shadow-2xs ${
                                      isExpanded
                                        ? "border-purple-300 bg-purple-100 text-purple-800"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                                    }`}
                                    title="Toggle raw data columns"
                                  >
                                    {isExpanded ? "Hide" : `+${rawKeys.length}`}
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>

                            {/* EXPANDED WORKSHEET RAW DATA */}
                            {isExpanded && tx.raw_data && (
                              <tr className="bg-purple-50/30">
                                <td colSpan={11} className="px-6 py-4 border-y border-purple-100">
                                  <div className="rounded-xl border border-purple-200/80 bg-white p-4 shadow-2xs">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800 mb-3 flex items-center gap-2">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                      </svg>
                                      Worksheet-Specific Fields & Raw Row Data ({tx.sheet_name}, Source Row {tx.row_number})
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                                      {Object.entries(tx.raw_data).map(([k, v]) => (
                                        <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title={k}>
                                            {k}
                                          </p>
                                          <p className="mt-0.5 font-semibold text-[#172554] break-words select-all">
                                            {v !== null && v !== undefined && v !== "" ? String(v) : "-"}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PAGINATION CONTROLS */}
              {transactions.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-[#64748B]">
                      Showing{" "}
                      <span className="font-bold text-slate-800">
                        {totalCount > 0 ? (page - 1) * pageSize + 1 : 0}
                      </span>{" "}
                      to{" "}
                      <span className="font-bold text-slate-800">
                        {Math.min(page * pageSize, totalCount)}
                      </span>{" "}
                      of <span className="font-bold text-slate-800">{totalCount}</span> records
                    </p>

                    <div className="flex items-center gap-1.5 ml-2">
                      <label htmlFor="ncrp-page-size" className="text-[11px] text-slate-500">
                        Per page:
                      </label>
                      <select
                        id="ncrp-page-size"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isLoadingTransactions}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      Previous
                    </button>

                    <span className="text-xs font-bold text-slate-700 px-2">
                      Page {totalPages > 0 ? page : 0} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isLoadingTransactions}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* EMPTY CASE PROMPT (WHEN NO CASE SELECTED) */}
          {!selectedCaseId && !isLoadingCases && (
            <section className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-2xs">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-[#172554]">
                Select an Investigation Case
              </h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm">
                Choose an investigation case from the dropdown above to load its uploaded NCRP Excel statements and view transaction reports.
              </p>
            </section>
          )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
