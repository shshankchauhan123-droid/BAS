import React, { useRef, useState, useEffect, useMemo } from "react";
import html2pdf from "html2pdf.js";
import Swal from "sweetalert2";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getFinancialAnalysis } from "../../../services/api/bankTransaction";
import { formatFinancialValue } from "../../../utils/chartFormatter";

// ============================================================
// FORMATTERS & HELPERS
// ============================================================

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const formatAmt = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "-";
  return `₹${Number(val).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
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
// MAIN COMPONENT: FinancialTransactionIntelligenceReport
// ============================================================

export default function FinancialTransactionIntelligenceReport() {
  const { caseId: routeCaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramCaseId = searchParams.get("caseId") || routeCaseId;
  const paramFileId = searchParams.get("fileId");

  // Cases State
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");
  const [isLoadingCases, setIsLoadingCases] = useState(false);

  // Files & Account Dropdown State
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const accountDropdownRef = useRef(null);

  // Analysis State
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);

  // Filtering
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    transactionType: "",
    minAmount: "",
    maxAmount: "",
    channel: "",
  });

  // Chart DOM refs
  const distChartRef = useRef(null);
  const dailyChartRef = useRef(null);
  const monthlyChartRef = useRef(null);
  const balanceChartRef = useRef(null);

  // Chart instances
  const distInstance = useRef(null);
  const dailyInstance = useRef(null);
  const monthlyInstance = useRef(null);
  const balanceInstance = useRef(null);

  // PDF Export State
  const [isExporting, setIsExporting] = useState(false);

  // Race-condition safety ref
  const analysisReqIdRef = useRef(0);

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
    async function fetchCases() {
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
      } finally {
        setIsLoadingCases(false);
      }
    }

    fetchCases();
  }, [paramCaseId]);

  // ------------------------------------------------------------
  // 2. FETCH FILES WHEN CASE CHANGES
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setAnalysisData(null);
      setError(null);
      return;
    }

    // Reset previous case's data immediately
    setFiles([]);
    setSelectedFileIds([]);
    setAnalysisData(null);
    setError(null);

    async function fetchFiles() {
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
          // Select all files by default for comprehensive intelligence
          setSelectedFileIds(activeFiles.map((f) => f.id));
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
        setError("Failed to load statements for this case.");
      } finally {
        setIsLoadingFiles(false);
      }
    }

    fetchFiles();
  }, [selectedCaseId, paramFileId]);

  // ------------------------------------------------------------
  // 3. FETCH FINANCIAL ANALYSIS
  // ------------------------------------------------------------
  const fetchAnalysis = async (fileIdsOverride = null) => {
    const activeFileIds = fileIdsOverride !== null ? fileIdsOverride : selectedFileIds;

    if (!selectedCaseId) {
      setError("Please select a case.");
      setAnalysisData(null);
      return;
    }

    if (!activeFileIds || activeFileIds.length === 0) {
      setAnalysisData(null);
      setError(null);
      return;
    }

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setError("Date From cannot be later than Date To.");
      return;
    }

    const reqId = ++analysisReqIdRef.current;
    setIsLoadingAnalysis(true);
    setError(null);

    try {
      const filterParams = {
        fileIds: activeFileIds,
        ...filters,
      };

      const res = await getFinancialAnalysis(selectedCaseId, filterParams);

      if (reqId !== analysisReqIdRef.current) return;

      if (res?.error) {
        setError(res.error);
        setAnalysisData(null);
      } else {
        setAnalysisData(res);
        setError(null);
      }
    } catch (err) {
      if (reqId !== analysisReqIdRef.current) return;
      console.error("Financial analysis error:", err);
      setError(
        err?.response?.data?.detail ||
          "Error fetching financial transaction intelligence."
      );
      setAnalysisData(null);
    } finally {
      if (reqId === analysisReqIdRef.current) {
        setIsLoadingAnalysis(false);
      }
    }
  };

  // Trigger analysis when selected files change
  useEffect(() => {
    if (selectedFileIds.length > 0) {
      fetchAnalysis(selectedFileIds);
    } else {
      setAnalysisData(null);
    }
  }, [selectedFileIds]);

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
    setError(null);
  };

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyFilters = () => {
    fetchAnalysis();
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

  const isMultiFile = selectedFileIds.length > 1;

  // ------------------------------------------------------------
  // ECHARTS RENDERING (ARTHBODH LIGHT THEME)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!analysisData) {
      [distInstance, dailyInstance, monthlyInstance, balanceInstance].forEach(
        (instRef) => {
          if (instRef.current) {
            instRef.current.dispose();
            instRef.current = null;
          }
        }
      );
      return;
    }

    const commonTooltip = {
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
      extraCssText:
        "box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12); border-radius: 12px;",
      formatter: function (params) {
        if (!params || !params.length) return "";
        let res = `<div style="font-weight: 800; color: #172554; margin-bottom: 4px;">${params[0].axisValue}</div>`;
        params.forEach((p) => {
          let v =
            p.seriesName.includes("Transaction") ||
            p.seriesName === "Transactions"
              ? Number(p.value).toLocaleString("en-IN")
              : formatFinancialValue(p.value);
          res += `<div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 2px;">
            <span style="color: #64748B;">${p.marker} ${p.seriesName}:</span>
            <span style="font-weight: 700; color: #172554;">${v}</span>
          </div>`;
        });
        return res;
      },
    };

    // 1. Amount Distribution Chart
    if (distChartRef.current && analysisData.amount_distribution) {
      if (!distInstance.current) {
        distInstance.current = echarts.init(distChartRef.current);
      }
      distInstance.current.setOption(
        {
          backgroundColor: "#FFFFFF",
          tooltip: commonTooltip,
          grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
          xAxis: {
            type: "category",
            data: analysisData.amount_distribution.map((d) => d.range),
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#64748B", fontSize: 11, rotate: 20 },
          },
          yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            splitLine: { lineStyle: { color: "#F1F5F9" } },
            axisLabel: { color: "#64748B", fontSize: 11 },
          },
          series: [
            {
              name: "Transactions",
              type: "bar",
              barMaxWidth: 32,
              data: analysisData.amount_distribution.map((d) => d.count),
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "#6366F1" },
                  { offset: 1, color: "#818CF8" },
                ]),
                borderRadius: [6, 6, 0, 0],
              },
            },
          ],
        },
        true
      );
    }

    // 2. Daily Activity Chart (Debit vs Credit)
    if (dailyChartRef.current && analysisData.daily_activity) {
      if (!dailyInstance.current) {
        dailyInstance.current = echarts.init(dailyChartRef.current);
      }
      dailyInstance.current.setOption(
        {
          backgroundColor: "#FFFFFF",
          tooltip: commonTooltip,
          legend: {
            top: "2%",
            right: "4%",
            textStyle: { color: "#64748B", fontSize: 11, fontWeight: 600 },
          },
          grid: { left: "3%", right: "4%", bottom: "3%", top: "14%", containLabel: true },
          xAxis: {
            type: "category",
            data: analysisData.daily_activity.map((d) => formatDate(d.date_str)),
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#64748B", fontSize: 10, rotate: 30 },
          },
          yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            splitLine: { lineStyle: { color: "#F1F5F9" } },
            axisLabel: {
              color: "#64748B",
              fontSize: 11,
              formatter: (v) => formatFinancialValue(v),
            },
          },
          series: [
            {
              name: "Debit",
              type: "line",
              smooth: true,
              showSymbol: false,
              data: analysisData.daily_activity.map((d) => d.debit),
              lineStyle: { width: 2.5, color: "#E11D48" },
              itemStyle: { color: "#E11D48" },
            },
            {
              name: "Credit",
              type: "line",
              smooth: true,
              showSymbol: false,
              data: analysisData.daily_activity.map((d) => d.credit),
              lineStyle: { width: 2.5, color: "#059669" },
              itemStyle: { color: "#059669" },
            },
          ],
        },
        true
      );
    }

    // 3. Monthly Net Flow Chart
    if (monthlyChartRef.current && analysisData.monthly_activity) {
      if (!monthlyInstance.current) {
        monthlyInstance.current = echarts.init(monthlyChartRef.current);
      }
      monthlyInstance.current.setOption(
        {
          backgroundColor: "#FFFFFF",
          tooltip: commonTooltip,
          grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
          xAxis: {
            type: "category",
            data: analysisData.monthly_activity.map((d) => d.month_str),
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#64748B", fontSize: 11 },
          },
          yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            splitLine: { lineStyle: { color: "#F1F5F9" } },
            axisLabel: {
              color: "#64748B",
              fontSize: 11,
              formatter: (v) => formatFinancialValue(v),
            },
          },
          series: [
            {
              name: "Net Flow",
              type: "bar",
              barMaxWidth: 34,
              data: analysisData.monthly_activity.map((d) => {
                const isPos = Number(d.net_flow) >= 0;
                return {
                  value: d.net_flow,
                  itemStyle: {
                    color: isPos ? "#059669" : "#E11D48",
                    borderRadius: isPos ? [6, 6, 0, 0] : [0, 0, 6, 6],
                  },
                };
              }),
            },
          ],
        },
        true
      );
    }

    // 4. Balance Trend Chart
    if (balanceChartRef.current && analysisData.balance?.trend?.length > 0) {
      if (!balanceInstance.current) {
        balanceInstance.current = echarts.init(balanceChartRef.current);
      }
      balanceInstance.current.setOption(
        {
          backgroundColor: "#FFFFFF",
          tooltip: commonTooltip,
          grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
          xAxis: {
            type: "category",
            data: analysisData.balance.trend.map((d) => formatDate(d.date_str)),
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#64748B", fontSize: 10, rotate: 30 },
          },
          yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            splitLine: { lineStyle: { color: "#F1F5F9" } },
            axisLabel: {
              color: "#64748B",
              fontSize: 11,
              formatter: (v) => formatFinancialValue(v),
            },
          },
          series: [
            {
              name: "Balance",
              type: "line",
              smooth: true,
              showSymbol: false,
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(245, 158, 11, 0.25)" },
                  { offset: 1, color: "rgba(245, 158, 11, 0.01)" },
                ]),
              },
              data: analysisData.balance.trend.map((d) => d.balance),
              lineStyle: { width: 2.5, color: "#F59E0B" },
              itemStyle: { color: "#F59E0B" },
            },
          ],
        },
        true
      );
    }

    const handleResize = () => {
      [distInstance, dailyInstance, monthlyInstance, balanceInstance].forEach(
        (instRef) => instRef.current?.resize()
      );
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [analysisData]);

  // Clean-up all charts on unmount
  useEffect(() => {
    return () => {
      [distInstance, dailyInstance, monthlyInstance, balanceInstance].forEach(
        (instRef) => {
          if (instRef.current) {
            instRef.current.dispose();
            instRef.current = null;
          }
        }
      );
    };
  }, []);

  // ------------------------------------------------------------
  // EXPORT PDF FUNCTIONALITY
  // ------------------------------------------------------------
  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById("pdf-report-content");

    if (!element) {
      console.error("PDF container not found");
      setIsExporting(false);
      return;
    }

    const opt = {
      margin: 10,
      filename: `Financial_Transaction_Intelligence_Report_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    try {
      await html2pdf().set(opt).from(element).save();
      Swal.fire({
        icon: "success",
        title: "Export Successful",
        text: "The financial intelligence report PDF has been downloaded successfully.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#059669",
      });
    } catch (error) {
      console.error("PDF Export Error:", error);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text: "An error occurred while generating the PDF.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#e11d48",
      });
    } finally {
      setIsExporting(false);
    }
  };

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
        <div id="pdf-report-content">
          {/* ======================================================
              HEADER & ACTIONS
          ====================================================== */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/80 pb-6">
            <div>
              {/* Navigation Back Buttons */}
              <div
                className="flex flex-wrap items-center gap-2.5 mb-3 print:hidden"
                data-html2canvas-ignore="true"
              >
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
                  FINANCIAL INTELLIGENCE
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                Financial Transaction{" "}
                <span className="text-[#059669]">Intelligence</span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-3xl">
                Data-driven financial behavior analysis, cash-flow trends, and transaction concentration across selected accounts.
              </p>
            </div>

            {/* Badges & Export Action */}
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
                  {currentCase?.case_name || (selectedCaseId ? `Case #${selectedCaseId}` : "None")}
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
                  Accounts:
                </span>
                <span className="text-[#172554]">
                  {selectedFileIds.length} of {files.length} selected
                </span>
              </div>

              {/* PDF Export Button */}
              <div className="print:hidden" data-html2canvas-ignore="true">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExporting || !analysisData}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-4 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H9v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                      <span>Export PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================
              FILTER PANEL (PRINT HIDDEN)
          ====================================================== */}
          <div
            className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs print:hidden"
            data-html2canvas-ignore="true"
          >
            {/* Row 1: Case Selector & Account Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              {/* Select Case */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Select Case
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
                      -- Select Case --
                    </option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_name || `Case #${c.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Bank Accounts Dropdown */}
              <div className="md:col-span-2 relative" ref={accountDropdownRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Select Bank Accounts ({selectedFileIds.length} selected)
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
                        ? "Loading statements..."
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

                {/* Popover Menu (Open State) */}
                {isAccountDropdownOpen && (
                  <div className="absolute left-0 mt-2 z-50 w-full sm:w-[440px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
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

                    {/* Search */}
                    <div className="mb-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Search account number or bank..."
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

                    {/* Select All Row */}
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

                    {/* Scrollable List */}
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {filteredFiles.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          {accountSearch
                            ? "No matching accounts found."
                            : "No accounts available."}
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

            {/* Row 2: Secondary Filters (Date From, Date To, Type, Min Amount, Max Amount, Apply Button) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Date From
                </label>
                <input
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Date To
                </label>
                <input
                  type="date"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Transaction Type
                </label>
                <select
                  name="transactionType"
                  value={filters.transactionType}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition cursor-pointer"
                >
                  <option value="">All (Debit & Credit)</option>
                  <option value="debit">Debits Only</option>
                  <option value="credit">Credits Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Min Amount (₹)
                </label>
                <input
                  type="number"
                  name="minAmount"
                  value={filters.minAmount}
                  onChange={handleFilterChange}
                  placeholder="₹ Min"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Max Amount (₹)
                </label>
                <input
                  type="number"
                  name="maxAmount"
                  value={filters.maxAmount}
                  onChange={handleFilterChange}
                  placeholder="₹ Max"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={isLoadingAnalysis || selectedFileIds.length === 0}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoadingAnalysis ? (
                    <>
                      <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span>Apply Filters</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================
              PRINT CONTEXT INFO (FOR EXPORTED PDF)
          ====================================================== */}
          <div className="hidden print:block mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <h2 className="text-base font-bold text-[#172554]">
              Case: {currentCase?.case_name || selectedCaseId}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Selected Statements: {selectedFileIds.length} statement accounts
            </p>
            {(filters.dateFrom || filters.dateTo) && (
              <p className="text-xs text-slate-600 mt-0.5">
                Period: {filters.dateFrom || "Start"} to {filters.dateTo || "End"}
              </p>
            )}
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
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-3">
                <span className="w-6 h-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              </div>
              <h3 className="text-sm font-bold text-[#172554] mb-1">
                Analyzing Financial Transactions...
              </h3>
              <p className="text-xs text-slate-500">
                Computing financial behavioral statistics, amount distribution, daily activity, and cash flow for {selectedFileIds.length} account{selectedFileIds.length === 1 ? "" : "s"}.
              </p>
            </div>
          ) : analysisData && analysisData.kpis ? (
            <div className="space-y-8">
              {/* ======================================================
                  KPI METRIC CARDS
              ====================================================== */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  {
                    label: "Total Value",
                    val: analysisData.kpis.total_value,
                    color: "emerald",
                    subtext: "Debit + Credit volume",
                  },
                  {
                    label: "Highest Tx",
                    val: analysisData.kpis.highest_transaction,
                    color: "rose",
                    subtext: "Peak single transaction",
                  },
                  {
                    label: "Average Tx",
                    val: analysisData.kpis.average_transaction,
                    color: "blue",
                    subtext: "Mean transaction size",
                  },
                  {
                    label: "Median Tx",
                    val: analysisData.kpis.median_transaction,
                    color: "purple",
                    subtext: "50th percentile size",
                  },
                  {
                    label: "Highest Debit",
                    val: analysisData.kpis.highest_debit,
                    color: "rose",
                    subtext: "Max single outflow",
                  },
                  {
                    label: "Highest Credit",
                    val: analysisData.kpis.highest_credit,
                    color: "emerald",
                    subtext: "Max single inflow",
                  },
                ].map((k, i) => {
                  const isRose = k.color === "rose";
                  const isEmerald = k.color === "emerald";
                  const isBlue = k.color === "blue";

                  return (
                    <div
                      key={i}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300"
                    >
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        {k.label}
                      </span>
                      <span
                        className={`text-xl sm:text-2xl font-extrabold truncate ${
                          isRose
                            ? "text-rose-600"
                            : isEmerald
                            ? "text-emerald-700"
                            : isBlue
                            ? "text-[#0891B2]"
                            : "text-[#172554]"
                        }`}
                        title={formatAmt(k.val)}
                      >
                        {formatAmt(k.val)}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {k.subtext}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ======================================================
                  FINANCIAL CONCENTRATION & TRANSACTION STATS
              ====================================================== */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:break-inside-avoid">
                {/* Financial Concentration Card */}
                {analysisData.concentration && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                          Financial Concentration
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Volume proportion held by top transactions.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        Concentration Ratio
                      </span>
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          label: "Top 5 Transactions",
                          data: analysisData.concentration.top_5,
                        },
                        {
                          label: "Top 10 Transactions",
                          data: analysisData.concentration.top_10,
                        },
                        {
                          label: "Top 25 Transactions",
                          data: analysisData.concentration.top_25,
                        },
                      ].map((c, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700">
                              {c.label}
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-[#172554]">
                                {formatAmt(c.data.value)}
                              </span>
                              <span className="text-slate-400 text-[11px] ml-1.5">
                                ({Number(c.data.percentage || 0).toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-[#059669] h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(0, c.data.percentage || 0))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction Statistics Card */}
                {analysisData.stats && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                          Transaction Statistics
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Aggregate frequencies, averages, and volume breakdowns.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-[#172554] bg-slate-100 px-2 py-0.5 rounded-full">
                        {analysisData.stats.total_transactions} Total Txns
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Total Count:</span>
                        <span className="font-bold text-[#172554]">
                          {analysisData.stats.total_transactions}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Min Amount:</span>
                        <span className="font-bold text-[#172554]">
                          {formatAmt(analysisData.stats.min_transaction)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Debit Count:</span>
                        <span className="font-bold text-rose-600">
                          {analysisData.stats.debit_count}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Credit Count:</span>
                        <span className="font-bold text-emerald-700">
                          {analysisData.stats.credit_count}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Avg Debit:</span>
                        <span className="font-bold text-rose-600">
                          {formatAmt(analysisData.stats.avg_debit)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Avg Credit:</span>
                        <span className="font-bold text-emerald-700">
                          {formatAmt(analysisData.stats.avg_credit)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Total Debit:</span>
                        <span className="font-extrabold text-rose-600">
                          {formatAmt(analysisData.stats.total_debit)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Total Credit:</span>
                        <span className="font-extrabold text-emerald-700">
                          {formatAmt(analysisData.stats.total_credit)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ======================================================
                  TOP TRANSACTIONS TABLE CARD
              ====================================================== */}
              {analysisData.top_transactions?.overall && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                        Top Transactions Ranked by Amount
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Highest single transactions recorded within the selected statement accounts.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                      Top 10 Records
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-bold">Rank</th>
                          <th className="px-4 py-3 font-bold">Date</th>
                          <th className="px-4 py-3 font-bold">Description</th>
                          <th className="px-4 py-3 font-bold text-right">Debit</th>
                          <th className="px-4 py-3 font-bold text-right">Credit</th>
                          <th className="px-4 py-3 font-bold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analysisData.top_transactions.overall.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-extrabold text-[#172554]">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold ${
                                  idx === 0
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : idx === 1
                                    ? "bg-slate-200 text-slate-800"
                                    : idx === 2
                                    ? "bg-orange-100 text-orange-900"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                              {formatDate(t.transaction_date)}
                            </td>
                            <td
                              className="px-4 py-3 max-w-sm truncate font-medium text-slate-800"
                              title={t.description || t.raw_narration}
                            >
                              {t.description || t.raw_narration}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                              {t.debit > 0 ? formatAmt(t.debit) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">
                              {t.credit > 0 ? formatAmt(t.credit) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                              {formatAmt(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ======================================================
                  CHARTS SECTION: 2x2 GRID
              ====================================================== */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:break-inside-avoid">
                {/* 1. Amount Distribution */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                  <div className="mb-4 pb-2 border-b border-slate-100">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                      Amount Distribution
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Transaction frequency grouped by value brackets.
                    </p>
                  </div>
                  <div ref={distChartRef} className="w-full h-72"></div>
                </div>

                {/* 2. Daily Activity */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                  <div className="mb-4 pb-2 border-b border-slate-100">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                      Daily Financial Activity
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Daily timeline of debit outflows vs credit inflows.
                    </p>
                  </div>
                  <div ref={dailyChartRef} className="w-full h-72"></div>
                </div>

                {/* 3. Monthly Net Flow */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                  <div className="mb-4 pb-2 border-b border-slate-100">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                      Monthly Net Flow
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Net movement per calendar month across selected accounts.
                    </p>
                  </div>
                  <div ref={monthlyChartRef} className="w-full h-72"></div>
                </div>

                {/* 4. Balance Trend */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                        Balance Trend
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Closing balance progression over time.
                      </p>
                    </div>
                    {analysisData.balance && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                        Current: {formatAmt(analysisData.balance.closing)}
                      </span>
                    )}
                  </div>
                  <div ref={balanceChartRef} className="w-full h-72"></div>
                </div>
              </div>

              {/* ======================================================
                  MULTI-FILE FINANCIAL COMPARISON
              ====================================================== */}
              {isMultiFile && analysisData.file_comparison && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs print:break-inside-avoid">
                  <div className="mb-4 pb-2 border-b border-slate-100">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                      Statement-wise Financial Comparison
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparative breakdown of transaction counts and volumes per account.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-bold">Account Name / File</th>
                          <th className="px-4 py-3 font-bold text-right">Tx Count</th>
                          <th className="px-4 py-3 font-bold text-right">Debit</th>
                          <th className="px-4 py-3 font-bold text-right">Credit</th>
                          <th className="px-4 py-3 font-bold text-right">Total Value</th>
                          <th className="px-4 py-3 font-bold text-right">Highest Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analysisData.file_comparison.map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-bold text-[#172554]">
                              {f.account_name}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              {f.transaction_count}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                              {formatAmt(f.debit)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">
                              {formatAmt(f.credit)}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                              {formatAmt(f.total_value)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-[#0891B2]">
                              {formatAmt(f.highest_tx)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ======================================================
                  FREQUENT AMOUNTS & ROUND VALUES (2-COLUMN GRID)
              ====================================================== */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:break-inside-avoid">
                {/* Most Frequent Amounts */}
                {analysisData.most_frequent_amounts && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                    <div className="mb-4 pb-2 border-b border-slate-100">
                      <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                        Most Frequent Amounts
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Amounts appearing most repeatedly across statement records.
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-80">
                      <table className="w-full text-left text-xs text-slate-700 relative">
                        <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-4 py-2.5 font-bold">Amount</th>
                            <th className="px-4 py-2.5 font-bold">Occurrences</th>
                            <th className="px-4 py-2.5 font-bold">Type</th>
                            <th className="px-4 py-2.5 font-bold text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analysisData.most_frequent_amounts.slice(0, 25).map((f, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-2.5 font-extrabold text-[#172554]">
                                {formatAmt(f.amount)}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100">
                                  {f.occurrences}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-600 uppercase text-[10px]">
                                {f.type || "Txn"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                                {formatAmt(f.total_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Round-Value Transactions */}
                {analysisData.round_values && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#172554]">
                          Round-Value Transactions
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Multiples of standard round figures (e.g. ₹5,000, ₹10,000).
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                        Count: {analysisData.round_values.total_count}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-80">
                      <table className="w-full text-left text-xs text-slate-700 relative">
                        <thead className="text-[11px] text-slate-600 bg-slate-50 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-4 py-2.5 font-bold">Amount</th>
                            <th className="px-4 py-2.5 font-bold">Occurrences</th>
                            <th className="px-4 py-2.5 font-bold text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analysisData.round_values.details?.slice(0, 25).map((f, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-2.5 font-extrabold text-[#172554]">
                                {formatAmt(f.amount)}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100">
                                  {f.occurrences}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                                {formatAmt(f.total_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ======================================================
                EMPTY STATE
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>

              <h3 className="text-base font-extrabold text-[#172554] mb-1">
                Select Statement Accounts to View Financial Intelligence
              </h3>

              <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6">
                Choose a case and select one or more bank accounts from the dropdown above to load comprehensive financial metrics, charts, and transaction statistics.
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
        </div>
      </main>

      <UserFooter />
    </div>
  );
}