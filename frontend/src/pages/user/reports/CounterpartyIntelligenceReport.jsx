import React, { useState, useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import {
  getCounterpartyAnalysis,
  searchCaseTransactions,
} from "../../../services/api/bankTransaction";

// ============================================================
// FORMATTERS & HELPERS
// ============================================================

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[3].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[1]}`;
  }
  const parts = str.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || "KB"}`;
}

function getDisplayAccountNumber(file) {
  if (file?.account_number && String(file.account_number).trim()) {
    return String(file.account_number).trim();
  }
  const match = String(file?.original_filename || "").match(
    /(?:Merged_Statement_|Statement_)?(\d{9,18})/i
  );
  if (match && match[1]) return match[1];
  return file?.original_filename || "Unknown Account";
}

// ============================================================
// MAIN COMPONENT: CounterpartyIntelligenceReport
// ============================================================

export default function CounterpartyIntelligenceReport() {
  const { caseId: routeCaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramCaseId = searchParams.get("caseId") || routeCaseId;
  const paramFileId = searchParams.get("fileId");

  // Cases State
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");
  const [isLoadingCases, setIsLoadingCases] = useState(false);

  // Files State & Dropdown
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const accountDropdownRef = useRef(null);

  // Analysis State
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);

  // Table filter & sort
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState("tx-desc");

  // Selected Counterparty Drilldown State
  const [selectedCounterpartyName, setSelectedCounterpartyName] = useState("");
  const [cpTransactions, setCpTransactions] = useState([]);
  const [isLoadingCpTx, setIsLoadingCpTx] = useState(false);
  const [cpPage, setCpPage] = useState(1);
  const [cpTotalPages, setCpTotalPages] = useState(0);

  // Chart ref
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Race-condition safety refs
  const analysisReqIdRef = useRef(0);
  const cpTxReqIdRef = useRef(0);

  // ------------------------------------------------------------
  // CLOSE ACCOUNT DROPDOWN ON OUTSIDE CLICK OR ESCAPE
  // ------------------------------------------------------------
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target)
      ) {
        setIsAccountDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ------------------------------------------------------------
  // 1. FETCH CASES ON MOUNT
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setCases(list);

        if (paramCaseId && list.some((c) => String(c.id) === String(paramCaseId))) {
          setSelectedCaseId(String(paramCaseId));
        } else if (list.length > 0 && !selectedCaseId) {
          setSelectedCaseId(String(list[0].id));
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
        setError("Failed to load cases.");
      } finally {
        setIsLoadingCases(false);
      }
    }
    loadCases();
  }, [paramCaseId]);

  // ------------------------------------------------------------
  // 2. FETCH FILES WHEN CASE CHANGES
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setAnalysisData(null);
      setSelectedCounterpartyName("");
      setCpTransactions([]);
      setError(null);
      return;
    }

    // Reset previous case's data immediately
    setFiles([]);
    setSelectedFileIds([]);
    setAnalysisData(null);
    setSelectedCounterpartyName("");
    setCpTransactions([]);
    setError(null);

    async function loadFiles() {
      setIsLoadingFiles(true);
      try {
        const res = await getCaseFiles(selectedCaseId);
        const rawFiles = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        const activeFiles = rawFiles.filter((f) => !f.is_superseded);
        setFiles(activeFiles);

        if (
          paramFileId &&
          activeFiles.some((f) => String(f.id) === String(paramFileId))
        ) {
          setSelectedFileIds([Number(paramFileId)]);
        } else if (activeFiles.length > 0) {
          // Select all active files in this case by default
          setSelectedFileIds(activeFiles.map((f) => f.id));
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
        setError("Failed to load statement files for this case.");
      } finally {
        setIsLoadingFiles(false);
      }
    }

    loadFiles();
  }, [selectedCaseId, paramFileId]);

  // ------------------------------------------------------------
  // 3. FETCH COUNTERPARTY ANALYSIS WHEN SELECTION CHANGES
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.length === 0) {
      setAnalysisData(null);
      setSelectedCounterpartyName("");
      setCpTransactions([]);
      return;
    }

    // Discard any open drill-down when selection changes
    setSelectedCounterpartyName("");
    setCpTransactions([]);

    const reqId = ++analysisReqIdRef.current;
    setIsLoadingAnalysis(true);
    setError(null);

    async function fetchAnalysis() {
      try {
        const res = await getCounterpartyAnalysis(selectedCaseId, selectedFileIds);

        if (reqId !== analysisReqIdRef.current) return;

        if (res?.success && res?.data) {
          setAnalysisData(res.data);
        } else if (res?.data) {
          setAnalysisData(res.data);
        } else {
          setError(res?.message || "Failed to fetch counterparty analysis.");
          setAnalysisData(null);
        }
      } catch (err) {
        if (reqId !== analysisReqIdRef.current) return;
        console.error("Analysis error:", err);
        setError(
          err?.response?.data?.detail ||
            "Error loading counterparty analysis for selected accounts."
        );
        setAnalysisData(null);
      } finally {
        if (reqId === analysisReqIdRef.current) {
          setIsLoadingAnalysis(false);
        }
      }
    }

    fetchAnalysis();
  }, [selectedCaseId, selectedFileIds]);

  // ------------------------------------------------------------
  // 4. FETCH TRANSACTIONS FOR SELECTED COUNTERPARTY DRILL-DOWN
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.length === 0 || !selectedCounterpartyName) {
      setCpTransactions([]);
      setCpTotalPages(0);
      return;
    }

    const txReqId = ++cpTxReqIdRef.current;
    setIsLoadingCpTx(true);

    async function loadTransactions() {
      try {
        const res = await searchCaseTransactions(selectedCaseId, {
          file_ids: selectedFileIds.join(","),
          counterparty_name: selectedCounterpartyName,
          page: cpPage,
          pageSize: 20,
        });

        if (txReqId !== cpTxReqIdRef.current) return;

        if (res?.data) {
          setCpTransactions(res.data);
          setCpTotalPages(Number(res.total_pages) || 0);
        } else {
          setCpTransactions([]);
          setCpTotalPages(0);
        }
      } catch (err) {
        if (txReqId !== cpTxReqIdRef.current) return;
        console.error("Failed to fetch counterparty transactions:", err);
        setCpTransactions([]);
        setCpTotalPages(0);
      } finally {
        if (txReqId === cpTxReqIdRef.current) {
          setIsLoadingCpTx(false);
        }
      }
    }

    loadTransactions();
  }, [selectedCounterpartyName, selectedFileIds, selectedCaseId, cpPage]);

  // ------------------------------------------------------------
  // FILE SELECTION HANDLERS
  // ------------------------------------------------------------
  const handleFileToggle = (fileId) => {
    setSelectedFileIds((prev) => {
      const exists = prev.includes(fileId);
      if (exists) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
  };

  const handleSelectAllFiles = () => {
    setSelectedFileIds(files.map((f) => f.id));
  };

  const handleClearFiles = () => {
    setSelectedFileIds([]);
    setAnalysisData(null);
    setSelectedCounterpartyName("");
    setCpTransactions([]);
  };

  // Filter files by search within dropdown
  const filteredFiles = useMemo(() => {
    if (!accountSearch.trim()) return files;
    const query = accountSearch.toLowerCase().trim();
    return files.filter((f) => {
      const acc = getDisplayAccountNumber(f).toLowerCase();
      const bank = String(f.bank_name || "").toLowerCase();
      const orig = String(f.original_filename || "").toLowerCase();
      return acc.includes(query) || bank.includes(query) || orig.includes(query);
    });
  }, [files, accountSearch]);

  const isAllSelected =
    files.length > 0 && selectedFileIds.length === files.length;

  const currentCase = useMemo(() => {
    return cases.find((c) => String(c.id) === String(selectedCaseId));
  }, [cases, selectedCaseId]);

  // Summary & Counterparties data
  const isMultiFile = analysisData?.mode === "multiple";
  const summary = analysisData?.summary || {};
  const counterparties = analysisData?.counterparties || [];

  // Filtered and sorted counterparties for the table
  const processedCounterparties = useMemo(() => {
    let list = [...counterparties];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((cp) => {
        const name = String(cp.counterparty_name || "").toLowerCase();
        const type = String(cp.counterparty_type || "").toLowerCase();
        return name.includes(q) || type.includes(q);
      });
    }

    list.sort((a, b) => {
      if (tableSort === "tx-desc") return b.total_transactions - a.total_transactions;
      if (tableSort === "debit-desc") return (b.total_debit || 0) - (a.total_debit || 0);
      if (tableSort === "credit-desc") return (b.total_credit || 0) - (a.total_credit || 0);
      if (tableSort === "value-desc") return (b.total_value || 0) - (a.total_value || 0);
      if (tableSort === "name-asc") return String(a.counterparty_name).localeCompare(String(b.counterparty_name));
      return 0;
    });

    return list;
  }, [counterparties, tableSearch, tableSort]);

  // ------------------------------------------------------------
  // ECHARTS BAR CHART (LIGHT THEME)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!chartRef.current) return;

    if (!analysisData || counterparties.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    let chartData = [];
    let seriesName = "";
    let valueField = "";

    if (isMultiFile) {
      // Common counterparties appearing in multiple statements
      const commonCp = counterparties.filter((c) => c.file_count >= 2);
      const targetList = commonCp.length >= 3 ? commonCp : counterparties;
      chartData = [...targetList]
        .sort((a, b) => b.total_transactions - a.total_transactions)
        .slice(0, 10);
      seriesName = "Transactions";
      valueField = "total_transactions";
    } else {
      chartData = [...counterparties]
        .sort((a, b) => b.total_transactions - a.total_transactions)
        .slice(0, 10);
      seriesName = "Transactions";
      valueField = "total_transactions";
    }

    const categories = chartData.map((c) => c.counterparty_name).reverse();
    const values = chartData.map((c) => c[valueField]).reverse();

    const option = {
      backgroundColor: "#FFFFFF",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#FFFFFF",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: "#172554",
          fontSize: 12,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        extraCssText: "box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12); border-radius: 12px;",
        formatter: (params) => {
          if (!params || !params[0]) return "";
          const item = chartData.find(
            (c) => c.counterparty_name === params[0].name
          );
          if (!item) return `${params[0].name}: ${params[0].value}`;
          return `
            <div style="font-size: 12px; min-width: 180px;">
              <div style="font-weight: 800; color: #172554; margin-bottom: 4px;">
                ${item.counterparty_name}
              </div>
              <div style="color: #64748B; font-size: 11px; margin-bottom: 6px;">
                ${item.counterparty_type || "Counterparty"}
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span style="color: #64748B;">Transactions:</span>
                <span style="font-weight: 700; color: #172554;">${item.total_transactions}</span>
              </div>
              ${
                isMultiFile
                  ? `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                      <span style="color: #64748B;">Statements:</span>
                      <span style="font-weight: 700; color: #0891B2;">${item.file_count}</span>
                    </div>`
                  : ""
              }
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span style="color: #64748B;">Total Debit:</span>
                <span style="font-weight: 700; color: #E11D48;">${formatCurrency(item.total_debit)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748B;">Total Credit:</span>
                <span style="font-weight: 700; color: #059669;">${formatCurrency(item.total_credit)}</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: "3%",
        right: "5%",
        top: "4%",
        bottom: "4%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        splitLine: { lineStyle: { color: "#F1F5F9" } },
        axisLabel: {
          color: "#64748B",
          fontSize: 11,
          formatter: (v) => v.toLocaleString("en-IN"),
        },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#172554",
          fontSize: 11,
          fontWeight: 600,
          formatter: (val) => (val.length > 22 ? `${val.slice(0, 20)}...` : val),
        },
      },
      series: [
        {
          name: seriesName,
          type: "bar",
          data: values,
          barMaxWidth: 24,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: "#059669" },
              { offset: 1, color: "#34D399" },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
          label: {
            show: true,
            position: "right",
            color: "#172554",
            fontSize: 11,
            fontWeight: 700,
            formatter: "{c}",
          },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [analysisData, counterparties, isMultiFile]);

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const topActive = useMemo(() => {
    if (!counterparties || counterparties.length === 0) return null;
    return [...counterparties].sort(
      (a, b) => b.total_transactions - a.total_transactions
    )[0];
  }, [counterparties]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col font-sans relative">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="absolute right-0 top-20 h-[450px] w-[450px] rounded-full bg-blue-200/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(226, 232, 240, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.8) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <BASNavbar />

      <main className="relative z-10 flex-1 w-full max-w-[1700px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* ======================================================
            HEADER & NAVIGATION
        ====================================================== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/80 pb-6">
          <div>
            {/* Back & Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    selectedCaseId
                      ? `/dashboard/cases/${selectedCaseId}/reports`
                      : "/dashboard/cases"
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-300 active:scale-95 cursor-pointer"
              >
                <svg
                  className="h-4 w-4 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Reports Center
              </button>

              {selectedCaseId && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/cases/${selectedCaseId}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-900 hover:border-blue-300 active:scale-95 cursor-pointer"
                >
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Case Details
                </button>
              )}
            </div>

            {/* Eyebrow & Title */}
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#059669]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                BANKING ANALYTICAL SYSTEM
              </span>
              <span className="h-3 w-px bg-slate-300" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                COUNTERPARTY INTELLIGENCE
              </span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
              Counterparty Intelligence{" "}
              <span className="text-[#059669]">Report</span>
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-3xl">
              Analyze counterparty activity, transaction patterns, and financial exposure across selected bank accounts.
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs">
              <svg
                className="h-4 w-4 text-emerald-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span className="text-emerald-700 font-semibold text-[11px] uppercase tracking-wider">
                Case:
              </span>
              <span className="text-[#172554]">
                {currentCase?.case_name || (selectedCaseId ? `Case #${selectedCaseId}` : "None Selected")}
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-bold text-blue-900 shadow-2xs">
              <svg
                className="h-4 w-4 text-blue-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="text-blue-700 font-semibold text-[11px] uppercase tracking-wider">
                Statements:
              </span>
              <span className="text-[#172554]">
                {selectedFileIds.length} of {files.length} selected
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================
            CONTROLS SECTION: CASE SELECTOR & ACCOUNT DROPDOWN
        ====================================================== */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. SELECT CASE */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                1. Select Case
              </label>
              {isLoadingCases ? (
                <div className="flex items-center gap-2 py-2 text-xs font-semibold text-emerald-700">
                  <span className="w-4 h-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span>Loading cases...</span>
                </div>
              ) : (
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition outline-none cursor-pointer shadow-2xs"
                >
                  <option value="" disabled>
                    -- Select a Case --
                  </option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_name || `Case #${c.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 2. SELECT ACCOUNTS DROPDOWN */}
            <div className="md:col-span-2 relative" ref={accountDropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  2. Select Bank Accounts ({selectedFileIds.length} selected)
                </label>

                {files.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiles}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">&bull;</span>
                    <button
                      type="button"
                      onClick={handleClearFiles}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown Button (Closed State) */}
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                disabled={!selectedCaseId || files.length === 0}
                className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 shadow-2xs cursor-pointer ${
                  isAccountDropdownOpen
                    ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-white text-emerald-900"
                    : selectedFileIds.length > 0
                    ? "border-emerald-300 bg-emerald-50/50 text-emerald-900 hover:border-emerald-400"
                    : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2 truncate">
                  <svg
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  <span className="truncate">
                    {isLoadingFiles
                      ? "Loading statement files..."
                      : files.length === 0
                      ? "No Accounts Available"
                      : `Select Accounts (${selectedFileIds.length} of ${files.length} selected)`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedFileIds.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200 px-1 text-[10px] font-extrabold text-emerald-800">
                      {selectedFileIds.length}
                    </span>
                  )}
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                      isAccountDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Dropdown Menu Popover (Open State) */}
              {isAccountDropdownOpen && (
                <div className="absolute left-0 mt-2 z-50 w-full sm:w-[440px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#172554] tracking-wide">
                        Select Bank Accounts
                      </span>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {files.length} {files.length === 1 ? "account" : "accounts"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      {selectedFileIds.length} / {files.length}
                    </span>
                  </div>

                  {/* Search Input */}
                  <div className="mb-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        placeholder="Search by account number or bank..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                      <svg
                        className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                      {accountSearch && (
                        <button
                          type="button"
                          onClick={() => setAccountSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Select All Quick Row */}
                  {files.length > 0 && (
                    <div className="px-1 py-1 mb-1.5 border-b border-slate-100 pb-2">
                      <div
                        className="flex items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 cursor-pointer select-none transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAllSelected) {
                            handleClearFiles();
                          } else {
                            handleSelectAllFiles();
                          }
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-[#059669] focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            Select All Accounts
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {isAllSelected ? "All selected" : `${files.length} available`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Account List */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {filteredFiles.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        {accountSearch ? "No matching accounts found." : "No accounts available."}
                      </div>
                    ) : (
                      filteredFiles.map((file) => {
                        const isSelected = selectedFileIds.includes(file.id);
                        const isCompleted =
                          String(file.status || "").toUpperCase() === "COMPLETED";
                        const isFailed =
                          String(file.status || "").toUpperCase() === "FAILED";
                        const displayAccountNumber = getDisplayAccountNumber(file);

                        return (
                          <div
                            key={file.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileToggle(file.id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleFileToggle(file.id);
                              }
                            }}
                            className={`flex items-center justify-between gap-2.5 rounded-xl border px-2.5 py-2 cursor-pointer select-none transition-all ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium"
                                : "border-slate-100 bg-slate-50/60 text-slate-700 hover:border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 accent-[#059669] focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className="text-xs font-bold truncate text-[#172554]"
                                  title={`Account: ${displayAccountNumber}`}
                                >
                                  {displayAccountNumber}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 truncate font-medium">
                                  <span
                                    className="truncate max-w-[130px]"
                                    title={file.bank_name || file.original_filename}
                                  >
                                    {file.bank_name || "Bank Statement"}
                                  </span>
                                  <span>&bull;</span>
                                  <span>{formatFileSize(file.file_size)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 pl-1 flex items-center gap-1">
                              {file.is_merged && (
                                <span className="px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider border bg-teal-50 text-teal-800 border-teal-200">
                                  MERGED
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider border ${
                                  isCompleted
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isFailed
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                              >
                                {file.status || "READY"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Popover Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2 px-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearFiles();
                      }}
                      disabled={selectedFileIds.length === 0}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Clear All
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAccountDropdownOpen(false);
                      }}
                      className="rounded-xl bg-[#059669] hover:bg-[#047857] px-4 py-1.5 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================
            ERROR STATE
        ====================================================== */}
        {error && (
          <div className="mb-8 bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 shadow-xs">
            <svg
              className="w-5 h-5 text-rose-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ======================================================
            LOADING STATE
        ====================================================== */}
        {isLoadingAnalysis ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <span className="w-6 h-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
            <h3 className="text-sm font-bold text-[#172554] mb-1">
              Analyzing Counterparties...
            </h3>
            <p className="text-xs text-slate-500">
              Aggregating counterparty volume, transacting accounts, and flows for {selectedFileIds.length} statement{selectedFileIds.length === 1 ? "" : "s"}.
            </p>
          </div>
        ) : analysisData ? (
          <>
            {/* ======================================================
                KPI METRIC CARDS
            ====================================================== */}
            <div
              className={`grid gap-4 mb-8 ${
                isMultiFile
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              }`}
            >
              {/* SELECTED STATEMENTS (IF MULTI) */}
              {isMultiFile && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                    Selected Accounts
                  </span>
                  <span className="text-2xl font-extrabold text-[#172554]">
                    {summary.selected_statements || selectedFileIds.length}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Statements in scope
                  </span>
                </div>
              )}

              {/* TOTAL TRANSACTIONS */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                  Total Transactions
                </span>
                <span className="text-2xl font-extrabold text-[#172554]">
                  {Number(summary.total_transactions || 0).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Across selected files
                </span>
              </div>

              {/* UNIQUE COUNTERPARTIES */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">
                  Unique Counterparties
                </span>
                <span className="text-2xl font-extrabold text-[#059669]">
                  {Number(summary.unique_counterparties || 0).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Distinct transacting entities
                </span>
              </div>

              {/* COMMON COUNTERPARTIES (IF MULTI) */}
              {isMultiFile && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                  <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider mb-1">
                    Common Counterparties
                  </span>
                  <span className="text-2xl font-extrabold text-sky-700">
                    {Number(summary.common_counterparties || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {summary.common_to_all || 0} in all statements
                  </span>
                </div>
              )}

              {/* TOTAL DEBIT */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1">
                  <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Total Debit</span>
                </div>
                <span
                  className="text-xl sm:text-2xl font-extrabold text-rose-600 truncate"
                  title={formatCurrency(summary.total_debit)}
                >
                  {formatCurrency(summary.total_debit)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Paid to counterparties
                </span>
              </div>

              {/* TOTAL CREDIT */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">
                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span>Total Credit</span>
                </div>
                <span
                  className="text-xl sm:text-2xl font-extrabold text-emerald-700 truncate"
                  title={formatCurrency(summary.total_credit)}
                >
                  {formatCurrency(summary.total_credit)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Received from counterparties
                </span>
              </div>

              {/* MOST ACTIVE (IF SINGLE) */}
              {!isMultiFile && topActive && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-1">
                    Most Active Entity
                  </span>
                  <span
                    className="text-sm font-extrabold text-[#172554] truncate"
                    title={topActive.counterparty_name}
                  >
                    {topActive.counterparty_name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {topActive.total_transactions} transactions
                  </span>
                </div>
              )}
            </div>

            {/* ======================================================
                TOP COUNTERPARTIES CHART CARD
            ====================================================== */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#172554] tracking-tight">
                    {isMultiFile
                      ? "Top Counterparties Across Statements"
                      : "Top Counterparties by Transactions"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isMultiFile
                      ? "Entities with highest transaction volume across selected account statements."
                      : "Entities ranked by transaction frequency in the selected account."}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                  Top 10 Entities
                </span>
              </div>

              <div ref={chartRef} style={{ width: "100%", height: "340px" }} />
            </div>

            {/* ======================================================
                COUNTERPARTIES SUMMARY TABLE CARD
            ====================================================== */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#172554] tracking-tight">
                    {isMultiFile ? "Common Counterparties Directory" : "Counterparty Transaction Summary"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any counterparty row to inspect granular statement transactions below.
                  </p>
                </div>

                {/* Filter and Sort Controls */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-60">
                    <input
                      type="text"
                      placeholder="Search counterparties..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                    <svg
                      className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                  </div>

                  {/* Sort Select */}
                  <select
                    value={tableSort}
                    onChange={(e) => setTableSort(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="tx-desc">Most Transactions</option>
                    <option value="value-desc">Highest Total Value</option>
                    <option value="debit-desc">Highest Debit</option>
                    <option value="credit-desc">Highest Credit</option>
                    <option value="name-asc">Name (A–Z)</option>
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold">Counterparty</th>
                      {isMultiFile && <th className="px-4 py-3 font-bold">Statements</th>}
                      {isMultiFile && <th className="px-4 py-3 font-bold text-center">Stmt Count</th>}
                      <th className="px-4 py-3 font-bold text-right">Transactions</th>
                      <th className="px-4 py-3 font-bold text-right">Total Debit</th>
                      <th className="px-4 py-3 font-bold text-right">Total Credit</th>
                      <th className="px-4 py-3 font-bold text-right">Total Value</th>
                      <th className="px-4 py-3 font-bold text-right">First Tx</th>
                      <th className="px-4 py-3 font-bold text-right">Last Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedCounterparties.map((cp, idx) => {
                      const isSelected = selectedCounterpartyName === cp.counterparty_name;
                      return (
                        <tr
                          key={idx}
                          onClick={() => {
                            setSelectedCounterpartyName(
                              isSelected ? "" : cp.counterparty_name
                            );
                            setCpPage(1);
                          }}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? "bg-emerald-50/80 font-semibold"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="px-4 py-3.5 whitespace-nowrap font-bold text-[#172554] flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                            />
                            <span>{cp.counterparty_name}</span>
                          </td>

                          {isMultiFile && (
                            <td
                              className="px-4 py-3.5 max-w-[200px] truncate text-slate-500 font-medium"
                              title={cp.files_list?.map((f) => f.file_name).join(", ")}
                            >
                              {cp.files_list?.map((f) => f.file_name).join(", ") || "-"}
                            </td>
                          )}

                          {isMultiFile && (
                            <td className="px-4 py-3.5 text-center font-bold text-[#0891B2]">
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200">
                                {cp.file_count}
                              </span>
                            </td>
                          )}

                          <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                            {cp.total_transactions}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-rose-600">
                            {formatCurrency(cp.total_debit)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                            {formatCurrency(cp.total_credit)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                            {formatCurrency(cp.total_value)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-500 font-medium">
                            {formatDate(cp.first_transaction)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-500 font-medium">
                            {formatDate(cp.last_transaction)}
                          </td>
                        </tr>
                      );
                    })}

                    {processedCounterparties.length === 0 && (
                      <tr>
                        <td
                          colSpan={isMultiFile ? 9 : 7}
                          className="text-center py-10 text-slate-400"
                        >
                          No matching counterparties found for the selected criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======================================================
                COUNTERPARTY × STATEMENT MATRIX (MULTI-FILE ONLY)
            ====================================================== */}
            {isMultiFile && counterparties.length > 0 && Array.isArray(analysisData.files_meta) && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
                <div className="mb-4">
                  <h2 className="text-sm sm:text-base font-extrabold text-[#172554] tracking-tight">
                    Counterparty × Statement Matrix (Tx Count)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Breakdown of transaction frequencies per counterparty across selected account statements.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-bold">Counterparty</th>
                        {analysisData.files_meta.map((f) => (
                          <th
                            key={f.id}
                            className="px-4 py-3 font-bold text-center truncate max-w-[150px]"
                            title={f.name}
                          >
                            {f.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 font-bold text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {counterparties.slice(0, 50).map((cp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-[#172554]">
                            {cp.counterparty_name}
                          </td>
                          {analysisData.files_meta.map((f) => {
                            const fData = cp.files ? cp.files[f.id] : null;
                            return (
                              <td key={f.id} className="px-4 py-3 text-center">
                                {fData ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60">
                                    {fData.transaction_count}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center font-extrabold text-[#172554]">
                            {cp.total_transactions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================
                COUNTERPARTY TRANSACTION DRILL-DOWN CARD
            ====================================================== */}
            {selectedCounterpartyName && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-[#172554]">
                        Transactions for Counterparty:{" "}
                        <span className="text-[#059669]">{selectedCounterpartyName}</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Granular records filtered strictly across selected account statements.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCounterpartyName("")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
                  >
                    <span>Close Drilldown</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {isLoadingCpTx ? (
                  <div className="p-8 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                    <span className="w-4 h-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    <span>Loading counterparty transactions...</span>
                  </div>
                ) : cpTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No transactions found for this counterparty in the selected accounts.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-bold">Date</th>
                            <th className="px-4 py-3 font-bold">Description</th>
                            <th className="px-4 py-3 font-bold">Mode</th>
                            <th className="px-4 py-3 font-bold text-right">Debit</th>
                            <th className="px-4 py-3 font-bold text-right">Credit</th>
                            <th className="px-4 py-3 font-bold text-right">Balance</th>
                            <th className="px-4 py-3 font-bold">Counterparty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cpTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                                {formatDate(tx.transaction_date)}
                              </td>
                              <td
                                className="px-4 py-3 max-w-[280px] truncate font-medium text-slate-800"
                                title={tx.description || tx.raw_narration}
                              >
                                {tx.description || tx.raw_narration}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700 text-[10px]">
                                  {tx.mode || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-600">
                                {tx.debit ? formatCurrency(tx.debit) : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                {tx.credit ? formatCurrency(tx.credit) : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {tx.balance !== undefined && tx.balance !== null
                                  ? formatCurrency(tx.balance)
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-bold text-emerald-700">
                                {tx.counterparty_name}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {cpTotalPages > 1 && (
                      <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
                        <button
                          type="button"
                          disabled={cpPage === 1}
                          onClick={() => setCpPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="font-semibold text-slate-500">
                          Page <span className="font-bold text-[#172554]">{cpPage}</span> of{" "}
                          <span className="font-bold text-[#172554]">{cpTotalPages}</span>
                        </span>
                        <button
                          type="button"
                          disabled={cpPage === cpTotalPages}
                          onClick={() => setCpPage((p) => Math.min(cpTotalPages, p + 1))}
                          className="px-3 py-1.5 font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          /* ======================================================
              INITIAL / EMPTY STATE
          ====================================================== */
          <div className="h-[400px] border-2 border-dashed border-slate-200 bg-white/80 rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>

            <h3 className="text-base font-extrabold text-[#172554] mb-1">
              Select Statement Accounts to Generate Counterparty Intelligence
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6">
              Please choose a case and select one or more bank accounts from the dropdown above to view aggregated counterparty analysis.
            </p>

            {files.length > 0 && selectedFileIds.length === 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiles}
                className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                Select All {files.length} Available Accounts
              </button>
            )}
          </div>
        )}
      </main>

      <UserFooter />
    </div>
  );
}
