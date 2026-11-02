import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";
import Swal from "sweetalert2";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCases } from "../../../services/api/case";
import { getCaseNcrpFiles, getNcrpHoldRecoveryReport } from "../../../services/api/ncrp";
import { exportNcrpHoldRecoveryPdf } from "../../../utils/ncrpHoldRecoveryPdfExport";

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

/**
 * Searchable Select Component for Case and Workbook pickers
 */
function SearchableSelect({
  label,
  stepNumber,
  value,
  options = [],
  onSelect,
  placeholder = "Select...",
  searchPlaceholder = "Type to filter...",
  disabled = false,
  loading = false,
  emptyMessage = "No items found",
  badgeColor = "emerald",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleDocClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
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
      const matchSub = opt.subtitle?.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      return matchLabel || matchSub || matchBadge;
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative flex flex-col gap-1.5 ${isOpen ? "z-40" : "z-10"}`} ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-bold text-[#172554]">
          {stepNumber && (
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                badgeColor === "purple"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {stepNumber}
            </span>
          )}
          {label}
          {loading && (
            <span className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          )}
        </label>
      )}

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-200 outline-none ${
          disabled
            ? "cursor-not-allowed border-[#E2E8F0] bg-slate-100 text-[#94A3B8]"
            : isOpen
            ? "border-emerald-500 bg-white ring-3 ring-emerald-500/10 shadow-sm"
            : "border-[#DCE5EF] bg-white text-[#172554] hover:border-emerald-300"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedItem ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold text-[#172554]">
                {selectedItem.label}
              </span>
              {selectedItem.badge && (
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 uppercase">
                  {selectedItem.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate text-[#94A3B8]">
              {loading ? "Loading..." : placeholder}
            </span>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-600" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-1.5">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-[#DCE5EF] bg-slate-50 py-1.5 pl-7 pr-2.5 text-xs text-[#172554] outline-none placeholder:text-[#94A3B8] focus:border-emerald-500 focus:bg-white"
            />
            <svg
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
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
                    className={`flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left transition-colors ${
                      isSelected ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50 text-[#172554]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-xs">{opt.label}</div>
                      {opt.subtitle && (
                        <div className="truncate text-[10px] text-[#64748B] mt-0.5">{opt.subtitle}</div>
                      )}
                    </div>
                    {opt.badge && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-[#64748B]">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-3 text-center text-xs text-[#94A3B8]">{emptyMessage}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NcrpHoldRecoveryReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const caseIdFromUrl = searchParams.get("caseId") || "";
  const fileIdFromUrl = searchParams.get("fileId") || "";

  // State
  const [casesList, setCasesList] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(caseIdFromUrl);
  const [ncrpFilesList, setNcrpFilesList] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(fileIdFromUrl);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Sub-section filters
  const [bankSearch, setBankSearch] = useState("");
  const [withdrawalMethodFilter, setWithdrawalMethodFilter] = useState("ALL");
  const [revealedAccounts, setRevealedAccounts] = useState({});

  // ECharts refs
  const donutChartRef = useRef(null);
  const layerDecayChartRef = useRef(null);
  const withdrawalChartRef = useRef(null);

  // 1. Fetch accessible cases
  useEffect(() => {
    let isMounted = true;
    async function loadCases() {
      try {
        setLoadingCases(true);
        const res = await getCases();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setCasesList(list);
          if (caseIdFromUrl) {
            setSelectedCaseId(caseIdFromUrl);
          } else if (list.length > 0 && !selectedCaseId) {
            setSelectedCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load cases in hold recovery report:", err);
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [caseIdFromUrl]);

  // 2. Fetch NCRP files for selected case
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFilesList([]);
      setSelectedFileId("");
      setReportData(null);
      setReportError(null);
      return;
    }

    let isMounted = true;
    async function loadFiles() {
      try {
        setLoadingFiles(true);
        const res = await getCaseNcrpFiles(selectedCaseId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setNcrpFilesList(list);
          if (fileIdFromUrl && list.some((f) => String(f.id) === String(fileIdFromUrl))) {
            setSelectedFileId(fileIdFromUrl);
          } else if (list.length > 0) {
            setSelectedFileId(String(list[0].id));
          } else {
            setSelectedFileId("");
            setReportData(null);
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP files for case:", err);
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, fileIdFromUrl]);

  // 3. Update query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCaseId) params.set("caseId", selectedCaseId);
    if (selectedFileId) params.set("fileId", selectedFileId);
    setSearchParams(params, { replace: true });
  }, [selectedCaseId, selectedFileId, setSearchParams]);

  // 4. Fetch Hold Recovery Report Data
  const fetchReport = useCallback(async () => {
    if (!selectedFileId) {
      setReportData(null);
      setReportError(null);
      return;
    }

    try {
      setLoadingReport(true);
      setReportError(null);
      const res = await getNcrpHoldRecoveryReport(selectedFileId, {
        caseId: selectedCaseId || undefined,
      });
      const data = res?.data || res;
      setReportData(data);
    } catch (err) {
      console.error("Failed to fetch hold recovery report:", err);
      const msg = err?.message || "Failed to load NCRP Hold Recovery Report data.";
      setReportError(msg);
      Swal.fire({
        icon: "error",
        title: "Report Load Error",
        text: msg,
      });
    } finally {
      setLoadingReport(false);
    }
  }, [selectedFileId, selectedCaseId]);

  useEffect(() => {
    if (selectedFileId) {
      fetchReport();
    }
  }, [selectedFileId, fetchReport]);

  // Options for Case and File dropdowns
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: `${c.case_name || "Untitled Case"} — ${c.case_number || `Case #${c.id}`}`,
      subtitle: `Status: ${c.status || "ACTIVE"}`,
      badge: c.status || "ACTIVE",
    }));
  }, [casesList]);

  const fileOptions = useMemo(() => {
    return ncrpFilesList.map((f) => ({
      id: f.id,
      label: f.original_filename || f.filename || `File #${f.id}`,
      subtitle: `${f.total_rows || 0} rows • ${f.sheet_count || 0} sheets • ${f.status || "COMPLETED"}`,
      badge: f.status || "COMPLETED",
    }));
  }, [ncrpFilesList]);

  const currentCase = useMemo(() => {
    return casesList.find((c) => String(c.id) === String(selectedCaseId));
  }, [casesList, selectedCaseId]);

  const currentFile = useMemo(() => {
    return ncrpFilesList.find((f) => String(f.id) === String(selectedFileId));
  }, [ncrpFilesList, selectedFileId]);

  // Export PDF Handler
  const handleExportPdf = async () => {
    if (!reportData) return;
    try {
      setExportingPdf(true);
      await exportNcrpHoldRecoveryPdf(reportData, currentCase, {
        filename: `NCRP_Hold_Recovery_Report_${selectedFileId}.pdf`,
      });
      Swal.fire({
        icon: "success",
        title: "PDF Exported",
        text: "NCRP Hold Recovery Report PDF has been downloaded successfully.",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      Swal.fire({
        icon: "error",
        title: "PDF Export Failed",
        text: err?.message || "Failed to generate PDF report.",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  // Toggle account mask/reveal
  const toggleReveal = (acc) => {
    setRevealedAccounts((prev) => ({
      ...prev,
      [acc]: !prev[acc],
    }));
  };

  // =========================================================================
  // CHART INITIALIZATIONS (ECharts)
  // =========================================================================

  // Section B Donut Chart: Hold Allocation
  useEffect(() => {
    if (!donutChartRef.current || !reportData?.hold_allocation?.categories) return;
    const chart = echarts.init(donutChartRef.current);

    const categories = reportData.hold_allocation.categories;
    const chartData = categories.map((c) => {
      let color = "#64748B";
      if (c.category.includes("Fully")) color = "#059669";
      else if (c.category.includes("Partially")) color = "#D97706";
      else if (c.category.includes("Unsecured")) color = "#E11D48";
      else if (c.category.includes("Pending")) color = "#7C3AED";
      return {
        name: c.category,
        value: c.amount,
        itemStyle: { color },
      };
    });

    chart.setOption({
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          return `<div class="text-xs">
            <span class="font-bold">${params.name}</span><br/>
            Amount: <strong>₹${formatIndianCurrency(params.value)}</strong><br/>
            Share: ${params.percent}%
          </div>`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 10, color: "#64748B" },
      },
      series: [
        {
          name: "Hold Allocation",
          type: "pie",
          radius: ["42%", "70%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              formatter: "{d}%",
            },
          },
          data: chartData,
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [reportData]);

  // Section C Bar/Line Chart: Layer-wise Hold Coverage Decay
  useEffect(() => {
    if (!layerDecayChartRef.current || !reportData?.layer_coverage) return;
    const chart = echarts.init(layerDecayChartRef.current);

    const layers = reportData.layer_coverage;
    const xLabels = layers.map((l) => l.layer);
    const disputedData = layers.map((l) => l.disputed_amount);
    const holdData = layers.map((l) => l.verified_hold_amount);
    const wdrData = layers.map((l) => l.withdrawals_amount);
    const coverageData = layers.map((l) => l.hold_coverage_pct);

    chart.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          let str = `<div class="text-xs font-bold mb-1">${params[0].axisValue}</div>`;
          params.forEach((p) => {
            const valStr = p.seriesType === "line" ? `${p.value}%` : `₹${formatIndianCurrency(p.value)}`;
            str += `<div class="text-xs flex items-center justify-between gap-3">
              <span>${p.marker} ${p.seriesName}:</span>
              <strong>${valStr}</strong>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 10, color: "#64748B" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "8%",
        top: "16%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: { fontSize: 10, color: "#64748B" },
      },
      yAxis: [
        {
          type: "value",
          name: "Amount (₹)",
          nameTextStyle: { fontSize: 10, color: "#64748B" },
          axisLabel: {
            fontSize: 9,
            color: "#64748B",
            formatter: (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}`),
          },
        },
        {
          type: "value",
          name: "Coverage %",
          min: 0,
          max: 100,
          nameTextStyle: { fontSize: 10, color: "#7C3AED" },
          axisLabel: {
            fontSize: 9,
            color: "#7C3AED",
            formatter: "{value}%",
          },
        },
      ],
      series: [
        {
          name: "Disputed Exposure",
          type: "bar",
          data: disputedData,
          itemStyle: { color: "#CBD5E1" },
        },
        {
          name: "Cash Drain (Withdrawals)",
          type: "bar",
          data: wdrData,
          itemStyle: { color: "#F43F5E" },
        },
        {
          name: "Verified Hold Amount",
          type: "bar",
          data: holdData,
          itemStyle: { color: "#059669" },
        },
        {
          name: "Hold Coverage %",
          type: "line",
          yAxisIndex: 1,
          data: coverageData,
          itemStyle: { color: "#7C3AED" },
          lineStyle: { width: 2.5 },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [reportData]);

  // Section E Withdrawal Method Distribution Donut
  useEffect(() => {
    if (!withdrawalChartRef.current || !reportData?.withdrawals?.methods) return;
    const chart = echarts.init(withdrawalChartRef.current);

    const methods = reportData.withdrawals.methods;
    const chartData = methods.map((m) => {
      let color = "#3B82F6";
      if (m.method.includes("Cheque")) color = "#E11D48";
      else if (m.method.includes("ATM")) color = "#D97706";
      else if (m.method.includes("POS")) color = "#7C3AED";
      return {
        name: m.method.replace("Withdrawal through ", "").replace("Cash Withdrawal through ", ""),
        value: m.amount,
        itemStyle: { color },
      };
    });

    chart.setOption({
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          return `<div class="text-xs">
            <span class="font-bold">${params.name}</span><br/>
            Amount: <strong>₹${formatIndianCurrency(params.value)}</strong><br/>
            Share: ${params.percent}%
          </div>`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 10, color: "#64748B" },
      },
      series: [
        {
          name: "Withdrawal Methods",
          type: "pie",
          radius: ["40%", "68%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 11,
              fontWeight: "bold",
              formatter: "{d}%",
            },
          },
          data: chartData,
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [reportData]);

  // Filtered bank compliance rows
  const filteredBankMatrix = useMemo(() => {
    if (!reportData?.bank_matrix) return [];
    if (!bankSearch.trim()) return reportData.bank_matrix;
    const q = bankSearch.toLowerCase().trim();
    return reportData.bank_matrix.filter(
      (b) =>
        b.bank_name?.toLowerCase().includes(q) ||
        b.verification_status?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q)
    );
  }, [reportData?.bank_matrix, bankSearch]);

  // Filtered withdrawal records
  const filteredWithdrawalRecords = useMemo(() => {
    if (!reportData?.withdrawals?.records) return [];
    if (withdrawalMethodFilter === "ALL") return reportData.withdrawals.records;
    return reportData.withdrawals.records.filter((r) =>
      r.method.toLowerCase().includes(withdrawalMethodFilter.toLowerCase())
    );
  }, [reportData?.withdrawals?.records, withdrawalMethodFilter]);

  const overview = reportData?.overview;
  const holdAllocation = reportData?.hold_allocation;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F8FC] text-[#172033]">
      <BASNavbar />

      <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] mb-1">
              <button
                type="button"
                onClick={() =>
                  navigate(selectedCaseId ? `/reports/ncrp?caseId=${selectedCaseId}` : "/reports/ncrp")
                }
                className="hover:text-emerald-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                NCRP Reports Hub
              </button>
              <span>/</span>
              <span className="text-[#172554] font-bold">Report 04 — Hold Recovery Report</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#172554] tracking-tight flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              NCRP Hold Recovery Report
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Analyze fraud exposure, bank-confirmed holds, withdrawal activity, recovery progress and unsecured amounts across NCRP investigation layers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!reportData || loadingReport || exportingPdf}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {exportingPdf ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export Report PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TOP SELECTORS: Case & NCRP Workbook */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-4">
              <SearchableSelect
                label="Case File"
                stepNumber="1"
                value={selectedCaseId}
                options={caseOptions}
                onSelect={(val) => {
                  setSelectedCaseId(val);
                  setSelectedFileId("");
                  setReportData(null);
                }}
                placeholder="Choose investigation case"
                loading={loadingCases}
                badgeColor="emerald"
              />
            </div>

            <div className="lg:col-span-5">
              <SearchableSelect
                label="NCRP Excel Workbook"
                stepNumber="2"
                value={selectedFileId}
                options={fileOptions}
                onSelect={(val) => setSelectedFileId(val)}
                placeholder="Select imported Excel file"
                loading={loadingFiles}
                disabled={!selectedCaseId || fileOptions.length === 0}
                emptyMessage="No NCRP workbooks uploaded"
                badgeColor="emerald"
              />
            </div>

            <div className="lg:col-span-3 flex flex-col justify-end">
              <div className="p-2.5 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] text-[11px] space-y-1">
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Scope:</span>
                  <span className="font-bold text-[#172554] truncate max-w-[140px]" title={currentFile?.original_filename}>
                    {currentFile?.original_filename || "Not Selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Ack No:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {reportData?.acknowledgement_no || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LOADING & ERROR STATES */}
        {loadingReport && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-3 shadow-xs">
            <div className="h-10 w-10 mx-auto rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
            <p className="text-sm font-bold text-[#172554]">Auditing NCRP Hold Recovery Data...</p>
            <p className="text-xs text-[#64748B]">Cross-referencing 6 worksheets: transfers, explicit holds, liens, and cash withdrawals.</p>
          </div>
        )}

        {reportError && !loadingReport && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-3">
            <div className="h-10 w-10 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">!</div>
            <h3 className="text-sm font-bold text-rose-900">Failed to Load Report</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{reportError}</p>
            <button
              type="button"
              onClick={fetchReport}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-2xs"
            >
              Retry
            </button>
          </div>
        )}

        {!selectedFileId && !loadingReport && (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-[#172554]">No NCRP Workbook Selected</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Please select an investigation case and an imported NCRP Excel file above to run the Hold Recovery Audit.
            </p>
          </div>
        )}

        {/* MAIN REPORT BODY */}
        {reportData && !loadingReport && (
          <div className="space-y-6">
            {/* ========================================================= */}
            {/* SECTION A: FRAUD EXPOSURE OVERVIEW (8 KPI CARDS)          */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-emerald-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Section A — Fraud Exposure Overview
                  </h2>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  De-duplicated exposure vs movement volume & confirmed holds
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* KPI 1: Reported Fraud Amount */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Reported Fraud Amount
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-[#172554] block">
                      {overview?.reported_fraud_amount?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Layer 1 initial victim transfers
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] w-fit">
                    {overview?.reported_fraud_amount?.verification_status}
                  </span>
                </div>

                {/* KPI 2: Reconciled Fraud Exposure */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Reconciled Fraud Exposure
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-purple-700 block">
                      {overview?.reconciled_fraud_exposure?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Unique non-repetitive loss
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 w-fit">
                    {overview?.reconciled_fraud_exposure?.verification_status}
                  </span>
                </div>

                {/* KPI 3: Trace-Linked Volume */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Trace-Linked Volume
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-blue-700 block">
                      {overview?.trace_linked_volume?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Across all recorded transfer hops
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 w-fit">
                    MOVEMENT METRIC
                  </span>
                </div>

                {/* KPI 4: Amount on Hold (Verified) */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Amount on Hold (Verified)
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-emerald-700 block">
                      {overview?.amount_on_hold?.formatted_value}
                    </span>
                    <span className="text-[10px] text-emerald-800 block mt-0.5">
                      Confirmed explicit holds
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 w-fit">
                    VERIFIED SECURED
                  </span>
                </div>

                {/* KPI 5: Hold Coverage */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Hold Coverage
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-[#172554] block">
                      {overview?.hold_coverage?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Hold / Reconciled Exposure
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] w-fit">
                    RATIO
                  </span>
                </div>

                {/* KPI 6: Actual Recovered Amount */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Actual Recovered Amount
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-[#172554] block">
                      {overview?.actual_recovered_amount?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Returned to authorized party
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 w-fit">
                    NO CREDIT EVIDENCE
                  </span>
                </div>

                {/* KPI 7: Unsecured Gap */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                    Unsecured Gap
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-rose-700 block">
                      {overview?.unsecured_gap?.formatted_value}
                    </span>
                    <span className="text-[10px] text-rose-800 block mt-0.5">
                      Residual exposed funds
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 w-fit">
                    UNSECURED EXPOSURE
                  </span>
                </div>

                {/* KPI 8: Total Withdrawn Amount */}
                <div className="rounded-2xl border border-rose-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Total Withdrawn Amount
                  </span>
                  <div className="my-1.5">
                    <span className="text-lg font-black text-rose-700 block">
                      {overview?.total_withdrawn_amount?.formatted_value}
                    </span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      ATM + POS + Cheque cash drain
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 w-fit">
                    LIQUIDATED
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION B: HOLD ALLOCATION & RECOVERY STATUS              */}
            {/* ========================================================= */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-emerald-600" />
                    Section B — Hold Allocation & Recovery Status
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Classification of fraud exposure into verified holds, partial holds, and unsecured volume.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  Confirmed: ₹{formatIndianCurrency(holdAllocation?.verified_hold_amount)}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Donut Chart */}
                <div className="lg:col-span-5 h-64 relative flex items-center justify-center">
                  <div ref={donutChartRef} className="w-full h-full" />
                </div>

                {/* Right-side Allocation Summary Cards & Table */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Verified Hold</span>
                      <span className="text-sm font-black text-emerald-700 mt-1 block">
                        ₹{formatIndianCurrency(holdAllocation?.verified_hold_amount)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">Unsecured Gap</span>
                      <span className="text-sm font-black text-rose-700 mt-1 block">
                        ₹{formatIndianCurrency(holdAllocation?.unsecured_amount)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">Reported Liens</span>
                      <span className="text-sm font-black text-purple-700 mt-1 block">
                        ₹{formatIndianCurrency(holdAllocation?.reported_lien_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Categories Breakdown Table */}
                  <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#EEF2F7]">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-right">Amount (₹)</th>
                          <th className="px-3 py-2 text-right">Share (%)</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {(holdAllocation?.categories || []).map((cat, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2 font-semibold text-[#172554]">
                              {cat.category}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-[#172554]">
                              ₹{formatIndianCurrency(cat.amount)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-[#64748B]">
                              {cat.percentage.toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md ${
                                  cat.status === "Secured"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : cat.status === "Partially Secured"
                                    ? "bg-amber-100 text-amber-800"
                                    : cat.status === "Verification Required"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {cat.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION C: LAYER-WISE HOLD COVERAGE DECAY                 */}
            {/* ========================================================= */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-emerald-600" />
                    Section C — Layer-wise Hold Coverage Decay
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Evaluate how hold coverage declines across successive transaction layers as funds disperse downstream.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                  <span>9 Layers Observed</span>
                </div>
              </div>

              {/* Multi-series Chart */}
              <div className="h-72 w-full">
                <div ref={layerDecayChartRef} className="w-full h-full" />
              </div>

              {/* Layer Decay Data Table */}
              <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#EEF2F7]">
                    <tr>
                      <th className="px-3 py-2.5">Layer</th>
                      <th className="px-3 py-2.5 text-center">Accounts</th>
                      <th className="px-3 py-2.5 text-center">Txs</th>
                      <th className="px-3 py-2.5 text-right">Disputed Exposure (₹)</th>
                      <th className="px-3 py-2.5 text-right">Verified Hold (₹)</th>
                      <th className="px-3 py-2.5 text-right">Hold Coverage</th>
                      <th className="px-3 py-2.5 text-right">Cash Drain (₹)</th>
                      <th className="px-3 py-2.5 text-right">Unsecured Gap (₹)</th>
                      <th className="px-3 py-2.5">Key Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(reportData?.layer_coverage || []).map((l) => (
                      <tr key={l.layer_num} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-[#172554] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          {l.layer}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#64748B]">
                          {l.accounts_count}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#64748B]">
                          {l.tx_count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#172554]">
                          ₹{formatIndianCurrency(l.disputed_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                          ₹{formatIndianCurrency(l.verified_hold_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-purple-700">
                          {l.hold_coverage_pct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600">
                          {l.withdrawals_amount > 0 ? `₹${formatIndianCurrency(l.withdrawals_amount)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700">
                          ₹{formatIndianCurrency(l.unsecured_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#64748B] max-w-xs truncate" title={l.key_findings}>
                          {l.key_findings}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION D: INSTITUTIONAL COMPLIANCE MATRIX                */}
            {/* ========================================================= */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-emerald-600" />
                    Section D — Institutional Hold Recovery Compliance Matrix
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Bank-wise comparison of transaction exposure, confirmed holds, reported actions, and compliance status.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Search bank name..."
                    className="w-full rounded-xl border border-[#DCE5EF] bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-[#172554] outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <svg
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#EEF2F7]">
                    <tr>
                      <th className="px-3 py-2.5">Bank / FI Name</th>
                      <th className="px-3 py-2.5 text-center">Accounts</th>
                      <th className="px-3 py-2.5 text-right">Disputed Exposure (₹)</th>
                      <th className="px-3 py-2.5 text-right">Verified Hold (₹)</th>
                      <th className="px-3 py-2.5 text-right">Unsecured Gap (₹)</th>
                      <th className="px-3 py-2.5 text-right">Coverage %</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5">Investigative Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredBankMatrix.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-[#172554]">
                          {b.bank_name}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#64748B]">
                          {b.accounts_count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#172554]">
                          ₹{formatIndianCurrency(b.disputed_exposure)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                          ₹{formatIndianCurrency(b.verified_hold_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700">
                          ₹{formatIndianCurrency(b.unsecured_gap)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-purple-700">
                          {b.hold_coverage_pct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md ${
                              b.verification_status === "Hold Confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.verification_status === "Partially Held"
                                ? "bg-amber-100 text-amber-800"
                                : b.verification_status === "Verification Required"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-[#64748B]"
                            }`}
                          >
                            {b.verification_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#64748B] max-w-xs truncate" title={b.notes}>
                          {b.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#64748B]">
                <strong>Notice:</strong> This compliance matrix is an investigative follow-up tool to prioritize notices and requisitions, not an automatic legal finding of institutional non-compliance.
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION E: WITHDRAWAL ANALYSIS (ATM, POS, CHEQUE)         */}
            {/* ========================================================= */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-rose-600" />
                    Section E — Cash & Merchant Withdrawal Analysis
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Examine cash drain across ATM terminals, POS merchants, and branch counter cheques.
                  </p>
                </div>
                <div className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg">
                  Total Cash Drain: ₹{formatIndianCurrency(reportData?.withdrawals?.total_amount)}
                </div>
              </div>

              {/* Method Cards & Donut Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                <div className="lg:col-span-5 h-60 relative flex items-center justify-center">
                  <div ref={withdrawalChartRef} className="w-full h-full" />
                </div>

                <div className="lg:col-span-7 grid grid-cols-3 gap-3">
                  {(reportData?.withdrawals?.methods || []).map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                        {m.method.replace("Withdrawal through ", "").replace("Cash Withdrawal through ", "")}
                      </span>
                      <div className="my-1.5">
                        <span className="text-lg font-black text-rose-700 block">
                          ₹{formatIndianCurrency(m.amount)}
                        </span>
                        <span className="text-[10px] text-[#64748B] block mt-0.5">
                          {m.record_count} record(s) • {m.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 w-fit">
                        CASH DISSIPATION
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-2 pt-2">
                {["ALL", "Cheque", "ATM", "POS"].map((methodKey) => (
                  <button
                    key={methodKey}
                    type="button"
                    onClick={() => setWithdrawalMethodFilter(methodKey)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      withdrawalMethodFilter === methodKey
                        ? "bg-[#172554] text-white"
                        : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
                    }`}
                  >
                    {methodKey === "ALL" ? "All Methods" : methodKey}
                  </button>
                ))}
              </div>

              {/* Withdrawal Detailed Records Table */}
              <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#EEF2F7]">
                    <tr>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Bank</th>
                      <th className="px-3 py-2.5">Account</th>
                      <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3 py-2.5">Date & Time</th>
                      <th className="px-3 py-2.5">UTR / Txn ID</th>
                      <th className="px-3 py-2.5">Terminal / Location Details</th>
                      <th className="px-3 py-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredWithdrawalRecords.map((w) => {
                      const isRev = !!revealedAccounts[w.account];
                      return (
                        <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-[#172554]">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                w.method.includes("Cheque")
                                  ? "bg-rose-100 text-rose-800"
                                  : w.method.includes("ATM")
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {w.method.replace("Withdrawal through ", "").replace("Cash Withdrawal through ", "")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-[#172554]">{w.bank}</td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#172554]">
                            <div className="flex items-center gap-1">
                              <span>{isRev ? w.account : maskAccountNumber(w.account)}</span>
                              <button
                                type="button"
                                onClick={() => toggleReveal(w.account)}
                                className="text-[#94A3B8] hover:text-emerald-700"
                                title={isRev ? "Mask" : "Reveal"}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700">
                            ₹{formatIndianCurrency(w.amount)}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#64748B]">{w.date || "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#64748B]">{w.utr || "—"}</td>
                          <td className="px-3 py-2.5 text-[11px] text-[#172554] max-w-xs truncate" title={w.details}>
                            {w.details || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#64748B] max-w-xs truncate" title={w.remarks}>
                            {w.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION F: RECOVERY TRACKING & EVIDENCE                   */}
            {/* ========================================================= */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-emerald-600" />
                    Section F — Recovery Tracking & Evidence
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Verification of actual returned/credited funds vs secured holds pending judicial order.
                  </p>
                </div>
              </div>

              {/* Prominent Evidence Alert Banner */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    No explicit recovery amount evidence detected
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    A hold is not a recovery. A lien is not a recovery. A requested refund is not a completed recovery.
                    A bank-confirmed returned or credited amount is required to classify an amount as actually recovered.
                    In this workbook, <strong>₹{formatIndianCurrency(holdAllocation?.verified_hold_amount)}</strong> has been secured under confirmed holds and remains pending court return order.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3.5 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Recovery Initiated</span>
                  <span className="text-base font-black text-emerald-700 mt-1 block">
                    ₹{formatIndianCurrency(reportData?.recovery_evidence?.recovery_initiated_amount)}
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-0.5">Under Verified Holds</span>
                </div>
                <div className="p-3.5 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Recovery Pending</span>
                  <span className="text-base font-black text-amber-700 mt-1 block">
                    ₹{formatIndianCurrency(reportData?.recovery_evidence?.recovery_pending_amount)}
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-0.5">Awaiting Judicial Order</span>
                </div>
                <div className="p-3.5 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Recovery Completed</span>
                  <span className="text-base font-black text-slate-400 mt-1 block">
                    ₹{formatIndianCurrency(reportData?.recovery_evidence?.recovery_completed_amount)}
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-0.5">No Credits Confirmed</span>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SECTION G: PRIORITY INVESTIGATION FOLLOW-UP               */}
            {/* ========================================================= */}
            {/*a
            hello
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-emerald-600" />
                    Section G — Priority Investigation Follow-up Actions
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Tactical recommendations for investigating officers to issue requisitions, freeze notices, and CCTV requests.
                  </p>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                  {reportData?.priority_actions?.length || 0} Priority Items
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#EEF2F7]">
                    <tr>
                      <th className="px-3 py-2.5 text-center">Priority</th>
                      <th className="px-3 py-2.5">Bank</th>
                      <th className="px-3 py-2.5">Account</th>
                      <th className="px-3 py-2.5 text-center">Layer</th>
                      <th className="px-3 py-2.5 text-right">Disputed Exposure (₹)</th>
                      <th className="px-3 py-2.5 text-right">Unsecured Gap (₹)</th>
                      <th className="px-3 py-2.5">Investigation Reason</th>
                      <th className="px-3 py-2.5">Recommended Follow-up Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(reportData?.priority_actions || []).map((p) => {
                      const isRev = !!revealedAccounts[p.account];
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md ${
                                p.priority === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : p.priority === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : p.priority === "MEDIUM"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                              title={p.risk_score !== undefined && p.risk_score !== null ? `Risk Score: ${p.risk_score}/100` : undefined}
                            >
                              {p.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-[#172554]">{p.bank}</td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#172554]">
                            <div className="flex items-center gap-1">
                              <span>{isRev ? p.account : maskAccountNumber(p.account)}</span>
                              <button
                                type="button"
                                onClick={() => toggleReveal(p.account)}
                                className="text-[#94A3B8] hover:text-emerald-700"
                                title={isRev ? "Mask" : "Reveal"}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-[#64748B]">{p.layer}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#172554]">
                            ₹{formatIndianCurrency(p.disputed_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700">
                            ₹{formatIndianCurrency(p.unsecured_gap)}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#172554] max-w-xs">{p.investigation_reason}</td>
                          <td className="px-3 py-2.5 text-[11px] font-semibold text-emerald-800 max-w-xs">
                            {p.recommended_action}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#64748B]">
                <strong>Legal Disclaimer:</strong> These priorities are rule-based investigative recommendations based on transaction flow anomalies, not claims of criminal guilt or institutional liability.
              </div>
            </section>
              */}
          </div>
        )}
      </main>

      <UserFooter />
    </div>
  );
}
