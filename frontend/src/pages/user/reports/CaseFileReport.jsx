import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import BASNavbar from "../../../components/layout/UserNavbar";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import {
  searchCaseTransactions,
  getCaseTransactionSummary,
  getTransactionModes,
  exportCaseTransactions,
} from "../../../services/api/bankTransaction";
import TransactionGraphView, { getFileColor } from "./TransactionGraphView";

const MODE_METADATA = {
  UPI: { label: "UPI (GPay / PhonePe / Paytm)", icon: "📱" },
  NEFT: { label: "NEFT Transfer", icon: "🏦" },
  RTGS: { label: "RTGS High-Value", icon: "🏛️" },
  IMPS: { label: "IMPS Instant", icon: "⚡" },
  ATM: { label: "ATM Withdrawal", icon: "🏧" },
  CASH: { label: "Cash / CDM", icon: "💵" },
  CHEQUE: { label: "Cheque Clearing", icon: "📜" },
  POS: { label: "POS / Card Swipe", icon: "💳" },
  NACH: { label: "NACH Auto-Debit", icon: "🔁" },
  ECS: { label: "ECS Clearing", icon: "🔄" },
  OTHER: { label: "Other / Uncategorized", icon: "❓" },
};

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
  const { caseId: paramCaseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active case state & all cases for switcher
  const [activeCaseId, setActiveCaseId] = useState(paramCaseId || "");
  const [allCases, setAllCases] = useState([]);
  const [loadingAllCases, setLoadingAllCases] = useState(false);

  // Sync activeCaseId if paramCaseId changes
  useEffect(() => {
    if (paramCaseId && paramCaseId !== activeCaseId) {
      setActiveCaseId(paramCaseId);
    }
  }, [paramCaseId]);

  // Fetch all cases for the Case Switcher dropdown
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      try {
        setLoadingAllCases(true);
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (isMounted) {
          setAllCases(list);
          // If no activeCaseId yet, select the first case automatically
          if (!activeCaseId && list.length > 0) {
            const firstId = list[0].id;
            setActiveCaseId(firstId);
            navigate(`/dashboard/cases/${firstId}/reports/file-statement`, {
              replace: true,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch cases list:", err);
      } finally {
        if (isMounted) setLoadingAllCases(false);
      }
    }
    fetchCases();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Case Switching
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) return;
    setActiveCaseId(newCaseId);
    setSelectedFileIds([]);
    setSummary(null);
    setTransactions([]);
    setSearchParams({});
    navigate(`/dashboard/cases/${newCaseId}/reports/file-statement`);
  };

  // Case & Files state
  const [caseData, setCaseData] = useState(null);
  const [files, setFiles] = useState([]);
  const [isCaseLoading, setIsCaseLoading] = useState(true);
  const [caseError, setCaseError] = useState("");

  // Selected files - default empty so user picks single or multiple files manually
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  // Select all / clear all files
  const handleSelectAllFiles = () => {
    const allIds = files.map((f) => f.id);
    setSelectedFileIds(allIds);
  };

  const handleDeselectAllFiles = () => {
    setSelectedFileIds([]);
  };

  // O(1) file lookup map for instantaneous lookups with zero freeze/hang
  const fileMap = useMemo(() => {
    const map = new Map();
    (files || []).forEach((f) => map.set(String(f.id), f));
    return map;
  }, [files]);

  // Summary report for selected files
  const [summary, setSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // All transaction modes loaded directly from database transaction_mode table
  const [dbTransactionModes, setDbTransactionModes] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getTransactionModes()
      .then((res) => {
        if (isMounted && res?.data && Array.isArray(res.data)) {
          setDbTransactionModes(res.data);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch database transaction modes:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived financial metrics for the enhanced summary dashboard
  const financialMetrics = useMemo(() => {
    if (!summary) {
      return {
        totalDebits: 0,
        totalCredits: 0,
        netMovement: 0,
        totalTurnover: 0,
        debitPercent: 0,
        creditPercent: 0,
        isPositive: true,
      };
    }
    const totalDebits = Number(summary.total_debits || 0);
    const totalCredits = Number(summary.total_credits || 0);
    const netMovement = totalCredits - totalDebits;
    const totalTurnover = totalDebits + totalCredits;
    const debitPercent =
      totalTurnover > 0 ? ((totalDebits / totalTurnover) * 100).toFixed(1) : 0;
    const creditPercent =
      totalTurnover > 0 ? ((totalCredits / totalTurnover) * 100).toFixed(1) : 0;
    return {
      totalDebits,
      totalCredits,
      netMovement,
      totalTurnover,
      debitPercent,
      creditPercent,
      isPositive: netMovement >= 0,
    };
  }, [summary]);

  // Transactions list for selected file
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [graphTransactions, setGraphTransactions] = useState([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [dynamicModeCounts, setDynamicModeCounts] = useState({});

  // Filters State
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
    transactionType: "", // "", "debit", "credit"
    minAmount: "",
    maxAmount: "",
    channel: "", // dynamic mode string from data
    dayType: "", // "", "weekday", "weekend"
    amountPattern: "", // "", "above_50k", "above_100k", "above_1000k", "round_figure", "smurfing_sub50k"
    excludeKeyword: "",
    minBalance: "",
    maxBalance: "",
    isLowBalance: false,
    hasChequeOnly: false,
    hasReferenceOnly: false,
    sourcePage: "",
    sortBy: "transaction_date",
    sortOrder: "asc",
    page: 1,
    pageSize: 50,
  });

  // Dynamic Custom Filter Builder state
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterRuleField, setFilterRuleField] = useState("description");
  const [filterRuleOperator, setFilterRuleOperator] = useState("contains");
  const [filterRuleValue, setFilterRuleValue] = useState("");
  const [filterRuleValue2, setFilterRuleValue2] = useState("");

  // View Mode: "grid" (tabular) or "graph" (visual analytics)
  const [viewMode, setViewMode] = useState("grid");

  // Advanced Filter Drawer Toggle & Active Tab
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("amount");

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
    if (!activeCaseId) {
      setIsCaseLoading(false);
      setCaseData(null);
      setFiles([]);
      return;
    }

    try {
      setIsCaseLoading(true);
      setCaseError("");

      const [caseRes, filesRes] = await Promise.all([
        getCase(activeCaseId),
        getCaseFiles(activeCaseId),
      ]);

      const loadedCase = caseRes?.data || caseRes;
      const loadedFiles = Array.isArray(filesRes?.data)
        ? filesRes.data
        : Array.isArray(filesRes)
        ? filesRes
        : [];

      setCaseData(loadedCase);
      setFiles(loadedFiles);

      const queryFileId = searchParams.get("fileId");
      if (queryFileId) {
        const parsed = Number(queryFileId);
        if (loadedFiles.some((f) => f.id === parsed)) {
          setSelectedFileIds([parsed]);
        } else {
          setSelectedFileIds([]);
        }
      } else {
        // Do not auto-select files; user selects single or multiple files manually
        setSelectedFileIds([]);
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
  }, [activeCaseId]);

  useEffect(() => {
    loadCaseAndFiles();
  }, [loadCaseAndFiles]);

  // ------------------------------------------------------------
  // Selected Files Object
  // ------------------------------------------------------------
  const selectedFilesData = useMemo(() => {
    return files.filter((f) => selectedFileIds.includes(f.id));
  }, [files, selectedFileIds]);

  // ------------------------------------------------------------
  // Handle File Selection Change (Single or Multiple)
  // ------------------------------------------------------------
  const handleSelectFile = (fileId) => {
    let newIds;
    if (selectedFileIds.includes(fileId)) {
      newIds = selectedFileIds.filter((id) => id !== fileId);
    } else {
      newIds = [...selectedFileIds, fileId];
    }
    setSelectedFileIds(newIds);
    
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
    if (!activeCaseId || selectedFileIds.length === 0) {
      setSummary(null);
      return;
    }

    try {
      setIsSummaryLoading(true);
      const res = await getCaseTransactionSummary(activeCaseId, selectedFileIds.join(","));
      setSummary(res?.data || null);
    } catch (err) {
      console.error("Failed to load case summary:", err);
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [activeCaseId, selectedFileIds]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ------------------------------------------------------------
  // Load Filtered Transactions for Selected File
  // ------------------------------------------------------------
  const loadFilteredTransactions = useCallback(async () => {
    if (!activeCaseId || selectedFileIds.length === 0) {
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(0);
      return;
    }

    try {
      setIsTxLoading(true);
      setTxError("");

      const res = await searchCaseTransactions(activeCaseId, {
        file_ids: selectedFileIds.join(","),
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
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        pageSize: filters.pageSize,
      });

      const list = Array.isArray(res?.data) ? res.data : [];
      setTransactions(list);
      setTotalTransactions(res?.total || 0);
      setTotalPages(res?.total_pages || 0);

      // Update dynamic mode counts directly from search response
      if (res?.mode_counts) {
        const counts = {};
        res.mode_counts.forEach((item) => {
          if (item.mode) counts[item.mode.toUpperCase()] = item.count;
        });
        setDynamicModeCounts(counts);
      } else {
        setDynamicModeCounts({});
      }
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
  }, [activeCaseId, selectedFileIds, filters]);

  useEffect(() => {
    loadFilteredTransactions();
  }, [loadFilteredTransactions]);

  // ------------------------------------------------------------
  // Load Complete Dataset (All Transactions) for Graph View
  // Ensures graph is not limited to page-wise slicing
  // ------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== "graph" || !activeCaseId || selectedFileIds.length === 0) return;

    // If current transactions already contain the complete dataset
    if (totalTransactions > 0 && transactions.length >= totalTransactions) {
      setGraphTransactions(transactions);
      return;
    }

    let isMounted = true;
    async function fetchFullGraphData() {
      try {
        setIsGraphLoading(true);
        const res = await searchCaseTransactions(activeCaseId, {
          file_ids: selectedFileIds.join(","),
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
          sortBy: "transaction_date",
          sortOrder: "asc",
          page: 1,
          pageSize: 10000,
        });

        if (isMounted) {
          const list = Array.isArray(res?.data) ? res.data : [];
          setGraphTransactions(list);
        }
      } catch (err) {
        console.error("Failed to load full graph transactions:", err);
        if (isMounted) {
          setGraphTransactions(transactions);
        }
      } finally {
        if (isMounted) {
          setIsGraphLoading(false);
        }
      }
    }

    fetchFullGraphData();
    return () => {
      isMounted = false;
    };
  }, [
    viewMode,
    activeCaseId,
    selectedFileIds,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
    filters.transactionType,
    filters.minAmount,
    filters.maxAmount,
    filters.channel,
    filters.dayType,
    filters.amountPattern,
    filters.excludeKeyword,
    filters.minBalance,
    filters.maxBalance,
    filters.isLowBalance,
    filters.hasChequeOnly,
    filters.hasReferenceOnly,
    filters.sourcePage,
    totalTransactions,
    transactions,
  ]);

  // ------------------------------------------------------------
  // Dynamic Database-Driven & Data-Driven Transaction Modes
  // ------------------------------------------------------------
  const DEFAULT_DB_MODES = useMemo(
    () => ["UPI", "NEFT", "RTGS", "IMPS", "ATM", "CASH", "CHEQUE", "POS", "NACH", "ECS", "OTHER"],
    []
  );

  const allMasterModes = useMemo(() => {
    if (dbTransactionModes && dbTransactionModes.length > 0) {
      return dbTransactionModes;
    }
    if (summary?.all_db_modes && summary.all_db_modes.length > 0) {
      return summary.all_db_modes;
    }
    return DEFAULT_DB_MODES;
  }, [dbTransactionModes, summary, DEFAULT_DB_MODES]);

  const activeModeCounts = useMemo(() => {
    // If we have dynamic mode counts from a filtered search, use those explicitly.
    // They represent the exact counts for the current filter scope.
    if (Object.keys(dynamicModeCounts).length > 0) {
      return dynamicModeCounts;
    }

    // Fallback: static summary counts (unfiltered file-level counts)
    const counts = {};
    if (Array.isArray(summary?.available_modes)) {
      summary.available_modes.forEach((item) => {
        if (item.mode) counts[item.mode.toUpperCase()] = item.count;
      });
    }
    
    // Fallback: calculate from current paginated chunk if no summary
    if (Object.keys(counts).length === 0 && Array.isArray(transactions)) {
      transactions.forEach((tx) => {
        const m = (tx.mode || "").trim().toUpperCase();
        if (m) counts[m] = (counts[m] || 0) + 1;
      });
    }
    return counts;
  }, [summary, transactions, dynamicModeCounts]);

  const allFilterModes = useMemo(() => {
    const seen = new Set();
    const result = [];

    allMasterModes.forEach((mode) => {
      const upper = mode.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push({
          mode: upper,
          count: activeModeCounts[upper] || 0,
        });
      }
    });

    Object.entries(activeModeCounts).forEach(([mode, count]) => {
      if (!seen.has(mode)) {
        seen.add(mode);
        result.push({ mode, count });
      }
    });

    return result;
  }, [allMasterModes, activeModeCounts]);

  // Alias for backwards compatibility
  const detectedModes = allFilterModes;

  // ------------------------------------------------------------
  // Dynamic Custom Filter Rule Handler
  // ------------------------------------------------------------
  const handleApplyCustomFilter = (e) => {
    e?.preventDefault();
    if (!filterRuleValue && filterRuleOperator !== "has_any") {
      return;
    }

    setFilters((prev) => {
      const next = { ...prev, page: 1 };
      
      if (filterRuleField === "description") {
        if (filterRuleOperator === "contains") {
          next.search = filterRuleValue.trim();
          setSearchInput(filterRuleValue.trim());
        } else if (filterRuleOperator === "not_contains") {
          next.excludeKeyword = next.excludeKeyword 
            ? `${next.excludeKeyword}, ${filterRuleValue.trim()}` 
            : filterRuleValue.trim();
        }
      } else if (filterRuleField === "amount") {
        if (filterRuleOperator === "gt") {
          next.minAmount = filterRuleValue;
        } else if (filterRuleOperator === "lt") {
          next.maxAmount = filterRuleValue;
        } else if (filterRuleOperator === "between") {
          next.minAmount = filterRuleValue;
          next.maxAmount = filterRuleValue2;
        }
      } else if (filterRuleField === "type") {
        next.transactionType = filterRuleValue;
      } else if (filterRuleField === "mode") {
        next.channel = filterRuleValue.trim();
      } else if (filterRuleField === "balance") {
        if (filterRuleOperator === "gt") {
          next.minBalance = filterRuleValue;
        } else if (filterRuleOperator === "lt") {
          next.maxBalance = filterRuleValue;
        }
      } else if (filterRuleField === "cheque") {
        if (filterRuleOperator === "has_any") {
          next.hasChequeOnly = true;
        } else {
          next.search = filterRuleValue.trim();
          setSearchInput(filterRuleValue.trim());
        }
      } else if (filterRuleField === "date") {
        if (filterRuleOperator === "from") {
          next.dateFrom = filterRuleValue;
        } else if (filterRuleOperator === "to") {
          next.dateTo = filterRuleValue;
        } else if (filterRuleOperator === "between") {
          next.dateFrom = filterRuleValue;
          next.dateTo = filterRuleValue2;
        }
      }
      return next;
    });

    setActiveQuickFilter("custom");
    setFilterRuleValue("");
    setFilterRuleValue2("");
    setShowFilterBuilder(false);
  };

  // ------------------------------------------------------------
  // Click-To-Filter Table Cell Handlers
  // ------------------------------------------------------------
  const handleQuickFilterByText = (text) => {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    setSearchInput(clean);
    setFilters((prev) => ({
      ...prev,
      search: clean,
      page: 1,
    }));
    setActiveQuickFilter("custom");
  };

  const handleQuickFilterByMode = (modeName) => {
    if (!modeName || !modeName.trim()) return;
    const clean = modeName.trim().toUpperCase();
    setFilters((prev) => ({
      ...prev,
      channel: prev.channel?.toUpperCase() === clean ? "" : clean,
      page: 1,
    }));
    setActiveQuickFilter("custom");
  };

  const handleQuickFilterByType = (type) => {
    setFilters((prev) => ({
      ...prev,
      transactionType: prev.transactionType === type ? "" : type,
      page: 1,
    }));
    setActiveQuickFilter(type);
  };

  const handleSortColumn = (columnName) => {
    setFilters((prev) => {
      const isSameCol = prev.sortBy === columnName;
      const nextOrder = isSameCol && prev.sortOrder === "asc" ? "desc" : "asc";
      return {
        ...prev,
        sortBy: columnName,
        sortOrder: nextOrder,
        page: 1,
      };
    });
  };

  const handleExport = async () => {
    try {
      Swal.fire({
        title: "Exporting...",
        text: "Generating your CSV export, please wait...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const params = {
        file_ids: selectedFileIds.length > 0 ? selectedFileIds.join(",") : null,
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
        hasChequeOnly: filters.hasChequeOnly,
        hasReferenceOnly: filters.hasReferenceOnly,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };

      const blob = await exportCaseTransactions(activeCaseId, params);
      
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transactions_case_${activeCaseId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      Swal.close();
    } catch (error) {
      console.error("Export failed:", error);
      Swal.fire("Error", "Failed to export data. Please try again.", "error");
    }
  };

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
        channel: "UPI",
        page: 1,
      }));
    } else if (type === "atm") {
      setFilters((prev) => ({
        ...prev,
        channel: "ATM",
        transactionType: "debit",
        page: 1,
      }));
    } else if (type === "cash_deposit") {
      setFilters((prev) => ({
        ...prev,
        channel: "CASH",
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
      `Report_Export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen bg-[#020b09] text-white overflow-x-hidden">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-400/[0.03] blur-3xl" />
        <div className="pointer-events-none absolute top-[600px] right-[-100px] h-[450px] w-[450px] rounded-full bg-violet-400/[0.025] blur-3xl" />
      </div>

      <BASNavbar />

      <main className="mx-auto w-full max-w-[1700px] px-4 py-8 sm:px-8 lg:px-10 pb-16">
        {/* ===================================================
            HEADER & NAVIGATION
        ==================================================== */}
        <div className="flex flex-col gap-4 border-b border-emerald-400/10 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {/* Back & Navigation Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <button
                  type="button"
                  onClick={() => navigate(activeCaseId ? `/dashboard/cases/${activeCaseId}/reports` : "/dashboard/cases")}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 shadow-sm transition hover:bg-emerald-400/20 hover:text-white hover:border-emerald-400/50 active:scale-95 cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Reports Center
                </button>
                {activeCaseId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/cases/${activeCaseId}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-300 shadow-sm transition hover:bg-white/[0.08] hover:text-white hover:border-white/20 active:scale-95 cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Case Details
                  </button>
                )}
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  File Transaction Report
                </h1>
              </div>

              {/* Case Name & IO Name Display (no case_number in frontend) */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {/* Case Name Badge */}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-bold text-emerald-300 shadow-sm">
                  <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-slate-400 font-semibold text-xs">Case:</span>
                  <span>{caseData?.case_name ? caseData.case_name : (activeCaseId ? "Loading..." : "Please Select a Case")}</span>
                </div>

                {/* IO Name Badge */}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm font-bold text-sky-200 shadow-sm">
                  <svg className="h-4 w-4 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-slate-400 font-semibold text-xs">IO:</span>
                  <span>
                    {caseData?.io?.officer_name
                      ? `${caseData.io.officer_name}${caseData.io.designation ? ` (${caseData.io.designation})` : ""}`
                      : "Not Assigned"}
                  </span>
                </div>
              </div>
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

          {/* Quick Case Switcher Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-[#061411]/90 px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="case-select-dropdown" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Select / Switch Case:
              </label>

              <div className="relative min-w-[260px] sm:min-w-[340px]">
                <select
                  id="case-select-dropdown"
                  value={activeCaseId || ""}
                  onChange={(e) => handleSwitchCase(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-emerald-400/30 bg-[#020b09] px-3.5 py-2 pr-9 text-xs font-semibold text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition cursor-pointer"
                >
                  <option value="" disabled>-- Choose a Case --</option>
                  {allCases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#061411] text-white">
                      {c.case_name || "Untitled Case"}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {loadingAllCases && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                  Loading cases...
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400">
              Total Cases: <span className="font-bold text-slate-200">{allCases.length}</span>
            </div>
          </div>
        </div>

        {/* ===================================================
            CASE FILES SELECTOR (Compact scrollable list with Select All)
        ==================================================== */}
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#061411]/80 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  1. Select File(s) from this Case
                </h2>
                <span className="rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {files.length} {files.length === 1 ? "File" : "Files"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select one or more statement files to analyze combined transactions.
              </p>
            </div>

            {/* Quick action buttons & counter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1 hidden sm:inline">
                <span className="font-bold text-emerald-300">{selectedFileIds.length}</span> of {files.length} selected
              </span>

              <button
                type="button"
                onClick={handleSelectAllFiles}
                disabled={files.length === 0 || selectedFileIds.length === files.length}
                className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={handleDeselectAllFiles}
                disabled={selectedFileIds.length === 0}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>

          {isCaseLoading ? (
            <div className="flex items-center gap-3 py-4 text-xs text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Loading case files...
            </div>
          ) : caseError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {caseError}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-white/[0.04] bg-[#020b09] p-5 text-center text-xs text-slate-400">
              No files have been uploaded to this case yet. Please upload bank statements in Case Details first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-h-52 overflow-y-auto pr-1">
              {files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";
                const displayAccountNumber = file.account_number?.toString().trim() || "Account number not available";

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleSelectFile(file.id)}
                    className={`
                      cursor-pointer select-none group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all
                      ${
                        isSelected
                          ? "border-emerald-400/50 bg-emerald-400/[0.09] shadow-[0_2px_12px_rgba(52,211,153,0.12)] ring-1 ring-emerald-400/30"
                          : "border-white/[0.06] bg-[#020b09]/80 hover:border-white/[0.16] hover:bg-white/[0.02]"
                      }
                    `}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`
                        flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                        ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-400 text-black"
                            : "border-slate-600 bg-slate-800/60 group-hover:border-slate-500"
                        }
                      `}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* PDF Icon */}
                    <div
                      className={`
                        flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs
                        ${
                          isSelected
                            ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-300"
                            : "border-white/10 bg-white/[0.04] text-slate-400"
                        }
                      `}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-200" : "text-slate-300 group-hover:text-white"}`}
                        title={`File: ${file.original_filename}`}
                      >
                        {displayAccountNumber}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="truncate max-w-[90px]" title={file.bank_name || file.original_filename}>
                          {file.bank_name || file.original_filename}
                        </span>
                        <span>&bull;</span>
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>&bull;</span>
                        <span
                          className={`
                            px-1.5 py-0.2 rounded font-semibold uppercase text-[9px]
                            ${
                              isCompleted
                                ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/25"
                                : "bg-amber-400/15 text-amber-300 border border-amber-400/25"
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
            EMPTY STATE: NO FILES SELECTED YET
        ==================================================== */}
        {files.length > 0 && selectedFilesData.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-emerald-400/20 bg-[#061411]/60 p-10 text-center shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-bold text-white">
              No Statement File Selected
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto">
              Please click on any statement file above to view its report summary, filtered transactions, and analytics. You can select a single file or multiple files.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFiles}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 transition cursor-pointer"
              >
                Select All {files.length} Files
              </button>
            </div>
          </div>
        )}

        {/* ===================================================
            FILE REPORT SUMMARY CARDS (Enhanced Executive Dashboard)
        ==================================================== */}
        {selectedFilesData.length > 0 && (
          <div className="mt-8 space-y-6">
            {/* Summary Top Banner */}
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-[#061814] via-[#04120e] to-[#020b09] p-6 shadow-xl relative overflow-hidden">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between relative z-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-6 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Executive Report
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-0.5 text-xs font-semibold text-slate-300">
                      {selectedFilesData.length} Selected Statement(s)
                    </span>
                    {isSummaryLoading && (
                      <span className="text-xs text-slate-400 animate-pulse flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                        Updating summary...
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Financial Statement Overview
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Period:{" "}
                      <strong className="text-slate-200 ml-1">
                        {summary?.start_date ? formatDate(summary.start_date) : "N/A"}
                      </strong>{" "}
                      &rarr;{" "}
                      <strong className="text-slate-200">
                        {summary?.end_date ? formatDate(summary.end_date) : "N/A"}
                      </strong>
                    </span>

                    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                      <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Combined Turnover:{" "}
                      <strong className="text-cyan-300 ml-1">
                        {formatCurrency(financialMetrics.totalTurnover)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Progress bar visual for Flow Distribution */}
                <div className="rounded-2xl border border-white/10 bg-[#020b09]/80 p-4 min-w-[280px] sm:min-w-[340px]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Debits: {financialMetrics.debitPercent}%
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Credits: {financialMetrics.creditPercent}%
                    </span>
                  </div>
                  {/* Two-tone bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      style={{ width: `${financialMetrics.debitPercent}%` }}
                      className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500"
                      title={`Debits: ${financialMetrics.debitPercent}%`}
                    />
                    <div
                      style={{ width: `${financialMetrics.creditPercent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                      title={`Credits: ${financialMetrics.creditPercent}%`}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Cashflow Distribution</span>
                    <span className={financialMetrics.isPositive ? "text-emerald-300 font-medium" : "text-rose-300 font-medium"}>
                      {financialMetrics.isPositive ? "Net Positive Inflow" : "Net Outflow Deficit"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Financial Metric Cards with rich design */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Transactions */}
              <div className="group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#081814] to-[#040e0b] p-5 shadow-lg transition hover:border-cyan-400/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Total Transactions
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                  {summary ? summary.total_transactions.toLocaleString() : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Statements verified & analyzed</span>
                </div>
              </div>

              {/* Total Debits (Withdrawals) */}
              <div className="group relative rounded-2xl border border-rose-500/25 bg-gradient-to-b from-[#18080a] to-[#0d0405] p-5 shadow-lg transition hover:border-rose-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Total Debits (Dr)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-400 truncate" title={summary ? formatCurrency(summary.total_debits) : ""}>
                  {summary ? formatCurrency(summary.total_debits) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-300/80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <span>{financialMetrics.debitPercent}% of total movement</span>
                </div>
              </div>

              {/* Total Credits (Deposits) */}
              <div className="group relative rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#081812] to-[#040e0a] p-5 shadow-lg transition hover:border-emerald-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Total Credits (Cr)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-400 truncate" title={summary ? formatCurrency(summary.total_credits) : ""}>
                  {summary ? formatCurrency(summary.total_credits) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300/80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{financialMetrics.creditPercent}% of total movement</span>
                </div>
              </div>

              {/* Net Movement */}
              <div className={`group relative rounded-2xl border p-5 shadow-lg transition ${
                financialMetrics.isPositive
                  ? "border-emerald-500/25 bg-gradient-to-b from-[#081812] to-[#040e0a] hover:border-emerald-500/40"
                  : "border-rose-500/25 bg-gradient-to-b from-[#18080a] to-[#0d0405] hover:border-rose-500/40"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${financialMetrics.isPositive ? "text-emerald-300" : "text-rose-300"}`}>
                    Net Movement
                  </span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    financialMetrics.isPositive
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/15 text-rose-400"
                  }`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {financialMetrics.isPositive ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      )}
                    </svg>
                  </div>
                </div>
                <div className={`mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight truncate ${
                  financialMetrics.isPositive ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {summary ? formatCurrency(financialMetrics.netMovement) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${financialMetrics.isPositive ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <span>{financialMetrics.isPositive ? "Surplus (Inflow > Outflow)" : "Deficit (Outflow > Inflow)"}</span>
                </div>
              </div>
            </div>

            {/* ===================================================
                FILTER CONTROLS (Grid View Only)
            ==================================================== */}
            {viewMode === "grid" && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#061411] p-5 shadow-xl space-y-4">
              {/* PRIMARY SEARCH & QUICK CONTROL BAR */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
                {/* Search Input with Validation */}
                <div className="lg:col-span-6">
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
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Filtered by: &quot;{filters.search}&quot; ({totalTransactions} matches)</span>
                    </p>
                  ) : null}
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
                <div className="lg:col-span-2 flex items-center justify-end">
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

              {/* TRANSACTION MODE / CHANNEL (SINGLE SOURCE OF TRUTH) */}
              <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Transaction Mode / Channel
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {allFilterModes.length} modes active
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={!filters.channel}
                      onChange={() => {
                        setFilters((prev) => ({ ...prev, channel: "", page: 1 }));
                        setActiveQuickFilter("all");
                      }}
                      className="form-checkbox rounded bg-[#020b09] border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-opacity-25 h-3.5 w-3.5"
                    />
                    <span className={!filters.channel ? "text-emerald-400" : "text-slate-400"}>All Modes</span>
                  </label>
                  {allFilterModes.map((item) => {
                    const meta = MODE_METADATA[item.mode] || {
                      label: item.mode,
                      icon: "💳",
                    };
                    const activeChannels = filters.channel ? filters.channel.toUpperCase().split(',') : [];
                    const isSelected = activeChannels.includes(item.mode);
                    return (
                      <label
                        key={item.mode}
                        className={`flex items-center gap-2 cursor-pointer text-xs font-semibold ${
                          isSelected ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
                        }`}
                        title={meta.label}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            let newChannels = [...activeChannels];
                            if (e.target.checked) {
                              newChannels.push(item.mode);
                            } else {
                              newChannels = newChannels.filter(m => m !== item.mode);
                            }
                            setFilters(prev => ({ ...prev, channel: newChannels.join(','), page: 1 }));
                            setActiveQuickFilter("custom");
                          }}
                          className="form-checkbox rounded bg-[#020b09] border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-opacity-25 h-3.5 w-3.5"
                        />
                        <span className="text-[14px] leading-none">{meta.icon}</span>
                        <span>{meta.label}</span>
                        {item.count > 0 && (
                          <span className="ml-1 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                            {item.count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* DYNAMIC DATA-DRIVEN FILTERS & PAGE SIZE ROW */}
              <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Data Filters:
                    </span>

                    {/* All Flow */}
                    <button
                      type="button"
                      onClick={() => applyQuickFilter("all")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        activeQuickFilter === "all" && !filters.transactionType && !filters.channel
                          ? "bg-emerald-400 text-black font-bold shadow"
                          : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      All Flow
                    </button>

                    {/* Debits */}
                    <button
                      type="button"
                      onClick={() => handleQuickFilterByType("debit")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        filters.transactionType === "debit"
                          ? "bg-rose-500 text-white font-bold shadow"
                          : "bg-white/[0.04] text-rose-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      🔴 Debits
                    </button>

                    {/* Credits */}
                    <button
                      type="button"
                      onClick={() => handleQuickFilterByType("credit")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        filters.transactionType === "credit"
                          ? "bg-emerald-400 text-black font-bold shadow"
                          : "bg-white/[0.04] text-emerald-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      🟢 Credits
                    </button>

                    {/* Debit/Credit Sub-Panel */}
                    {filters.transactionType && (
                      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
                        <span className="text-[10px] uppercase text-slate-400 font-semibold">
                          {filters.transactionType === 'debit' ? 'Debit' : 'Credit'} Sort:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFilters(prev => ({
                              ...prev,
                              sortBy: 'amount',
                              sortOrder: 'asc',
                              page: 1
                            }));
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded ${filters.sortBy === 'amount' && filters.sortOrder === 'asc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          Ascending
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilters(prev => ({
                              ...prev,
                              sortBy: 'amount',
                              sortOrder: 'desc',
                              page: 1
                            }));
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded ${filters.sortBy === 'amount' && filters.sortOrder === 'desc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          Descending
                        </button>
                        
                        <div className="relative ml-1">
                          <input
                            type="number"
                            placeholder={`Search ${filters.transactionType} amount...`}
                            value={filters.search}
                            onChange={(e) => {
                              setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
                            }}
                            className="bg-slate-900 border border-slate-700 text-white text-[10px] rounded px-2 py-1 w-32 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                    {/* "+ Add Custom Filter" Button */}
                    <button
                      type="button"
                      onClick={() => setShowFilterBuilder((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition cursor-pointer ml-1 ${
                        showFilterBuilder
                          ? "border-emerald-400 bg-emerald-400 text-black shadow"
                          : "border-dashed border-emerald-400/50 bg-emerald-400/[0.06] text-emerald-300 hover:border-emerald-400 hover:bg-emerald-400/15"
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>+ Custom Filter</span>
                    </button>
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

              {/* EXPANDABLE CUSTOM FILTER BUILDER */}
              {showFilterBuilder && (
                <form
                  onSubmit={handleApplyCustomFilter}
                  className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-[#020b09] p-3.5 shadow-inner"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Custom Filter Rule:
                  </span>

                  {/* Field select */}
                  <select
                    value={filterRuleField}
                    onChange={(e) => {
                      setFilterRuleField(e.target.value);
                      if (e.target.value === "amount" || e.target.value === "balance") {
                        setFilterRuleOperator("gt");
                      } else if (e.target.value === "type") {
                        setFilterRuleOperator("equals");
                        setFilterRuleValue("debit");
                      } else {
                        setFilterRuleOperator("contains");
                      }
                    }}
                    className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="description">Narration / Description</option>
                    <option value="amount">Amount (₹)</option>
                    <option value="type">Transaction Type (Dr/Cr)</option>
                    <option value="mode">Payment Mode / Channel</option>
                    <option value="cheque">Cheque / Ref Number</option>
                    <option value="balance">Post-Tx Balance (₹)</option>
                    <option value="date">Date</option>
                  </select>

                  {/* Operator select */}
                  {filterRuleField === "description" && (
                    <select
                      value={filterRuleOperator}
                      onChange={(e) => setFilterRuleOperator(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="contains">Contains Keyword</option>
                      <option value="not_contains">Exclude Keyword</option>
                    </select>
                  )}

                  {(filterRuleField === "amount" || filterRuleField === "balance") && (
                    <select
                      value={filterRuleOperator}
                      onChange={(e) => setFilterRuleOperator(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="gt">Greater Than (&gt;=)</option>
                      <option value="lt">Less Than (&lt;=)</option>
                      {filterRuleField === "amount" && <option value="between">Between (Min - Max)</option>}
                    </select>
                  )}

                  {filterRuleField === "type" && (
                    <select
                      value={filterRuleValue}
                      onChange={(e) => setFilterRuleValue(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="debit">🔴 Debits Only</option>
                      <option value="credit">🟢 Credits Only</option>
                    </select>
                  )}

                  {filterRuleField === "mode" && (
                    <select
                      value={filterRuleValue}
                      onChange={(e) => setFilterRuleValue(e.target.value)}
                      className="w-56 rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Transaction Mode --</option>
                      {allFilterModes.map((item) => (
                        <option key={item.mode} value={item.mode}>
                          {item.mode} {item.count ? `(${item.count})` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  {filterRuleField === "cheque" && (
                    <select
                      value={filterRuleOperator}
                      onChange={(e) => setFilterRuleOperator(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="has_any">Has Cheque / Ref Number</option>
                      <option value="contains">Matches Number</option>
                    </select>
                  )}

                  {filterRuleField === "date" && (
                    <select
                      value={filterRuleOperator}
                      onChange={(e) => setFilterRuleOperator(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="from">From Date (&gt;=)</option>
                      <option value="to">To Date (&lt;=)</option>
                      <option value="between">Date Range (Between)</option>
                    </select>
                  )}

                  {/* Value Inputs */}
                  {filterRuleField === "description" && (
                    <input
                      type="text"
                      placeholder="e.g. SALARY, RAMESH, AMAZON"
                      value={filterRuleValue}
                      onChange={(e) => setFilterRuleValue(e.target.value)}
                      className="w-52 rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                      autoFocus
                    />
                  )}

                  {(filterRuleField === "amount" || filterRuleField === "balance") && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder={filterRuleOperator === "between" ? "Min ₹" : "Amount ₹"}
                        value={filterRuleValue}
                        onChange={(e) => setFilterRuleValue(e.target.value)}
                        className="w-28 rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                      />
                      {filterRuleOperator === "between" && (
                        <>
                          <span className="text-slate-400 text-xs">to</span>
                          <input
                            type="number"
                            placeholder="Max ₹"
                            value={filterRuleValue2}
                            onChange={(e) => setFilterRuleValue2(e.target.value)}
                            className="w-28 rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {filterRuleField === "cheque" && filterRuleOperator === "contains" && (
                    <input
                      type="text"
                      placeholder="Cheque or UTR string"
                      value={filterRuleValue}
                      onChange={(e) => setFilterRuleValue(e.target.value)}
                      className="w-44 rounded-lg border border-white/10 bg-[#061411] px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  )}

                  {filterRuleField === "date" && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={filterRuleValue}
                        onChange={(e) => setFilterRuleValue(e.target.value)}
                        className="rounded-lg border border-white/10 bg-[#061411] px-2 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                      />
                      {filterRuleOperator === "between" && (
                        <>
                          <span className="text-slate-400 text-xs">to</span>
                          <input
                            type="date"
                            value={filterRuleValue2}
                            onChange={(e) => setFilterRuleValue2(e.target.value)}
                            className="rounded-lg border border-white/10 bg-[#061411] px-2 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Apply & Cancel */}
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-300 shadow cursor-pointer"
                  >
                    Apply Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilterBuilder(false)}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

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
                  <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>Showing {transactions.length} of {totalTransactions} filtered transactions</span>
                    {selectedFileIds.length > 1 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-400/10 border border-cyan-400/25 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                        📁 Across {selectedFileIds.length} Statement Files
                      </span>
                    )}
                  </p>
                </div>

                {/* View Switcher: Grid View vs Graph View */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20"
                    title="Export Current Filtered Data to CSV"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
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

              {txError && (
                <div className="mx-6 my-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{txError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadFilteredTransactions()}
                    className="rounded-lg bg-rose-500/20 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {viewMode === "graph" ? (
                <div className="p-6">
                  {isGraphLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                      <p className="text-xs text-slate-400">Loading complete statement dataset for graph ({totalTransactions} transactions)...</p>
                    </div>
                  ) : (
                    <TransactionGraphView
                      transactions={graphTransactions.length > 0 ? graphTransactions : transactions}
                      summary={summary}
                      totalCount={totalTransactions}
                      formatDate={formatDate}
                      files={files}
                      selectedFileIds={selectedFileIds}
                    />
                  )}
                </div>
              ) : (
                <>
                  {selectedFileIds.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 border-b border-white/[0.06] bg-black/40 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>Statement Legend:</span>
                      </span>
                      {selectedFileIds.map((fid) => {
                        const f = fileMap.get(String(fid));
                        if (!f) return null;
                        const col = getFileColor(fid);
                        return (
                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${col.badge}`}
                            title={`File: ${f.original_filename}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                            <span className="truncate max-w-[170px]">{f.account_number?.toString().trim() || "Account number not available"}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                          <th className="py-3.5 px-4">#</th>
                          {selectedFileIds.length > 1 && (
                            <th className="py-3.5 px-4 whitespace-nowrap text-cyan-300">
                              Statement File
                            </th>
                          )}
                          <th
                            onClick={() => handleSortColumn("transaction_date")}
                            className="py-3.5 px-4 whitespace-nowrap cursor-pointer hover:text-emerald-300 transition"
                            title="Click to sort by date"
                          >
                            Date {filters.sortBy === "transaction_date" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Account Name</th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Account Number</th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Mode</th>
                          <th
                            onClick={() => handleSortColumn("description")}
                            className="py-3.5 px-4 min-w-[280px] cursor-pointer hover:text-emerald-300 transition"
                            title="Click to sort by description"
                          >
                            Narration / Description {filters.sortBy === "description" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th
                            onClick={() => handleSortColumn("debit")}
                            className="py-3.5 px-4 text-right whitespace-nowrap text-rose-400 cursor-pointer hover:text-rose-300 transition"
                            title="Click to sort by debit amount"
                          >
                            Debit (Dr) {filters.sortBy === "debit" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th
                            onClick={() => handleSortColumn("credit")}
                            className="py-3.5 px-4 text-right whitespace-nowrap text-emerald-400 cursor-pointer hover:text-emerald-300 transition"
                            title="Click to sort by credit amount"
                          >
                            Credit (Cr) {filters.sortBy === "credit" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th
                            onClick={() => handleSortColumn("balance")}
                            className="py-3.5 px-4 text-right whitespace-nowrap cursor-pointer hover:text-emerald-300 transition"
                            title="Click to sort by balance"
                          >
                            Balance {filters.sortBy === "balance" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {isTxLoading ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                                <p className="text-xs text-slate-400">Loading filtered transactions...</p>
                              </div>
                            </td>
                          </tr>
                        ) : selectedFileIds.length === 0 ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center text-slate-400">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] text-slate-500 mb-3">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </div>
                              <h4 className="text-sm font-semibold text-white">No Statement Selected</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Please select one or more statement files from above to view the transactions grid.
                              </p>
                            </td>
                          </tr>
                        ) : transactions.length === 0 ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] text-slate-500 mb-3">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <h4 className="text-sm font-semibold text-white">No Matching Transactions</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                No transactions match your active filters. Try adjusting your search keyword, dates, mode, or amount ranges.
                              </p>
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
                              >
                                Clear Filters
                              </button>
                            </td>
                          </tr>
                        ) : (
                          transactions.map((tx, idx) => {
                            const rowNumber = (filters.page - 1) * filters.pageSize + idx + 1;
                            return (
                              <tr key={tx.id || idx} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                                  {rowNumber}
                                </td>
                                {selectedFileIds.length > 1 && (
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {(() => {
                                      const fileMatch = fileMap.get(String(tx.file_id));
                                      const fName = (fileMatch?.account_number ? String(fileMatch.account_number).trim() : null) || fileMatch?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "-");
                                      const col = getFileColor(tx.file_id);

                                      return (
                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${col.badge} max-w-[190px]`}
                                          title={`Statement: ${fName}`}
                                        >
                                          <span className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
                                          <span className="truncate">{fName}</span>
                                        </span>
                                      );
                                    })()}
                                  </td>
                                )}
                              <td className="py-3.5 px-4 font-mono whitespace-nowrap text-slate-200">
                                {formatDate(tx.transaction_date)}
                              </td>
                              <td className="py-3.5 px-4 text-slate-200 whitespace-nowrap">
                                {tx.account_name ? (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickFilterByText(tx.account_name)}
                                    className="hover:text-emerald-300 hover:underline transition text-left cursor-pointer"
                                    title="Click to filter by this account"
                                  >
                                    {tx.account_name}
                                  </button>
                                ) : "-"}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                {tx.account_number || "-"}
                              </td>
                              <td className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                {tx.mode ? (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickFilterByMode(tx.mode)}
                                    className="inline-flex rounded bg-white/[0.04] px-1.5 py-0.5 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-400 transition cursor-pointer"
                                    title={`Click to filter by mode: ${tx.mode}`}
                                  >
                                    {tx.mode}
                                  </button>
                                ) : "-"}
                              </td>
                              <td className="py-3.5 px-4 text-slate-200 break-words leading-relaxed max-w-md">
                                <span
                                  onClick={() => handleQuickFilterByText(tx.description || tx.raw_narration)}
                                  className="cursor-pointer hover:text-emerald-300 transition-colors"
                                  title="Click to search / filter by this narration"
                                >
                                  {tx.description || tx.raw_narration || "-"}
                                </span>
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
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

              {/* Pagination - Tabular Grid View Only */}
              {viewMode === "grid" && totalPages > 1 && (
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
    </div>
  );
}

export default CaseFileReport;
