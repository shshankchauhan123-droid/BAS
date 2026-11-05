import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";

import { useAuth } from "../../../context/AuthContext";
import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import NcrpTraceabilityGraph from "../../../components/reports/NcrpTraceabilityGraph";

import { getCases } from "../../../services/api/case";
import {
  getCaseNcrpFiles,
  getNcrpWorkbookAccounts,
  getNcrpAccountActivityReport,
} from "../../../services/api/ncrp";
import { exportAccountActivityReportToExcel } from "../../../utils/ncrpAccountActivityExport";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInr(val) {
  if (val === undefined || val === null || val === "") return "₹0.00";
  const num = Number(val);
  if (Number.isNaN(num)) return "₹0.00";
  return inrFormatter.format(num);
}

function formatCount(val) {
  if (val === undefined || val === null || val === "") return "0";
  const num = Number(val);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("en-IN");
}

function maskAcc(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.length <= 4) return s;
  if (s.length <= 6) return s.slice(0, 1) + "X".repeat(s.length - 2) + s.slice(-1);
  return s.slice(0, 2) + "X".repeat(s.length - 6) + s.slice(-4);
}

/**
 * Searchable Dropdown Selector
 */
function SearchableDropdown({
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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedItem = useMemo(() => {
    return options.find((opt) => String(opt.id) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const rawQuery = searchTerm.trim().toLowerCase();
    if (!rawQuery) return options;
    const cleanQuery = rawQuery.replace(/[\s\-_—]/g, "");

    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(rawQuery);
      const matchSubtitle = opt.subtitle?.toLowerCase().includes(rawQuery);
      const matchBadge = opt.badge?.toLowerCase().includes(rawQuery);
      const matchRawId = String(opt.id || "").toLowerCase().includes(rawQuery);
      const matchAccount = opt.account ? String(opt.account).toLowerCase().includes(cleanQuery) : false;
      const matchBank = opt.bank ? String(opt.bank).toLowerCase().includes(rawQuery) : false;
      const matchMasked = opt.masked_account ? String(opt.masked_account).toLowerCase().includes(rawQuery) : false;

      return (
        matchLabel ||
        matchSubtitle ||
        matchBadge ||
        matchRawId ||
        matchAccount ||
        matchBank ||
        matchMasked
      );
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative flex flex-col gap-1.5 ${isOpen ? "z-40" : "z-10"}`} ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#172554]">
          {stepNumber && (
            <span
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                badgeColor === "emerald"
                  ? "bg-emerald-50 text-emerald-700"
                  : badgeColor === "purple"
                  ? "bg-purple-50 text-purple-700"
                  : "bg-blue-50 text-blue-700"
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
        className={`group relative flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-all duration-200 outline-none ${
          disabled
            ? "cursor-not-allowed border-[#E2E8F0] bg-slate-100 text-[#94A3B8]"
            : isOpen
            ? "border-emerald-500 bg-white ring-3 ring-emerald-500/10 shadow-sm"
            : "border-[#DCE5EF] bg-white text-[#172554] hover:border-emerald-300"
        }`}
      >
        <span className="truncate pr-2">
          {selectedItem ? (
            <span
              className="flex items-center gap-1.5 min-w-0"
              title={
                selectedItem.subtitle
                  ? `${selectedItem.label} (${selectedItem.subtitle})`
                  : selectedItem.label
              }
            >
              <span className="font-semibold text-[#172554] truncate">
                {selectedItem.label}
              </span>
              {selectedItem.subtitle && (
                <span className="text-[11px] text-[#64748B] font-normal truncate shrink-0">
                  ({selectedItem.subtitle})
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#94A3B8]">{loading ? "Loading..." : placeholder}</span>
          )}
        </span>
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
        <div className="absolute left-0 top-[calc(100%+4px)] max-h-72 w-full min-w-[320px] sm:min-w-[440px] max-w-[95vw] rounded-xl border border-[#CBD5E1] bg-white shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white py-1.5 pl-3 pr-2.5 text-xs text-[#172554] placeholder-[#94A3B8] outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-56 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#94A3B8]">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(value);
                const fullDisplayTitle = opt.subtitle
                  ? `${opt.label} (${opt.subtitle})`
                  : opt.label;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-emerald-50/60 ${
                      isSelected ? "bg-emerald-50 font-semibold text-emerald-800" : "text-[#1E293B]"
                    }`}
                  >
                    <div
                      className="flex items-center gap-1.5 min-w-0 truncate pr-2"
                      title={fullDisplayTitle}
                    >
                      <span className="truncate font-semibold text-[#172554]">
                        {opt.label}
                      </span>
                      {opt.subtitle && (
                        <span className="text-[11px] text-[#64748B] font-normal truncate shrink-0">
                          ({opt.subtitle})
                        </span>
                      )}
                    </div>
                    {opt.badge && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Pagination Controls
 */
function ReportTablePagination({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 mt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-[#172554]">{startItem}–{endItem}</strong> of{" "}
          <strong className="text-[#172554]">{totalItems}</strong> records
        </span>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <label className="text-[#64748B] text-[11px] whitespace-nowrap">Rows per page:</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#172554] outline-none focus:border-emerald-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1 || totalItems === 0}
          className="px-2 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || totalItems === 0}
          className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹ Prev
        </button>

        <span className="px-2.5 py-1 text-xs font-medium text-[#172554]">
          Page <b>{totalItems === 0 ? 0 : safeCurrentPage}</b> of <b>{totalPages}</b>
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages || totalItems === 0}
          className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages || totalItems === 0}
          className="px-2 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          »
        </button>
      </div>
    </div>
  );
}

export default function NcrpAccountActivityReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Access control & reveal authorization for investigators
  const isAuthorizedInvestigator = useMemo(() => {
    if (!user) return true;
    const role = String(user.role || "").toLowerCase();
    if (["super_admin", "superadmin", "admin", "client_admin"].includes(role)) {
      return true;
    }
    return Boolean(
      user.permissions?.can_ncrp_statement_analysis ||
      user.permissions?.can_view_reports
    );
  }, [user]);

  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleCopyAccount = (accNum) => {
    if (!accNum) return;
    navigator.clipboard.writeText(String(accNum));
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  // Primary Selection States
  const [casesList, setCasesList] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(searchParams.get("caseId") || "");

  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(searchParams.get("fileId") || "");

  const [workbookAccounts, setWorkbookAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(searchParams.get("account") || "");

  // Optional Filters
  const [layerFilter, setLayerFilter] = useState("ALL");
  const [txTypeFilter, setTxTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rapidThresholdFilter, setRapidThresholdFilter] = useState("ALL");

  // Graph / Chart View Mode Toggle: 'chart' | 'graph' | 'both'
  const [graphViewMode, setGraphViewMode] = useState("chart");
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Report Data State
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Request race-condition counter
  const activeRequestRef = useRef(0);

  // UI Display States
  const [revealAccount, setRevealAccount] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineSortOrder, setTimelineSortOrder] = useState("asc");
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelinePageSize, setTimelinePageSize] = useState(10);

  const [rapidPage, setRapidPage] = useState(1);
  const [rapidPageSize, setRapidPageSize] = useState(10);

  const [destPage, setDestPage] = useState(1);
  const [destPageSize, setDestPageSize] = useState(10);

  const [gapsPage, setGapsPage] = useState(1);
  const [gapsPageSize, setGapsPageSize] = useState(10);

  // ECharts Container & Instance Refs
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // 1. Fetch Cases on mount
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

  // 2. Load NCRP Files when Case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFiles([]);
      setSelectedFileId("");
      setWorkbookAccounts([]);
      setSelectedAccount("");
      setReportData(null);
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
          if (list.length > 0) {
            const currentMatch = list.find((f) => String(f.id) === String(selectedFileId));
            if (!currentMatch) {
              setSelectedFileId(String(list[0].id));
            }
          } else {
            setSelectedFileId("");
            setWorkbookAccounts([]);
            setSelectedAccount("");
            setReportData(null);
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP workbooks:", err);
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // 3. Load Accounts when File changes
  useEffect(() => {
    if (!selectedFileId) {
      setWorkbookAccounts([]);
      setSelectedAccount("");
      setReportData(null);
      return;
    }
    let isMounted = true;
    async function loadAccounts() {
      try {
        setLoadingAccounts(true);
        const res = await getNcrpWorkbookAccounts(selectedFileId, { caseId: selectedCaseId });
        const list = res?.accounts || [];
        if (isMounted) {
          setWorkbookAccounts(list);
          if (list.length > 0) {
            const currentMatch = list.find((a) => a.account === selectedAccount);
            if (!currentMatch) {
              setSelectedAccount(list[0].account);
            }
          } else {
            setSelectedAccount("");
            setReportData(null);
          }
        }
      } catch (err) {
        console.error("Failed to load workbook accounts:", err);
      } finally {
        if (isMounted) setLoadingAccounts(false);
      }
    }
    loadAccounts();
    return () => {
      isMounted = false;
    };
  }, [selectedFileId, selectedCaseId]);

  // 4. Fetch Full Report Data on Selection / Filter Change
  const fetchReportData = useCallback(async () => {
    if (!selectedCaseId || !selectedFileId || !selectedAccount) {
      setReportData(null);
      return;
    }

    const currentReqId = ++activeRequestRef.current;

    try {
      setLoadingReport(true);
      setReportError(null);

      const res = await getNcrpAccountActivityReport(selectedFileId, {
        caseId: selectedCaseId,
        account: selectedAccount,
        layer: layerFilter,
        txType: txTypeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      // Avoid overwriting if user switched account while request was in-flight
      if (currentReqId !== activeRequestRef.current) {
        return;
      }

      setReportData(res);
      setTimelinePage(1);
      setRapidPage(1);
      setDestPage(1);
      setGapsPage(1);
      setFitTrigger((prev) => prev + 1);
    } catch (err) {
      if (currentReqId === activeRequestRef.current) {
        console.error("Failed to load account activity report:", err);
        setReportError(err?.message || "Failed to load report data.");
      }
    } finally {
      if (currentReqId === activeRequestRef.current) {
        setLoadingReport(false);
      }
    }
  }, [selectedFileId, selectedCaseId, selectedAccount, layerFilter, txTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Update URL Search Params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCaseId) params.set("caseId", selectedCaseId);
    if (selectedFileId) params.set("fileId", selectedFileId);
    if (selectedAccount) params.set("account", selectedAccount);
    setSearchParams(params, { replace: true });
  }, [selectedCaseId, selectedFileId, selectedAccount, setSearchParams]);

  // 5. Initialize ECharts for Incoming vs Outgoing Timeline Chart
  useEffect(() => {
    const container = chartRef.current;
    if (!container || !reportData || (graphViewMode !== "chart" && graphViewMode !== "both")) {
      return;
    }

    const daily = reportData.incoming_vs_outgoing?.daily_timeline || [];
    if (daily.length === 0) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      return;
    }

    // Clean up if instance is attached to a detached DOM element
    const existing = echarts.getInstanceByDom(container);
    if (existing && existing !== chartInstanceRef.current) {
      existing.dispose();
    }
    if (chartInstanceRef.current && chartInstanceRef.current.getDom() !== container) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }

    const chartInstance = chartInstanceRef.current || echarts.init(container);
    chartInstanceRef.current = chartInstance;

    const dates = daily.map((d) => d.date);
    const inAmts = daily.map((d) => d.incoming_amount);
    const outAmts = daily.map((d) => d.outgoing_transfer_amount);
    const withAmts = daily.map((d) => d.withdrawal_amount);

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          let s = `<div class="font-bold border-b pb-1 mb-1 text-slate-800">${params[0]?.axisValue || ""}</div>`;
          params.forEach((p) => {
            s += `<div class="flex items-center justify-between gap-4 text-xs">
              <span class="flex items-center gap-1.5">${p.marker} <span>${p.seriesName}:</span></span>
              <span class="font-bold">${formatInr(p.value)}</span>
            </div>`;
          });
          return s;
        },
      },
      legend: {
        data: ["Incoming Credits", "Outgoing Transfers", "Cash Withdrawals"],
        bottom: 0,
        textStyle: { color: "#334155", fontSize: 11 },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "12%",
        top: "8%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: dates.length > 0 ? dates : ["No Data"],
        axisLine: { lineStyle: { color: "#CBD5E1" } },
        axisLabel: { color: "#475569", fontSize: 10, rotate: dates.length > 6 ? 25 : 0 },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "#CBD5E1" } },
        splitLine: { lineStyle: { color: "#F1F5F9" } },
        axisLabel: {
          color: "#475569",
          fontSize: 10,
          formatter: (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString("en-IN")}`),
        },
      },
      series: [
        {
          name: "Incoming Credits",
          type: "bar",
          data: inAmts,
          itemStyle: { color: "#10b981", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 35,
        },
        {
          name: "Outgoing Transfers",
          type: "bar",
          data: outAmts,
          itemStyle: { color: "#3b82f6", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 35,
        },
        {
          name: "Cash Withdrawals",
          type: "bar",
          data: withAmts,
          itemStyle: { color: "#f59e0b", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 35,
        },
      ],
    };

    chartInstance.setOption(option, true);

    // Initial resize inside requestAnimationFrame
    requestAnimationFrame(() => {
      if (chartInstance && !chartInstance.isDisposed()) {
        chartInstance.resize();
      }
    });

    // Observe container size changes (CSS layout completion)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (chartInstance && !chartInstance.isDisposed()) {
            chartInstance.resize();
          }
        }
      }
    });
    ro.observe(container);

    const handleWindowResize = () => {
      if (chartInstance && !chartInstance.isDisposed()) {
        chartInstance.resize();
      }
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [reportData, graphViewMode]);

  // Dropdown options
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: c.case_name || `Case #${c.id}`,
      subtitle: c.case_number,
      badge: c.status || "ACTIVE",
    }));
  }, [casesList]);

  const fileOptions = useMemo(() => {
    return ncrpFiles.map((f) => ({
      id: f.id,
      label: f.original_filename || `Workbook #${f.id}`,
      subtitle: `${f.imported_rows || 0} rows`,
      badge: f.status || "COMPLETED",
    }));
  }, [ncrpFiles]);

  const accountOptions = useMemo(() => {
    return workbookAccounts.map((a) => {
      // Display full unmasked account number for authorized investigators so accounts are distinctly identifiable
      const fullAccount = (isAuthorizedInvestigator || revealAccount) ? a.account : a.masked_account;
      const bankName = a.bank || "Unknown Bank";
      const txCount = a.total_transactions || 0;
      const txText = `${txCount} ${txCount === 1 ? "transaction" : "transactions"}`;
      const layerNums = a.layers && a.layers.length > 0 ? a.layers.join(", ") : "1";
      const subtitle = `${txText} • Layer ${layerNums}`;

      return {
        id: a.account,
        account: a.account,
        masked_account: a.masked_account,
        bank: bankName,
        label: `${fullAccount} — ${bankName}`,
        subtitle: subtitle,
        badge: a.is_starting_account ? "SUSPECT ROOT" : `Layer ${(a.layers || [1])[0]}`,
      };
    });
  }, [workbookAccounts, isAuthorizedInvestigator, revealAccount]);

  // Filtered & Paginated Timeline Transactions
  const filteredTimeline = useMemo(() => {
    if (!reportData?.timeline_transactions) return [];
    let list = [...reportData.timeline_transactions];

    if (timelineSearch.trim()) {
      const q = timelineSearch.trim().toLowerCase();
      list = list.filter((t) => {
        return (
          t.sender_account?.toLowerCase().includes(q) ||
          t.beneficiary_account?.toLowerCase().includes(q) ||
          t.sender_bank?.toLowerCase().includes(q) ||
          t.beneficiary_bank?.toLowerCase().includes(q) ||
          t.utr?.toLowerCase().includes(q) ||
          t.narration?.toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      const dateA = a.datetime || a.date || "";
      const dateB = b.datetime || b.date || "";
      return timelineSortOrder === "asc"
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });

    return list;
  }, [reportData, timelineSearch, timelineSortOrder]);

  const paginatedTimeline = useMemo(() => {
    const start = (timelinePage - 1) * timelinePageSize;
    return filteredTimeline.slice(start, start + timelinePageSize);
  }, [filteredTimeline, timelinePage, timelinePageSize]);

  // Rapid Movement Filtered & Paginated
  const filteredRapid = useMemo(() => {
    const list = reportData?.rapid_fund_movement?.records || [];
    if (rapidThresholdFilter === "ALL") return list;
    if (rapidThresholdFilter === "15m") return list.filter((r) => r.time_gap_minutes !== null && r.time_gap_minutes <= 15);
    if (rapidThresholdFilter === "1h") return list.filter((r) => r.time_gap_minutes !== null && r.time_gap_minutes <= 60);
    if (rapidThresholdFilter === "24h") return list.filter((r) => r.time_gap_minutes !== null && r.time_gap_minutes <= 1440);
    return list;
  }, [reportData, rapidThresholdFilter]);

  const paginatedRapid = useMemo(() => {
    const start = (rapidPage - 1) * rapidPageSize;
    return filteredRapid.slice(start, start + rapidPageSize);
  }, [filteredRapid, rapidPage, rapidPageSize]);

  // Destinations Paginated
  const allDestinations = reportData?.exit_activity?.destinations || [];
  const paginatedDestinations = useMemo(() => {
    const start = (destPage - 1) * destPageSize;
    return allDestinations.slice(start, start + destPageSize);
  }, [allDestinations, destPage, destPageSize]);

  // Gaps Paginated
  const allGaps = reportData?.data_quality_gaps || [];
  const paginatedGaps = useMemo(() => {
    const start = (gapsPage - 1) * gapsPageSize;
    return allGaps.slice(start, start + gapsPageSize);
  }, [allGaps, gapsPage, gapsPageSize]);

  const kpis = reportData?.kpi_cards || {};
  const profile = reportData?.account_profile || {};
  const recon = reportData?.amount_reconciliation || {};
  const lastTrace = reportData?.last_traceable_activity || {};
  const graphNodes = reportData?.graph_data?.nodes || [];
  const graphEdges = reportData?.graph_data?.edges || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <BASNavbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ================================================================
            1. REPORT HEADER & SELECTORS
        ================================================================ */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F1F5F9] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                  07
                </span>
                <h1 className="text-xl font-bold text-[#172554] tracking-tight">
                  NCRP Account Activity & Exit Report
                </h1>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Analyze account-level fund movement, transaction timing and last traceable activity.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRevealAccount(!revealAccount)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  revealAccount
                    ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm"
                    : "border-slate-200 bg-white text-[#475569] hover:bg-slate-50"
                }`}
                title={revealAccount ? "Mask account numbers" : "Reveal full account numbers"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {revealAccount ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  )}
                </svg>
                {revealAccount ? "Mask Account" : "Reveal Account"}
              </button>

              <button
                type="button"
                onClick={() => reportData && exportAccountActivityReportToExcel(reportData)}
                disabled={!reportData || loadingReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-600 bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[#475569] text-xs font-semibold hover:bg-slate-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / PDF
              </button>
            </div>
          </div>

          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SearchableDropdown
              label="Active Case"
              stepNumber="1"
              value={selectedCaseId}
              options={caseOptions}
              onSelect={(val) => {
                setSelectedCaseId(val);
                setSelectedFileId("");
                setSelectedAccount("");
                setReportData(null);
              }}
              loading={loadingCases}
              placeholder="Select Case"
              searchPlaceholder="Search cases..."
            />

            <SearchableDropdown
              label="NCRP Workbook"
              stepNumber="2"
              value={selectedFileId}
              options={fileOptions}
              onSelect={(val) => {
                setSelectedFileId(val);
                setSelectedAccount("");
                setReportData(null);
              }}
              disabled={!selectedCaseId || ncrpFiles.length === 0}
              loading={loadingFiles}
              placeholder={!selectedCaseId ? "Select Case First" : ncrpFiles.length === 0 ? "No Workbooks Found" : "Select Workbook"}
              searchPlaceholder="Search workbooks..."
            />

            <SearchableDropdown
              label="Suspicious Account"
              stepNumber="3"
              value={selectedAccount}
              options={accountOptions}
              onSelect={(val) => {
                setSelectedAccount(val);
                setReportData(null);
              }}
              disabled={!selectedFileId || workbookAccounts.length === 0}
              loading={loadingAccounts}
              placeholder={!selectedFileId ? "Select Workbook First" : workbookAccounts.length === 0 ? "No Accounts Found" : "Select Suspicious Account"}
              searchPlaceholder="Search by full account number, bank..."
              emptyMessage="No matching accounts found"
              badgeColor="purple"
            />
          </div>

          {/* Optional Filter Controls */}
          <div className="pt-3 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Layer Filter</label>
              <select
                value={layerFilter}
                onChange={(e) => setLayerFilter(e.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Layers</option>
                <option value="1">Layer 1 (Source / Primary)</option>
                <option value="2">Layer 2</option>
                <option value="3">Layer 3</option>
                <option value="4">Layer 4+</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Transaction Type</label>
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Types</option>
                <option value="INCOMING">Incoming Credits Only</option>
                <option value="OUTGOING">Outgoing Transfers Only</option>
                <option value="WITHDRAWAL">Cash Withdrawals (ATM/POS)</option>
                <option value="HOLD">Hold / Lien Events</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ================================================================
            PRIMARY STATE HANDLING: INITIAL LOADING, NO ACCOUNT, ERROR
        ================================================================ */}
        {loadingReport && !reportData && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center shadow-sm">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            <p className="mt-3 text-sm font-semibold text-[#172554]">
              Loading account activity…
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Extracting fund movements, timestamp velocity, and destination relationships.
            </p>
          </div>
        )}

        {!selectedAccount && !loadingReport && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center shadow-sm text-slate-500">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="font-semibold text-sm text-[#172554]">No Account Selected</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Please select an active Case, NCRP Workbook, and Suspicious Account above to generate this report.
            </p>
          </div>
        )}

        {reportError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
            <h3 className="font-bold text-sm">Unable to generate report</h3>
            <p className="text-xs mt-1">{reportError}</p>
            <button
              type="button"
              onClick={fetchReportData}
              className="mt-3 px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ================================================================
            REPORT BODY (SYNCHRONIZED ON CURRENT SELECTION)
        ================================================================ */}
        {reportData && (
          <div
            key={`report_body_${selectedFileId}_${selectedAccount}`}
            className="space-y-6 relative transition-opacity duration-200"
          >
            {/* Inline Loading Overlay when switching accounts */}
            {loadingReport && (
              <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center min-h-[300px]">
                <div className="bg-white px-5 py-3 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span className="text-xs font-semibold text-[#172554]">Loading account activity…</span>
                </div>
              </div>
            )}

            {/* ================================================================
                2. KPI CARDS (9 DYNAMIC METRICS)
            ================================================================ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Total Transactions
                </span>
                <div className="text-xl font-bold text-[#172554] mt-1">
                  {formatCount(kpis.total_transactions)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Unique recorded entries</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Total Incoming
                </span>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  {formatInr(kpis.total_incoming)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded credits received</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
                  Total Outgoing
                </span>
                <div className="text-xl font-bold text-rose-700 mt-1">
                  {formatInr(kpis.total_outgoing)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Transfers + cash-outs + debits</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Transfer Outflow
                </span>
                <div className="text-xl font-bold text-blue-700 mt-1">
                  {formatInr(kpis.transfer_outflow)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Inter-account transfers</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                  Cash Withdrawal
                </span>
                <div className="text-xl font-bold text-amber-700 mt-1">
                  {formatInr(kpis.cash_withdrawal)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">ATM / POS / Cheque</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">
                  Verified Held Amount
                </span>
                <div className="text-xl font-bold text-purple-700 mt-1">
                  {formatInr(kpis.verified_held_amount)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory lien reported</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                  Estimated Unresolved
                </span>
                <div className="text-xl font-bold text-indigo-700 mt-1">
                  {formatInr(kpis.estimated_unresolved_amount)}
                </div>
                <span className="text-[10px] text-indigo-500 mt-0.5 block">Estimate only (not bank bal)</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Linked Destinations
                </span>
                <div className="text-xl font-bold text-[#172554] mt-1">
                  {formatCount(kpis.linked_destination_accounts)}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Unique beneficiaries</span>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Last Recorded Activity
                </span>
                <div className="text-sm font-bold text-[#172554] mt-1 truncate">
                  {kpis.last_recorded_activity?.date || "Not Available"}
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block truncate">
                  {kpis.last_recorded_activity?.direction || "None"} • {formatInr(kpis.last_recorded_activity?.amount)}
                </span>
              </div>
            </div>

            {/* ================================================================
                3. SELECTED ACCOUNT PROFILE SUMMARY
            ================================================================ */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F1F5F9] pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#172554]">
                    Suspicious Account Profile Summary
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Aggregated analytical profile across all uploaded sheets.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                  Layer {(profile.layers || []).join(", ") || "1"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-[#64748B] block font-medium">Account Identifier</span>
                    {(profile.account || selectedAccount) && (
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(profile.account || selectedAccount)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold transition-colors flex items-center gap-1"
                        title="Copy full account number"
                      >
                        {copiedAccount ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                  <span className="font-bold text-[#172554] text-sm break-all font-mono select-all">
                    {(isAuthorizedInvestigator || revealAccount)
                      ? (profile.account || selectedAccount || "N/A")
                      : (profile.masked_account || "N/A")}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Bank Name</span>
                  <span className="font-bold text-[#172554] text-sm truncate block" title={profile.bank}>
                    {profile.bank}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Account Holder</span>
                  <span className="font-bold text-[#172554] text-sm truncate block" title={profile.holder_name}>
                    {profile.holder_name}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">First Activity Date</span>
                  <span className="font-bold text-[#172554] text-sm">
                    {profile.first_recorded_date || "N/A"}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Incoming Turnover</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatInr(profile.total_incoming)} ({profile.incoming_count} txs)
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Outgoing Turnover</span>
                  <span className="font-bold text-rose-700 text-sm">
                    {formatInr(profile.total_outgoing)} ({profile.outgoing_count} txs)
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Linked Beneficiary Accounts</span>
                  <span className="font-bold text-[#172554] text-sm">
                    {profile.linked_destinations_count} destinations
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-[#64748B] block">Records Requiring Verification</span>
                  <span className="font-bold text-amber-700 text-sm">
                    {profile.records_requiring_verification} unconfirmed UTRs
                  </span>
                </div>
              </div>
            </div>

            {/* ================================================================
                4. INCOMING VS OUTGOING ANALYSIS & GRAPH VISUALIZATION
            ================================================================ */}
            <div className="space-y-4">
              {/* Header with Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-[#172554]">
                    Fund Flow Analysis & Relationship Graph
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Visual representation of transaction velocity over time and direct account links.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setGraphViewMode("chart")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      graphViewMode === "chart"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    Timeline Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphViewMode("graph")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      graphViewMode === "graph"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    Relationship Graph
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphViewMode("both")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      graphViewMode === "both"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    Dual View
                  </button>
                </div>
              </div>

              {/* View 1: Timeline Chart View */}
              {(graphViewMode === "chart" || graphViewMode === "both") && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div
                    key={`chart_box_${selectedFileId}_${selectedAccount}`}
                    className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm flex flex-col relative min-h-[360px]"
                  >
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-[#172554]">
                          Incoming vs. Outgoing Timeline Comparison
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Daily fund flow volume comparing credits, transfer outflows, and cash withdrawals.
                        </p>
                      </div>
                    </div>

                    {(!reportData.incoming_vs_outgoing?.daily_timeline || reportData.incoming_vs_outgoing.daily_timeline.length === 0) ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#94A3B8]">
                        <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-xs font-semibold text-slate-600">
                          No graph data is available for this account in the selected workbook.
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1">
                          No credit, transfer, or cash withdrawal timeline entries were recorded for this account.
                        </span>
                      </div>
                    ) : (
                      <div ref={chartRef} className="w-full h-72 flex-1" />
                    )}
                  </div>

                  {/* Summary Table */}
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#172554] border-b border-[#F1F5F9] pb-3 mb-3">
                        Turnover Breakdown Table
                      </h3>
                      <div className="divide-y divide-slate-100 text-xs">
                        {(reportData.incoming_vs_outgoing?.summary_table || []).map((row, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between">
                            <span className="text-[#64748B]">{row.metric}</span>
                            <span className="font-bold text-[#172554]">
                              {row.unit === "currency" ? formatInr(row.value) : formatCount(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-[#64748B]">
                      <strong>Audit Rule:</strong> Account-to-account transfer outflows are separated from cash-out dispersals (ATM/POS) to prevent conflating electronic hops with physical cash drainage.
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Account Relationship Graph View */}
              {(graphViewMode === "graph" || graphViewMode === "both") && (
                <div
                  key={`graph_box_${selectedFileId}_${selectedAccount}`}
                  className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#172554]">
                        Account Fund Flow & Exit Relationship Graph
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Multi-layer topology showing source remitters (Left), the subject account (Center), and exit destinations (Right).
                      </p>
                    </div>
                  </div>

                  {graphNodes.length === 0 ? (
                    <div className="p-12 text-center text-xs text-[#94A3B8]">
                      No graph data is available for this account in the selected workbook.
                    </div>
                  ) : (
                    <div className="h-[460px] rounded-xl overflow-hidden border border-slate-200">
                      <NcrpTraceabilityGraph
                        nodes={graphNodes}
                        edges={graphEdges}
                        selectedAccount={selectedAccount}
                        maskAccounts={!revealAccount}
                        fitTrigger={fitTrigger}
                        isFullscreen={isGraphFullscreen}
                        onToggleFullscreen={() => setIsGraphFullscreen(!isGraphFullscreen)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ================================================================
                5. CHRONOLOGICAL TRANSACTION TIMELINE
            ================================================================ */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[#172554]">
                    Chronological Transaction Timeline
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Complete sequential audit of all entries involving this account.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={timelineSearch}
                    onChange={(e) => {
                      setTimelineSearch(e.target.value);
                      setTimelinePage(1);
                    }}
                    placeholder="Search UTR, account, bank..."
                    className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#172554] placeholder-[#94A3B8] outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setTimelineSortOrder(timelineSortOrder === "asc" ? "desc" : "asc")}
                    className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#334155] hover:bg-slate-50"
                  >
                    Sort: {timelineSortOrder === "asc" ? "Oldest First ↑" : "Newest First ↓"}
                  </button>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1E293B]">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Sender / Beneficiary</th>
                      <th className="py-2.5 px-3">UTR / Ref No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Layer</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Source Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTimeline.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-xs text-[#94A3B8]">
                          No transactions found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedTimeline.map((t) => {
                        const isInc = t.direction === "INCOMING";
                        const isOut = t.direction === "OUTGOING";
                        const isWith = t.direction === "WITHDRAWAL";
                        const isHold = t.direction === "HOLD";

                        const badgeClass = isInc
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : isOut
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : isWith
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : isHold
                          ? "bg-purple-50 text-purple-800 border-purple-200"
                          : "bg-slate-50 text-slate-800 border-slate-200";

                        const senderDisplay = revealAccount ? t.sender_account : t.sender_account_masked;
                        const beneDisplay = revealAccount ? t.beneficiary_account : t.beneficiary_account_masked;

                        return (
                          <tr key={t.id + t.direction} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-[#172554] block">
                                {t.date || "N/A"}
                              </span>
                              {t.datetime && (
                                <span className="text-[10px] text-[#64748B] block">{t.datetime}</span>
                              )}
                              {t.is_after_major_credit && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[9px] font-bold">
                                  Post-Credit
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${badgeClass}`}>
                                {t.direction_label}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`font-bold ${isInc ? "text-emerald-700" : isWith ? "text-amber-700" : isHold ? "text-purple-700" : "text-blue-700"}`}>
                                {formatInr(t.amount)}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 max-w-xs truncate">
                              {isInc ? (
                                <div>
                                  <span className="font-semibold text-[#172554] block truncate">
                                    From: {senderDisplay}
                                  </span>
                                  <span className="text-[10px] text-[#64748B] block truncate">
                                    {t.sender_bank}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-[#172554] block truncate">
                                    To: {beneDisplay}
                                  </span>
                                  <span className="text-[10px] text-[#64748B] block truncate">
                                    {t.beneficiary_bank}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#334155] whitespace-nowrap">
                              {t.utr || <span className="text-amber-600 font-sans italic">Pending UTR</span>}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                {t.transaction_type}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              Layer {t.layer}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.link_status === "CONFIRMED"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-amber-50 text-amber-800"
                              }`}>
                                {t.link_status}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-[#64748B] text-[11px] whitespace-nowrap">
                              {t.sheet_name} • #{t.row_number}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ReportTablePagination
                currentPage={timelinePage}
                pageSize={timelinePageSize}
                totalItems={filteredTimeline.length}
                onPageChange={setTimelinePage}
                onPageSizeChange={setTimelinePageSize}
              />
            </div>

            {/* ================================================================
                6. RAPID FUND MOVEMENT ANALYSIS
            ================================================================ */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[#172554]">
                    Rapid Fund Movement Analysis
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Detects immediate subsequent outflows following incoming credits (Possible Temporal Association).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRapidThresholdFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      rapidThresholdFilter === "ALL"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-[#475569] hover:bg-slate-200"
                    }`}
                  >
                    All Pairs ({reportData.rapid_fund_movement?.records?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRapidThresholdFilter("15m")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      rapidThresholdFilter === "15m"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 text-[#475569] hover:bg-slate-200"
                    }`}
                  >
                    &lt; 15 mins ({reportData.rapid_fund_movement?.threshold_counts?.within_15_mins || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRapidThresholdFilter("1h")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      rapidThresholdFilter === "1h"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-[#475569] hover:bg-slate-200"
                    }`}
                  >
                    &lt; 1 hour ({reportData.rapid_fund_movement?.threshold_counts?.within_1_hour || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRapidThresholdFilter("24h")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      rapidThresholdFilter === "24h"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-[#475569] hover:bg-slate-200"
                    }`}
                  >
                    &lt; 24 hours ({reportData.rapid_fund_movement?.threshold_counts?.within_24_hours || 0})
                  </button>
                </div>
              </div>

              {paginatedRapid.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#94A3B8]">
                  No subsequent debit transactions found within this threshold.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E293B]">
                    <thead className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-2.5 px-3">Incoming Credit</th>
                        <th className="py-2.5 px-3">Subsequent Outflow</th>
                        <th className="py-2.5 px-3">Time Difference</th>
                        <th className="py-2.5 px-3">Exit Ratio</th>
                        <th className="py-2.5 px-3">Threshold Applied</th>
                        <th className="py-2.5 px-3">Association Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRapid.map((r) => (
                        <tr key={r.association_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-emerald-700 block">
                              {formatInr(r.incoming_amount)}
                            </span>
                            <span className="text-[10px] text-[#64748B] block">{r.incoming_date}</span>
                            <span className="font-mono text-[10px] text-slate-500 block truncate">
                              UTR: {r.incoming_utr}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-bold text-rose-700 block">
                              {formatInr(r.outgoing_amount)} ({r.outgoing_type})
                            </span>
                            <span className="text-[10px] text-[#64748B] block truncate">
                              To: {r.outgoing_dest} ({r.outgoing_dest_bank})
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 block truncate">
                              UTR: {r.outgoing_utr}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-[#172554] px-2 py-0.5 rounded bg-slate-100">
                              {r.time_gap_formatted}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-700">
                              {r.amount_ratio_pct}% of credit
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800">
                              {r.threshold_label}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold">
                              {r.link_status}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              {r.methodology_note}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <ReportTablePagination
                currentPage={rapidPage}
                pageSize={rapidPageSize}
                totalItems={filteredRapid.length}
                onPageChange={setRapidPage}
                onPageSizeChange={setRapidPageSize}
              />
            </div>

            {/* ================================================================
                7. EXIT ACTIVITY & DESTINATION ACCOUNTS
            ================================================================ */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
              <div className="border-b border-[#F1F5F9] pb-3">
                <h2 className="text-sm font-bold text-[#172554]">
                  Exit Activity & Destination Beneficiary Accounts
                </h2>
                <p className="text-xs text-[#64748B]">
                  Where funds moved out of the selected account and onward traceability status.
                </p>
              </div>

              {/* Top Destinations Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(reportData.exit_activity?.top_destinations || []).slice(0, 3).map((d, idx) => {
                  const display = revealAccount ? d.beneficiary_account : d.beneficiary_account_masked;
                  return (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Destination #{idx + 1}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          d.has_onward_transfers
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                        }`}>
                          {d.has_onward_transfers ? "Onward Logged" : "Terminal in Workbook"}
                        </span>
                      </div>
                      <div className="font-bold text-[#172554] text-sm truncate" title={display}>
                        {display}
                      </div>
                      <div className="text-xs text-[#64748B] truncate">{d.beneficiary_bank}</div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <span className="text-[#64748B]">{d.transfer_count} transfer(s)</span>
                        <span className="font-bold text-blue-700">{formatInr(d.total_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Destinations Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs text-[#1E293B]">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-2.5 px-3">Beneficiary Account</th>
                      <th className="py-2.5 px-3">Bank Name</th>
                      <th className="py-2.5 px-3">Transfer Amount</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">UTR Reference</th>
                      <th className="py-2.5 px-3">Layer</th>
                      <th className="py-2.5 px-3">Onward Trail Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDestinations.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-6 text-center text-xs text-[#94A3B8]">
                          No outgoing transfer destinations recorded.
                        </td>
                      </tr>
                    ) : (
                      paginatedDestinations.map((d, idx) => {
                        const display = revealAccount ? d.beneficiary_account : d.beneficiary_account_masked;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-[#172554]">{display}</td>
                            <td className="py-2.5 px-3 text-[#475569]">{d.beneficiary_bank}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-700">{formatInr(d.transfer_amount)}</td>
                            <td className="py-2.5 px-3 text-[#64748B] whitespace-nowrap">{d.transaction_date}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#334155]">{d.utr}</td>
                            <td className="py-2.5 px-3 text-[#64748B]">Layer {d.layer}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.has_onward_transfers
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-amber-50 text-amber-800"
                              }`}>
                                {d.onward_status_label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ReportTablePagination
                currentPage={destPage}
                pageSize={destPageSize}
                totalItems={allDestinations.length}
                onPageChange={setDestPage}
                onPageSizeChange={setDestPageSize}
              />
            </div>

            {/* ================================================================
                8. LAST TRACEABLE ACTIVITY & 9. AMOUNT RECONCILIATION
            ================================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Last Traceable Activity */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#172554]">
                    Last Traceable Activity Summary
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Latest recorded transactions and reasons why the available trail ends.
                  </p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between">
                    <span className="text-[#64748B]">Last Recorded Transaction:</span>
                    <span className="font-bold text-[#172554]">
                      {lastTrace.last_transaction?.date || "N/A"} ({lastTrace.last_transaction?.direction})
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between">
                    <span className="text-[#64748B]">Last Outgoing Transfer:</span>
                    <span className="font-bold text-blue-700">
                      {lastTrace.last_outgoing_transfer ? (
                        <>
                          {formatInr(lastTrace.last_outgoing_transfer.amount)} to {lastTrace.last_outgoing_transfer.destination_bank} ({lastTrace.last_outgoing_transfer.destination_account})
                        </>
                      ) : (
                        "No Outgoing Transfers"
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between">
                    <span className="text-[#64748B]">Last Cash Withdrawal:</span>
                    <span className="font-bold text-amber-700">
                      {lastTrace.last_cash_withdrawal ? (
                        <>
                          {formatInr(lastTrace.last_cash_withdrawal.amount)} ({lastTrace.last_cash_withdrawal.channel})
                        </>
                      ) : (
                        "None Recorded"
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between">
                    <span className="text-[#64748B]">Last Statutory Hold:</span>
                    <span className="font-bold text-purple-700">
                      {lastTrace.last_hold_event ? (
                        <>
                          {formatInr(lastTrace.last_hold_event.amount)} on {lastTrace.last_hold_event.date}
                        </>
                      ) : (
                        "None Recorded"
                      )}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                      Reason Available Trace Ends
                    </span>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      {lastTrace.reason_trace_ends}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount Reconciliation */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#172554]">
                    Amount Reconciliation
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Mathematical accounting formula across NCRP credit, debit, cash-out, and hold records.
                  </p>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-100">
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">(+) Total Incoming Credits</span>
                    <span className="font-bold text-emerald-700">{formatInr(recon.total_incoming_credits)}</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">(-) Recorded Outgoing Transfers</span>
                    <span className="font-bold text-blue-700">{formatInr(recon.recorded_outgoing_transfers)}</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">(-) Recorded Cash Withdrawals</span>
                    <span className="font-bold text-amber-700">{formatInr(recon.recorded_cash_withdrawals)}</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">(-) Recorded Other Debits</span>
                    <span className="font-bold text-slate-700">{formatInr(recon.recorded_other_debits)}</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">(-) Verified Held / Lien Amount</span>
                    <span className="font-bold text-purple-700">{formatInr(recon.verified_held_amount)}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between bg-indigo-50/60 px-3 rounded-lg border border-indigo-100 mt-2">
                    <span className="font-bold text-indigo-900">(=) Estimated Unresolved Amount</span>
                    <span className="font-bold text-indigo-900 text-sm">
                      {formatInr(recon.estimated_unresolved_amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#475569] space-y-1">
                    <div className="font-bold text-[#172554]">Formula & Forensic Note:</div>
                    <div>{recon.formula}</div>
                    <div className="italic text-[10px] text-slate-500">
                      * Estimated unresolved amount is an analytical metric of unlogged dispersals. It is NOT a live bank balance.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================
                10. SUSPICIOUS ACTIVITY INDICATORS
            ================================================================ */}
            

            {/* ================================================================
                11. DATA QUALITY & INVESTIGATION GAPS
            ================================================================ */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
              <div className="border-b border-[#F1F5F9] pb-3">
                <h2 className="text-sm font-bold text-[#172554]">
                  Data Quality & Investigation Gaps
                </h2>
                <p className="text-xs text-[#64748B]">
                  Unresolved UTRs, missing counterparty institutions, and evidence required to confirm the money trail.
                </p>
              </div>

              {paginatedGaps.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#94A3B8]">
                  No severe data quality gaps identified for this account.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E293B]">
                    <thead className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-2.5 px-3">Gap ID</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Affected Item</th>
                        <th className="py-2.5 px-3">Source Details</th>
                        <th className="py-2.5 px-3">Details</th>
                        <th className="py-2.5 px-3">Evidence Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedGaps.map((g) => (
                        <tr key={g.gap_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {g.gap_id}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-rose-700 whitespace-nowrap">
                            {g.category}
                          </td>
                          <td className="py-2.5 px-3 text-[#172554] font-medium">{g.affected_record}</td>
                          <td className="py-2.5 px-3 text-[#64748B] whitespace-nowrap">
                            {g.source_sheet} (Row #{g.source_row})
                          </td>
                          <td className="py-2.5 px-3 text-[#475569]">{g.details}</td>
                          <td className="py-2.5 px-3 font-medium text-emerald-800">{g.evidence_required}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <ReportTablePagination
                currentPage={gapsPage}
                pageSize={gapsPageSize}
                totalItems={allGaps.length}
                onPageChange={setGapsPage}
                onPageSizeChange={setGapsPageSize}
              />
            </div>

            {/* ================================================================
                12. SUGGESTED INVESTIGATIVE ACTIONS
            ================================================================ */}
            
          </div>
        )}
      </main>

      <UserFooter />
    </div>
  );
}
