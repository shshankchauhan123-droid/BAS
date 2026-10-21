import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import {
  getCaseModeWise,
  searchCaseTransactions,
  getCaseTransactionSummary,
} from "../../../services/api/bankTransaction";
import { formatFinancialValue } from "../../../utils/chartFormatter";

function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Robust helper to extract display bank account number from file object
 * Prioritizes file.account_number, then regex matches from filename, then fallback
 */
function getDisplayAccountNumber(file) {
  if (file?.account_number && String(file.account_number).trim()) {
    return String(file.account_number).trim();
  }
  const filename = String(file?.original_filename || "");
  const match = filename.match(/(?:Merged_Statement_|Statement_)?(\d{9,18})/i);
  if (match && match[1]) {
    return match[1];
  }
  return file?.original_filename || `Account ${file?.id || ""}`;
}

/**
 * Robust helper to format secondary bank name and filename subtitle
 */
function getDisplayBankSubtitle(file) {
  const parts = [];
  if (file?.bank_name && String(file.bank_name).trim()) {
    parts.push(String(file.bank_name).trim());
  }
  if (file?.original_filename) {
    parts.push(file.original_filename);
  }
  return parts.length > 0 ? parts.join(" • ") : "Bank Statement";
}

/**
 * Interactive Vertical Bar Chart for Transaction Modes
 * Upgraded to ARTHBODH Light Theme with ECharts custom tooltip, responsive resize,
 * click-to-filter interaction, and entrance animations.
 */
function DynamicModeWiseChart({ data, isLoading, totalTransactions, onBarClick }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const options = useMemo(() => {
    if (!data || data.length === 0) return null;

    const modes = data.map((d) => d.mode);
    const txCounts = data.map((d) => d.transaction_count);
    const maxTx = Math.max(...txCounts, 1);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(15, 23, 42, 0.04)",
          },
        },
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [12, 14],
        textStyle: {
          color: "#1e293b",
          fontFamily: "inherit",
        },
        extraCssText:
          "box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06); border-radius: 14px; border: 1px solid #e2e8f0;",
        formatter: (params) => {
          const idx = params[0].dataIndex;
          const d = data[idx];

          return `
            <div style="font-weight: 800; color: #172554; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="color: #64748b; font-weight: 600;">Transaction Mode:</span>
              <span style="color: #059669; font-weight: 800; background: #ecfdf5; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">${d.mode}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 12px; line-height: 1.4;">
              <span style="color: #64748b;">Total Transactions:</span>
              <span style="color: #172554; font-weight: 700; text-align: right;">${Number(d.transaction_count).toLocaleString("en-IN")}</span>
              
              <span style="color: #64748b;">Debit Count:</span>
              <span style="color: #e11d48; font-weight: 700; text-align: right;">${Number(d.debit_count).toLocaleString("en-IN")}</span>
              
              <span style="color: #64748b;">Credit Count:</span>
              <span style="color: #059669; font-weight: 700; text-align: right;">${Number(d.credit_count).toLocaleString("en-IN")}</span>
              
              <span style="color: #64748b;">Total Debit:</span>
              <span style="color: #e11d48; font-weight: 700; text-align: right;">${formatCurrency(d.debit_amount)}</span>
              
              <span style="color: #64748b;">Total Credit:</span>
              <span style="color: #059669; font-weight: 700; text-align: right;">${formatCurrency(d.credit_amount)}</span>
            </div>
          `;
        },
      },
      grid: {
        top: 45,
        right: 30,
        bottom: 55,
        left: 60,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        name: "Transaction Mode / Channel",
        nameLocation: "middle",
        nameGap: 36,
        nameTextStyle: {
          color: "#64748B",
          fontSize: 12,
          fontWeight: "700",
        },
        data: modes,
        axisLine: {
          lineStyle: { color: "#CBD5E1" },
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: { color: "#CBD5E1" },
        },
        axisLabel: {
          color: "#475569",
          fontSize: 11,
          fontWeight: "600",
        },
      },
      yAxis: {
        type: "value",
        name: "Total Transactions",
        nameTextStyle: {
          color: "#172554",
          fontSize: 12,
          fontWeight: "700",
          padding: [0, 0, 10, 0],
        },
        splitLine: {
          lineStyle: {
            color: "#F1F5F9",
            type: "dashed",
          },
        },
        axisLabel: {
          color: "#64748B",
          fontSize: 11,
          formatter: (val) => formatFinancialValue(val),
        },
      },
      series: [
        {
          name: "Transactions",
          type: "bar",
          data: txCounts,
          barWidth: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#059669" },
              { offset: 1, color: "rgba(16, 185, 129, 0.25)" },
            ]),
            borderRadius: [6, 6, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: "#047857",
              shadowBlur: 8,
              shadowColor: "rgba(5, 150, 105, 0.25)",
            },
          },
          z: 2,
        },
        {
          name: "HitArea",
          type: "bar",
          data: txCounts.map(() => maxTx),
          barWidth: "80%",
          barGap: "-125%",
          itemStyle: {
            color: "transparent",
          },
          tooltip: {
            show: false,
          },
          z: 10,
        },
      ],
    };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    if (options) {
      chartInstance.current.setOption(options, true);
    } else {
      chartInstance.current.clear();
    }

    // Add click event listener
    chartInstance.current.off("click");
    chartInstance.current.on("click", function (params) {
      if (
        params.componentType === "series" &&
        params.seriesType === "bar" &&
        onBarClick
      ) {
        onBarClick(params.name); // params.name is the mode name
      }
    });

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [options, onBarClick]);

  return (
    <div className="arthbodh-card-elevate relative w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Chart Title Header */}
      <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-extrabold text-[#172554] sm:text-lg">
            Total Transactions by Mode
          </h2>
          <p className="text-xs text-slate-500">
            Click on any bar to inspect underlying transactions below.
          </p>
        </div>

        {/* Total Transactions Top Right Overlay */}
        {!isLoading && totalTransactions > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-1.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
              Total Transactions
            </span>
            <span className="font-mono text-xl font-black text-[#172554]">
              {Number(totalTransactions).toLocaleString("en-IN")}
            </span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-emerald-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-xs font-bold text-slate-700">
              Loading Mode-Wise Chart...
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div
        ref={chartRef}
        style={{
          width: "100%",
          height: "440px",
          opacity: isLoading ? 0.3 : 1,
        }}
      />
    </div>
  );
}

export default function DynamicReportDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const paramFileId = searchParams.get("fileId");

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");

  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());

  // Dropdown & Search state
  const [accountSearch, setAccountSearch] = useState("");
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);

  // Request sequence counter refs to discard stale async responses
  const modeReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);
  const txReqIdRef = useRef(0);
  const initialUrlFileProcessedRef = useRef(false);

  const [modeData, setModeData] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingModeWise, setIsLoadingModeWise] = useState(false);
  const [error, setError] = useState("");

  const [selectedMode, setSelectedMode] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(0);
  const [transactionTotal, setTransactionTotal] = useState(0);

  // Close account dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target)
      ) {
        setIsAccountDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsAccountDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Filtered files based on account search (account number, bank, or filename)
  const filteredFiles = useMemo(() => {
    if (!accountSearch.trim()) return files;
    const q = accountSearch.trim().toLowerCase();
    return files.filter((f) => {
      const accNum = getDisplayAccountNumber(f).toLowerCase();
      const bankName = String(f.bank_name || "").toLowerCase();
      const filename = String(f.original_filename || "").toLowerCase();
      return accNum.includes(q) || bankName.includes(q) || filename.includes(q);
    });
  }, [files, accountSearch]);

  // 1. Fetch Cases on mount
  useEffect(() => {
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const res = await getCases();
        if (res?.data) {
          setCases(res.data);
          if (
            paramCaseId &&
            res.data.some((c) => c.id.toString() === paramCaseId.toString())
          ) {
            setSelectedCaseId(paramCaseId.toString());
          } else if (res.data.length > 0 && !selectedCaseId) {
            setSelectedCaseId(res.data[0].id.toString());
          }
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

  // Handle case switching cleanly: reset previous case state & increment sequence counters
  const handleCaseSelect = (newCaseId) => {
    setSelectedCaseId(newCaseId);
    setFiles([]);
    setSelectedFileIds(new Set());
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    setAccountSearch("");
    setIsAccountDropdownOpen(false);
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;
  };

  // 2. Fetch Files when Case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds(new Set());
      setModeData([]);
      setTotalTransactions(0);
      setSummaryData(null);
      return;
    }

    async function loadFiles() {
      setIsLoadingFiles(true);
      try {
        const res = await getCaseFiles(selectedCaseId);
        if (res?.data) {
          const activeFiles = (res.data || []).filter((f) => !f.is_superseded);
          setFiles(activeFiles);
          if (
            paramFileId &&
            !initialUrlFileProcessedRef.current &&
            activeFiles.some((f) => String(f.id) === String(paramFileId))
          ) {
            initialUrlFileProcessedRef.current = true;
            setSelectedFileIds(new Set([String(paramFileId)]));
          } else {
            // By default select all active files
            const allIds = new Set(activeFiles.map((f) => String(f.id)));
            setSelectedFileIds(allIds);
          }
        } else {
          setFiles([]);
          setSelectedFileIds(new Set());
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds(new Set());
      } finally {
        setIsLoadingFiles(false);
      }
    }

    loadFiles();
  }, [selectedCaseId]);

  // 3. Fetch Mode-Wise Data and Summary when File Selection Changes
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.size === 0) {
      modeReqIdRef.current++;
      summaryReqIdRef.current++;
      setModeData([]);
      setTotalTransactions(0);
      setSummaryData(null);
      setIsLoadingModeWise(false);
      setIsLoadingSummary(false);
      return;
    }

    const currentModeReqId = ++modeReqIdRef.current;
    const currentSummaryReqId = ++summaryReqIdRef.current;

    async function fetchModeWise() {
      setIsLoadingModeWise(true);
      setError("");
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCaseModeWise(selectedCaseId, fileIdsArray);
        if (currentModeReqId === modeReqIdRef.current) {
          if (res?.success) {
            setModeData(res.data || []);
            setTotalTransactions(res.total_transactions || 0);
          } else {
            setError(res?.message || "Failed to fetch mode-wise data.");
          }
        }
      } catch (err) {
        if (currentModeReqId === modeReqIdRef.current) {
          console.error("Mode-wise error:", err);
          setError("Error fetching mode-wise data.");
        }
      } finally {
        if (currentModeReqId === modeReqIdRef.current) {
          setIsLoadingModeWise(false);
        }
      }
    }

    async function fetchSummary() {
      setIsLoadingSummary(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCaseTransactionSummary(
          selectedCaseId,
          fileIdsArray.join(",")
        );
        if (currentSummaryReqId === summaryReqIdRef.current) {
          if (res?.success) {
            setSummaryData(res.data);
          } else {
            setSummaryData(null);
          }
        }
      } catch (err) {
        if (currentSummaryReqId === summaryReqIdRef.current) {
          console.error("Summary error:", err);
          setSummaryData(null);
        }
      } finally {
        if (currentSummaryReqId === summaryReqIdRef.current) {
          setIsLoadingSummary(false);
        }
      }
    }

    fetchModeWise();
    fetchSummary();
  }, [selectedCaseId, selectedFileIds]);

  // 4. Load transactions when selected mode changes
  useEffect(() => {
    if (!selectedMode || selectedFileIds.size === 0 || !selectedCaseId) {
      txReqIdRef.current++;
      setTransactions([]);
      setTransactionTotalPages(0);
      setTransactionTotal(0);
      setIsTransactionsLoading(false);
      return;
    }

    const currentTxReqId = ++txReqIdRef.current;

    async function loadTransactions() {
      setIsTransactionsLoading(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await searchCaseTransactions(selectedCaseId, {
          file_ids: fileIdsArray.join(","),
          channel: selectedMode,
          page: transactionPage,
          pageSize: 20,
        });
        if (currentTxReqId === txReqIdRef.current) {
          if (res?.data) {
            setTransactions(res.data);
            setTransactionTotalPages(Number(res.total_pages) || 0);
            setTransactionTotal(Number(res.total) || 0);
          } else {
            setTransactions([]);
            setTransactionTotalPages(0);
            setTransactionTotal(0);
          }
        }
      } catch (err) {
        if (currentTxReqId === txReqIdRef.current) {
          console.error("Failed to fetch mode transactions:", err);
          setTransactions([]);
        }
      } finally {
        if (currentTxReqId === txReqIdRef.current) {
          setIsTransactionsLoading(false);
        }
      }
    }

    loadTransactions();
  }, [selectedMode, selectedFileIds, selectedCaseId, transactionPage]);

  // 5. Mode KPIs
  const modeKPIs = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        highestDebit: 0,
        highestCredit: 0,
        mostActiveDate: null,
        mostActiveDateCount: 0,
        averageValue: 0,
      };
    }

    let highestDebit = 0;
    let highestCredit = 0;
    let totalValue = 0;
    let validTxCount = 0;

    const dateCounts = {};

    transactions.forEach((tx) => {
      const debit = parseFloat(tx.debit);
      const credit = parseFloat(tx.credit);

      let hasValidAmount = false;

      if (!isNaN(debit) && debit > 0) {
        if (debit > highestDebit) highestDebit = debit;
        totalValue += debit;
        hasValidAmount = true;
      } else if (!isNaN(credit) && credit > 0) {
        if (credit > highestCredit) highestCredit = credit;
        totalValue += credit;
        hasValidAmount = true;
      }

      if (hasValidAmount) {
        validTxCount++;
      }

      if (tx.transaction_date) {
        dateCounts[tx.transaction_date] =
          (dateCounts[tx.transaction_date] || 0) + 1;
      }
    });

    let mostActiveDate = null;
    let mostActiveDateCount = 0;

    for (const [date, count] of Object.entries(dateCounts)) {
      if (count > mostActiveDateCount) {
        mostActiveDateCount = count;
        mostActiveDate = date;
      } else if (count === mostActiveDateCount) {
        // choose the most recent date if tie
        if (new Date(date) > new Date(mostActiveDate)) {
          mostActiveDate = date;
        }
      }
    }

    const averageValue = validTxCount > 0 ? totalValue / validTxCount : 0;

    return {
      highestDebit,
      highestCredit,
      mostActiveDate,
      mostActiveDateCount,
      averageValue,
    };
  }, [transactions]);

  const handleBarClick = (mode) => {
    setSelectedMode(mode);
    setTransactionPage(1);
    // Smooth scroll down to table
    setTimeout(() => {
      document
        .getElementById("transactions-grid")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleFileToggle = (fileId) => {
    const strId = String(fileId);
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) {
        next.delete(strId);
      } else {
        next.add(strId);
      }
      if (next.size === 0) {
        setModeData([]);
        setTotalTransactions(0);
        setSummaryData(null);
        setSelectedMode("");
        setTransactions([]);
        setTransactionTotal(0);
        setTransactionTotalPages(0);
        modeReqIdRef.current++;
        summaryReqIdRef.current++;
        txReqIdRef.current++;
      }
      return next;
    });
  };

  const handleSelectAllFiles = () => {
    setSelectedFileIds(new Set(files.map((f) => String(f.id))));
  };

  const handleClearFiles = () => {
    setSelectedFileIds(new Set());
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;
  };

  return (
    <div className="arthbodh-user-dashboard relative min-h-screen bg-[#F5F8FC] text-[#172033] flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900 font-sans">
      {/* SCOPED STYLES & ELEGANT ANIMATIONS */}
      <style>{`
        @keyframes arthbodhFadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .arthbodh-user-dashboard {
          background-color: #F5F8FC;
          color: #172033;
        }

        .arthbodh-animate-entrance {
          animation: arthbodhFadeInUp 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .arthbodh-stagger-1 { animation-delay: 40ms; }
        .arthbodh-stagger-2 { animation-delay: 80ms; }
        .arthbodh-stagger-3 { animation-delay: 120ms; }
        .arthbodh-stagger-4 { animation-delay: 160ms; }
        .arthbodh-stagger-5 { animation-delay: 200ms; }

        .arthbodh-card-elevate {
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease;
        }

        .arthbodh-card-elevate:hover {
          transform: translateY(-2.5px);
          box-shadow: 0 12px 24px -6px rgba(23, 37, 84, 0.08), 0 4px 8px -4px rgba(23, 37, 84, 0.04);
        }

        @media (prefers-reduced-motion: reduce) {
          .arthbodh-animate-entrance,
          .arthbodh-card-elevate,
          .arthbodh-card-elevate:hover {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* AMBIENT BACKGROUND GLOW & RESTRAINED GRID */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-[450px] w-[450px] rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-[400px] w-[400px] rounded-full bg-teal-100/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(226, 232, 240, 0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <BASNavbar />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* =========================================================
            REPORT HEADER & MOST ACTIVE DATE SUMMARY
        ========================================================== */}
        <div className="arthbodh-animate-entrance flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group mt-1"
              title="Return to previous screen"
            >
              <svg
                className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Back</span>
            </button>

            <div>
              {/* Brand Tag */}
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Banking Analytical System
                </span>
                <span className="h-3 w-px bg-slate-300" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Channel Intelligence
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
                Transaction Mode Wise{" "}
                <span className="text-[#059669]">Report</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
                Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.
              </p>
            </div>
          </div>

          {/* Most Active Date Header Card */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-[220px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Most Active Date
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Peak Day
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-10 w-28 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#172554] tracking-tight">
                  {summaryData?.most_active_date
                    ? new Date(summaryData.most_active_date)
                        .toLocaleDateString("en-GB")
                        .replace(/\//g, "-")
                    : "No Data"}
                </div>
                {summaryData?.most_active_date && (
                  <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {Number(summaryData.most_active_date_count).toLocaleString("en-IN")}{" "}
                    Transactions
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            CONTROLS SECTION: CASE & FILE SELECTOR
        ========================================================== */}
        <div className="arthbodh-animate-entrance arthbodh-stagger-1 grid grid-cols-1 md:grid-cols-3 gap-4 relative z-30">
          {/* Case Selector */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-600"
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
                1. Select Case
              </h2>
              {isLoadingCases ? (
                <div className="text-xs font-semibold text-emerald-600 animate-pulse py-2">
                  Loading cases...
                </div>
              ) : (
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all cursor-pointer"
                >
                  <option value="" disabled>
                    -- Select a Case --
                  </option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedCaseId && cases.find((c) => String(c.id) === String(selectedCaseId)) && (
              <div className="mt-2 text-[11px] text-slate-500 font-medium truncate">
                Active: <span className="font-bold text-[#172554]">{cases.find((c) => String(c.id) === String(selectedCaseId))?.case_name}</span>
              </div>
            )}
          </div>

          {/* Account / File Selector */}
          <div 
            ref={accountDropdownRef}
            className="arthbodh-card-elevate relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:col-span-2 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-emerald-600"
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
                  2. Select Bank Accounts
                </h2>
                {files.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedFileIds.size} of {files.length} active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiles}
                  disabled={files.length === 0}
                  className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Select all accounts"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={handleClearFiles}
                  disabled={selectedFileIds.size === 0}
                  className="text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Deselect all accounts"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Dropdown Toggle Button */}
            <div className="relative">
              <button
                type="button"
                id="account-select-dropdown-button"
                onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                disabled={!selectedCaseId || isLoadingFiles || files.length === 0}
                className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs ${
                  isAccountDropdownOpen
                    ? "border-emerald-500 bg-white text-emerald-900 ring-2 ring-emerald-500/20"
                    : selectedFileIds.size > 0
                    ? "border-emerald-300 bg-emerald-50/50 text-[#172554] hover:border-emerald-400 hover:bg-emerald-50/80"
                    : "border-slate-300 bg-slate-50/70 text-slate-600 hover:bg-slate-100/70"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
                    selectedFileIds.size > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200/70 text-slate-500"
                  }`}>
                    <svg
                      className="w-3.5 h-3.5"
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
                  </div>
                  <span className="truncate font-bold">
                    {isLoadingFiles
                      ? "Loading statement accounts..."
                      : files.length === 0
                      ? "No accounts available"
                      : selectedFileIds.size === 0
                      ? "Select Accounts (0 selected)"
                      : selectedFileIds.size === files.length
                      ? `All Accounts Selected (${files.length})`
                      : `Select Accounts (${selectedFileIds.size} of ${files.length} selected)`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedFileIds.size > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                      {selectedFileIds.size}
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isAccountDropdownOpen ? "rotate-180 text-emerald-600" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Dropdown Menu Popup */}
              {isAccountDropdownOpen && (
                <div
                  className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl shadow-slate-900/10"
                  style={{ minWidth: "100%" }}
                >
                  {/* Dropdown Header with Search */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5 px-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#172554] tracking-wide">
                        Bank Accounts
                      </span>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {files.length} {files.length === 1 ? "account" : "accounts"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="text-emerald-700">
                        {selectedFileIds.size} selected
                      </span>
                    </div>
                  </div>

                  {/* Search Bar & Quick Toggles */}
                  <div className="space-y-2 mb-2.5">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <svg
                          className="h-3.5 w-3.5"
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
                      <input
                        type="text"
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        placeholder="Search account number, bank, or filename..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {accountSearch && (
                        <button
                          type="button"
                          onClick={() => setAccountSearch("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-1 text-[11px]">
                      <span className="text-slate-500 font-medium">
                        Showing {filteredFiles.length} of {files.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllFiles}
                          className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">&bull;</span>
                        <button
                          type="button"
                          onClick={handleClearFiles}
                          className="font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Accounts List */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {filteredFiles.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 font-medium">
                        {accountSearch ? `No accounts found matching "${accountSearch}"` : "No accounts available"}
                      </div>
                    ) : (
                      filteredFiles.map((f) => {
                        const isChecked = selectedFileIds.has(String(f.id));
                        const accNumber = getDisplayAccountNumber(f);
                        const bankSubtitle = getDisplayBankSubtitle(f);
                        const isMerged = Boolean(
                          f.is_merged ||
                          String(f.original_filename || "").toLowerCase().startsWith("merged_statement")
                        );
                        const statusUpper = String(f.status || "").toUpperCase();

                        return (
                          <div
                            key={f.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileToggle(f.id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleFileToggle(f.id);
                              }
                            }}
                            className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isChecked
                                ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs"
                                : "hover:bg-slate-50/90 border-slate-100 bg-white text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileToggle(f.id);
                                }}
                                onChange={() => {}}
                                className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 accent-[#059669] focus:ring-emerald-500 cursor-pointer"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-[#172554] tracking-tight">
                                    {accNumber}
                                  </span>
                                  {isMerged && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                      MERGED
                                    </span>
                                  )}
                                  {statusUpper === "COMPLETED" && !isMerged && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                                      COMPLETED
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="text-[10px] text-slate-500 truncate mt-0.5"
                                  title={bankSubtitle}
                                >
                                  {bankSubtitle}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick subtitle below dropdown */}
            {selectedFileIds.size > 0 && (
              <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span className="font-medium">
                  {selectedFileIds.size === files.length
                    ? "Analyzing all accounts in this case"
                    : `Filtered to ${selectedFileIds.size} of ${files.length} accounts`}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                  Live Analytics Active
                </span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            FIVE PRIMARY KPI CARDS
        ========================================================== */}
        <div className="arthbodh-animate-entrance arthbodh-stagger-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Total Debit Amount */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Debit Amount
              </h3>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200/80">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 tracking-tight">
                  ₹{" "}
                  {summaryData?.total_debits
                    ? Number(summaryData.total_debits).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-1">
                  Total fund withdrawals
                </div>
              </div>
            )}
          </div>

          {/* 2. Total Credit Amount */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Credit Amount
              </h3>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 tracking-tight">
                  ₹{" "}
                  {summaryData?.total_credits
                    ? Number(summaryData.total_credits).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-1">
                  Total fund deposits
                </div>
              </div>
            )}
          </div>

          {/* 3. Debit Transactions */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Debit Transactions
              </h3>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-[#172554] tracking-tight">
                  {summaryData?.debit_transactions
                    ? Number(summaryData.debit_transactions).toLocaleString("en-IN")
                    : "0"}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-1">
                  Debit transaction volume
                </div>
              </div>
            )}
          </div>

          {/* 4. Credit Transactions */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Credit Transactions
              </h3>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 border border-teal-200/80">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-[#172554] tracking-tight">
                  {summaryData?.credit_transactions
                    ? Number(summaryData.credit_transactions).toLocaleString("en-IN")
                    : "0"}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-1">
                  Credit transaction volume
                </div>
              </div>
            )}
          </div>

          {/* 5. Most Active Date */}
          <div className="arthbodh-card-elevate rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Most Active Date
              </h3>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/80">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
            </div>
            {isLoadingSummary ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <div>
                <div className="text-xl sm:text-2xl font-black text-[#172554] tracking-tight">
                  {summaryData?.most_active_date
                    ? new Date(summaryData.most_active_date)
                        .toLocaleDateString("en-GB")
                        .replace(/\//g, "-")
                    : "No Data"}
                </div>
                {summaryData?.most_active_date ? (
                  <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                    {Number(summaryData.most_active_date_count).toLocaleString("en-IN")}{" "}
                    Transactions
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-slate-400 mt-1">
                    Awaiting statement data
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            VERTICAL BAR CHART SECTION
        ========================================================== */}
        <div className="arthbodh-animate-entrance arthbodh-stagger-3 mt-4">
          {!isLoadingModeWise && modeData.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200/80">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#172554] mb-1">
                No Transaction Mode Data Available
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                {selectedFileIds.size === 0
                  ? "Select at least one bank account above to generate the Transaction Mode Wise Report."
                  : "No transactions found for the selected bank accounts."}
              </p>
            </div>
          )}

          {(modeData.length > 0 || isLoadingModeWise) && (
            <DynamicModeWiseChart
              data={modeData}
              isLoading={isLoadingModeWise}
              totalTransactions={totalTransactions}
              onBarClick={handleBarClick}
            />
          )}

          {/* =======================================================
              TRANSACTIONS GRID FOR CLICKED MODE
          ======================================================== */}
          {selectedMode && (
            <div
              id="transactions-grid"
              className="arthbodh-animate-entrance arthbodh-stagger-4 mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-extrabold text-[#172554] flex items-center gap-2">
                    <span>Transactions for Mode:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {selectedMode}
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    Total: {Number(transactionTotal).toLocaleString("en-IN")}
                  </span>
                  <button
                    onClick={() => setSelectedMode("")}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Dismiss table view"
                  >
                    Close &times;
                  </button>
                </div>
              </div>

              {/* Mode Specific KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Highest Debit */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Highest Debit Amount
                  </h3>
                  <div className="text-xl font-black font-mono text-rose-600">
                    ₹{" "}
                    {modeKPIs.highestDebit
                      ? Number(modeKPIs.highestDebit).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </div>
                </div>

                {/* Highest Credit */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Highest Credit Amount
                  </h3>
                  <div className="text-xl font-black font-mono text-emerald-600">
                    ₹{" "}
                    {modeKPIs.highestCredit
                      ? Number(modeKPIs.highestCredit).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </div>
                </div>

                {/* Most Active Date for this mode */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Most Active Date
                  </h3>
                  <div>
                    <div className="text-xl font-black text-[#172554]">
                      {modeKPIs.mostActiveDate
                        ? new Date(modeKPIs.mostActiveDate)
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")
                        : "No Data"}
                    </div>
                    {modeKPIs.mostActiveDate && (
                      <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {Number(modeKPIs.mostActiveDateCount).toLocaleString("en-IN")}{" "}
                        Transactions
                      </div>
                    )}
                  </div>
                </div>

                {/* Average Value */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Average Transaction Value
                  </h3>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    ₹{" "}
                    {modeKPIs.averageValue
                      ? Number(modeKPIs.averageValue).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </div>
                </div>
              </div>

              {isTransactionsLoading ? (
                <div className="p-12 text-center text-xs font-bold text-slate-500 animate-pulse">
                  Loading transactions for {selectedMode}...
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center text-xs font-semibold text-slate-400">
                  No transactions found for this mode.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 custom-scrollbar">
                    <table className="w-full text-left text-xs sm:text-sm text-slate-700">
                      <thead className="text-[11px] font-bold text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Account Name</th>
                          <th className="px-4 py-3">Account Number</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-right">Debit</th>
                          <th className="px-4 py-3 text-right">Credit</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">
                              {tx.transaction_date}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                              {tx.account_name || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">
                              {tx.account_number || "-"}
                            </td>
                            <td
                              className="px-4 py-3 max-w-[300px] truncate text-slate-700"
                              title={tx.description}
                            >
                              {tx.description}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              {tx.debit
                                ? Number(tx.debit).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {tx.credit
                                ? Number(tx.credit).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-[#172554] whitespace-nowrap">
                              {tx.balance
                                ? Number(tx.balance).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {transactionTotalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        disabled={transactionPage === 1}
                        onClick={() =>
                          setTransactionPage((p) => Math.max(1, p - 1))
                        }
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                      >
                        &larr; Previous
                      </button>
                      <span className="text-xs font-semibold text-slate-600">
                        Page{" "}
                        <span className="font-extrabold text-[#172554]">
                          {transactionPage}
                        </span>{" "}
                        of{" "}
                        <span className="font-extrabold text-[#172554]">
                          {transactionTotalPages}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={transactionPage === transactionTotalPages}
                        onClick={() =>
                          setTransactionPage((p) =>
                            Math.min(transactionTotalPages, p + 1)
                          )
                        }
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 text-center p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm font-semibold shadow-2xs">
              {error}
            </div>
          )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}

// Export named chart component as well in case external modules import it
export { DynamicModeWiseChart };
