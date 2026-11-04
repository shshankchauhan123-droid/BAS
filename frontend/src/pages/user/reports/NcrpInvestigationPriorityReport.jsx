import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCases } from "../../../services/api/case";
import { getCaseNcrpFiles, getNcrpInvestigationPriorityReport } from "../../../services/api/ncrp";
import { exportNcrpPriorityPdf } from "../../../utils/ncrpPriorityPdfExport";

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
        <span className="truncate pr-2">
          {selectedItem ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-[#172554] truncate" title={selectedItem.label}>
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
        <div className="absolute left-0 top-[calc(100%+4px)] max-h-64 w-full rounded-xl border border-[#CBD5E1] bg-white shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white py-1.5 pl-7 pr-2.5 text-xs text-[#172554] placeholder-[#94A3B8] outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-52 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#94A3B8]">{emptyMessage}</div>
            ) : (
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
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-emerald-50/60 ${
                      isSelected ? "bg-emerald-50 font-semibold text-emerald-800" : "text-[#1E293B]"
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2 min-w-0">
                      <span className="truncate font-semibold text-[#172554]" title={opt.label}>
                        {opt.label}
                      </span>
                      {opt.subtitle && (
                        <span className="text-[10px] text-[#64748B] truncate">{opt.subtitle}</span>
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
 * Reusable Pagination Controls for Report Tables
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
      {/* Showing indicator and page-size selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-[#172554]">{startItem}–{endItem}</strong> of{" "}
          <strong className="text-[#172554]">{totalItems}</strong> records
        </span>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <label className="text-[#64748B] text-[11px] whitespace-nowrap">
            Rows per page:
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              if (onPageSizeChange) {
                onPageSizeChange(newSize);
              }
            }}
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

      {/* Page navigation buttons */}
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1 || totalItems === 0}
          aria-label="First page"
          title="First page"
          className="px-2 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || totalItems === 0}
          aria-label="Previous page"
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
          aria-label="Next page"
          className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages || totalItems === 0}
          aria-label="Last page"
          title="Last page"
          className="px-2 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          »
        </button>
      </div>
    </div>
  );
}

export default function NcrpInvestigationPriorityReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Pickers state
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(searchParams.get("caseId") || "");
  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(searchParams.get("fileId") || "");
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  // Filters & Tabs in Triage table
  const [tierFilter, setTierFilter] = useState("ALL"); // ALL, CRITICAL, HIGH, MEDIUM, LOW
  const [accountSearch, setAccountSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("ALL");
  const [layerFilter, setLayerFilter] = useState("ALL");
  const [maskAccounts, setMaskAccounts] = useState(true);

  // Cash Dispersal active tab
  const [activeDispersalTab, setActiveDispersalTab] = useState("ATM"); // ATM, POS, CHEQUE, TRANSFERS

  // Methodology Modal state
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);

  // Evidence Drawer state
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState(null);

  // Charts references
  const distributionChartRef = useRef(null);

  // Table Pagination States (Default 10 rows per page)
  const [layerPage, setLayerPage] = useState(1);
  const [layerPageSize, setLayerPageSize] = useState(10);

  const [triagePage, setTriagePage] = useState(1);
  const [triagePageSize, setTriagePageSize] = useState(10);

  const [dispersalPage, setDispersalPage] = useState(1);
  const [dispersalPageSize, setDispersalPageSize] = useState(10);

  const [bankMatrixPage, setBankMatrixPage] = useState(1);
  const [bankMatrixPageSize, setBankMatrixPageSize] = useState(10);

  // 1. Load cases on mount
  useEffect(() => {
    async function fetchCasesList() {
      try {
        setLoadingCases(true);
        const res = await getCases();
        const list = res?.data || (Array.isArray(res) ? res : []);
        setCases(list);

        // Pre-select if passed in URL or single case
        const paramCase = searchParams.get("caseId");
        if (paramCase && list.some((c) => String(c.id) === String(paramCase))) {
          setSelectedCaseId(paramCase);
        } else if (list.length === 1 && !selectedCaseId) {
          setSelectedCaseId(String(list[0].id));
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
      } finally {
        setLoadingCases(false);
      }
    }
    fetchCasesList();
  }, []);

  // 2. Load NCRP workbooks when case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFiles([]);
      setSelectedFileId("");
      return;
    }

    async function fetchFiles() {
      try {
        setLoadingFiles(true);
        const res = await getCaseNcrpFiles(selectedCaseId);
        const files = Array.isArray(res) ? res : res?.data || [];
        setNcrpFiles(files);

        // Validate or select fileId
        const paramFile = searchParams.get("fileId");
        if (paramFile && files.some((f) => String(f.id) === String(paramFile))) {
          setSelectedFileId(paramFile);
        } else if (files.length > 0) {
          setSelectedFileId(String(files[0].id));
        } else {
          setSelectedFileId("");
        }
      } catch (err) {
        console.error("Failed to fetch NCRP files:", err);
        setNcrpFiles([]);
        setSelectedFileId("");
      } finally {
        setLoadingFiles(false);
      }
    }
    fetchFiles();
  }, [selectedCaseId]);

  // 3. Update searchParams
  useEffect(() => {
    const params = {};
    if (selectedCaseId) params.caseId = selectedCaseId;
    if (selectedFileId) params.fileId = selectedFileId;
    setSearchParams(params, { replace: true });
  }, [selectedCaseId, selectedFileId, setSearchParams]);

  // 4. Fetch Report Data
  const loadReportData = useCallback(async () => {
    if (!selectedFileId) {
      setReportData(null);
      return;
    }
    try {
      setLoadingReport(true);
      setReportError("");
      const res = await getNcrpInvestigationPriorityReport(selectedFileId, {
        caseId: selectedCaseId || undefined,
      });
      setReportData(res);
    } catch (err) {
      console.error("Error fetching investigation priority report:", err);
      setReportError(err?.message || "Failed to load Investigation Priority Report data.");
      setReportData(null);
    } finally {
      setLoadingReport(false);
    }
  }, [selectedFileId, selectedCaseId]);

  useEffect(() => {
    if (selectedFileId) {
      loadReportData();
    } else {
      setReportData(null);
    }
  }, [selectedFileId, loadReportData]);

  // Priority Distribution Chart
  useEffect(() => {
    if (!reportData || !distributionChartRef.current) return;
    const chartInstance = echarts.init(distributionChartRef.current);
    const dist = reportData.priority_distribution?.distribution || reportData.priority_distribution || {};

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = params[0];
          return `<div class="text-xs font-semibold">${item.name} Priority</div>
                  <div class="text-[11px] text-slate-600">Count: <b>${item.value}</b> items</div>`;
        },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: ["Critical (75-100)", "High (50-74)", "Medium (25-49)", "Low (0-24)"],
        axisLine: { lineStyle: { color: "#CBD5E1" } },
        axisLabel: { color: "#475569", fontSize: 11, fontWeight: "500" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#F1F5F9", type: "dashed" } },
        axisLabel: { color: "#64748B", fontSize: 10 },
      },
      series: [
        {
          name: "Items Count",
          type: "bar",
          barWidth: "40%",
          data: [
            {
              value: dist.critical?.count || 0,
              itemStyle: { color: "#E11D48", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: dist.high?.count || 0,
              itemStyle: { color: "#D97706", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: dist.medium?.count || 0,
              itemStyle: { color: "#2563EB", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: dist.low?.count || 0,
              itemStyle: { color: "#64748B", borderRadius: [6, 6, 0, 0] },
            },
          ],
        },
      ],
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [reportData]);



  // Filtered High Priority Items
  const filteredPriorityItems = useMemo(() => {
    if (!reportData || !reportData.high_priority_items) return [];
    return reportData.high_priority_items.filter((item) => {
      if (tierFilter !== "ALL" && item.tier !== tierFilter) return false;
      if (bankFilter !== "ALL" && item.bank_name !== bankFilter) return false;
      if (layerFilter !== "ALL" && item.layer !== layerFilter) return false;
      if (accountSearch.trim()) {
        const q = accountSearch.toLowerCase();
        const accMatch = item.account?.toLowerCase().includes(q);
        const bankMatch = item.bank_name?.toLowerCase().includes(q);
        const utrMatch = item.source_evidence?.utr?.toLowerCase().includes(q);
        const reasonMatch = item.reasons?.some((r) => r.toLowerCase().includes(q));
        if (!accMatch && !bankMatch && !utrMatch && !reasonMatch) return false;
      }
      return true;
    });
  }, [reportData, tierFilter, bankFilter, layerFilter, accountSearch]);

  // Distinct banks and layers for triage filter
  const distinctBanks = useMemo(() => {
    if (!reportData || !reportData.high_priority_items) return [];
    const set = new Set();
    reportData.high_priority_items.forEach((item) => {
      if (item.bank_name && item.bank_name !== "Unknown") set.add(item.bank_name);
    });
    return Array.from(set).sort();
  }, [reportData]);

  const distinctLayers = useMemo(() => {
    if (!reportData || !reportData.high_priority_items) return [];
    const set = new Set();
    reportData.high_priority_items.forEach((item) => {
      if (item.layer) set.add(item.layer);
    });
    return Array.from(set).sort();
  }, [reportData]);

  // Reset table pagination pages on case or workbook change
  useEffect(() => {
    setLayerPage(1);
    setTriagePage(1);
    setDispersalPage(1);
    setBankMatrixPage(1);
  }, [selectedCaseId, selectedFileId]);

  // Reset triage page when filters or search change
  useEffect(() => {
    setTriagePage(1);
  }, [tierFilter, bankFilter, layerFilter, accountSearch]);

  // Reset dispersal page when active dispersal tab changes
  useEffect(() => {
    setDispersalPage(1);
  }, [activeDispersalTab]);

  // Section C: Layer Heatmap Data & Slicing
  const layerHeatmapItems = useMemo(() => {
    return reportData?.layer_heatmap || reportData?.layer_risk_heatmap || [];
  }, [reportData]);

  const paginatedLayerHeatmap = useMemo(() => {
    const start = (layerPage - 1) * layerPageSize;
    return layerHeatmapItems.slice(start, start + layerPageSize);
  }, [layerHeatmapItems, layerPage, layerPageSize]);

  // Section D: Triage Table Slicing (operates on filteredPriorityItems)
  const paginatedPriorityItems = useMemo(() => {
    const start = (triagePage - 1) * triagePageSize;
    return filteredPriorityItems.slice(start, start + triagePageSize);
  }, [filteredPriorityItems, triagePage, triagePageSize]);

  // Section E: Cash Withdrawal & Dispersal Data & Slicing
  const activeDispersalItems = useMemo(() => {
    if (!reportData) return [];
    const cashSrc = reportData.cash_out_analysis || reportData.cash_withdrawals || {};
    if (activeDispersalTab === "ATM") return cashSrc.atm_withdrawals || [];
    if (activeDispersalTab === "POS") return cashSrc.pos_transactions || cashSrc.pos_withdrawals || [];
    if (activeDispersalTab === "CHEQUE") return cashSrc.cheque_withdrawals || [];
    return cashSrc.downstream_transfers || cashSrc.other_dispersals || [];
  }, [reportData, activeDispersalTab]);

  const paginatedDispersalItems = useMemo(() => {
    const start = (dispersalPage - 1) * dispersalPageSize;
    return activeDispersalItems.slice(start, start + dispersalPageSize);
  }, [activeDispersalItems, dispersalPage, dispersalPageSize]);

  // Section H: Bank Concentration Matrix Data & Slicing
  const bankMatrixItems = useMemo(() => {
    if (!reportData) return [];
    return reportData.risk_heatmap?.bank_matrix || reportData.investigation_risk_heatmap?.bank_concentration || [];
  }, [reportData]);

  const paginatedBankMatrix = useMemo(() => {
    const start = (bankMatrixPage - 1) * bankMatrixPageSize;
    return bankMatrixItems.slice(start, start + bankMatrixPageSize);
  }, [bankMatrixItems, bankMatrixPage, bankMatrixPageSize]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!reportData) return;
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Overview
      const ov = reportData.overview || {};
      const ovData = [
        ["ArthBODH - NCRP Investigation Priority Report", ""],
        ["Workbook", reportData.filename || "N/A"],
        ["Acknowledgement No", reportData.acknowledgement_no || "N/A"],
        ["Generated At", reportData.generated_at || new Date().toISOString()],
        [],
        ["Core Exposure Metric", "Amount (INR)"],
        ["Disputed Exposure (Corpus)", ov.disputed_amount || 0],
        ["Unique Traced Amount", ov.unique_traced_amount || 0],
        ["Immediate Cash-Out Amount", ov.cash_out_amount || 0],
        ["Verified Held Amount", ov.verified_held_amount || 0],
        ["Net Unsecured Exposure", ov.unsecured_exposure || 0],
        [],
        ["Priority Tier", "Count"],
        ["Critical (75-100)", ov.critical_count || 0],
        ["High (50-74)", ov.high_count || 0],
        ["Medium (25-49)", ov.medium_count || 0],
        ["Low (0-24)", ov.low_count || 0],
        ["Identified Gaps Count", ov.identified_gaps_count || 0],
        ["High Priority Actions", ov.high_priority_actions_count || 0],
      ];
      const wsOv = XLSX.utils.aoa_to_sheet(ovData);
      XLSX.utils.book_append_sheet(wb, wsOv, "Overview");

      // Sheet 2: Priority Items
      const priData = (reportData.high_priority_items || []).map((item, idx) => ({
        Rank: idx + 1,
        Score: item.score,
        Tier: item.tier,
        Account: item.account,
        Bank: item.bank_name,
        Layer: item.layer,
        EventType: item.event_type,
        Amount: item.amount,
        MatchConfidence: item.confidence,
        SourceSheet: item.source_evidence?.sheet,
        SourceRow: item.source_evidence?.row,
        UTR: item.source_evidence?.utr,
        FactorCashOut: item.factor_breakdown?.cash_out,
        FactorUnsecured: item.factor_breakdown?.unsecured_exposure,
        FactorComplexity: item.factor_breakdown?.complexity,
        FactorPatterns: item.factor_breakdown?.patterns,
        FactorUrgency: item.factor_breakdown?.urgency,
        PrimaryReason: item.primary_reason,
        AllReasons: item.reasons?.join(" | "),
      }));
      const wsPri = XLSX.utils.json_to_sheet(priData);
      XLSX.utils.book_append_sheet(wb, wsPri, "Priority Triage");

      // Sheet 3: Layer Risk Heatmap
      const layerData = (reportData.layer_heatmap || reportData.layer_risk_heatmap || []).map((l) => ({
        Layer: l.layer,
        AccountsCount: l.accounts_count,
        BanksCount: (l.banks || []).length,
        BanksList: (l.banks || []).join(", "),
        UniqueTracedAmount: l.unique_traced_amount,
        CashOutAmount: l.cash_out_amount,
        VerifiedHeldAmount: l.verified_held_amount,
        HoldStatus: l.has_verified_hold ? "HELD" : "UNSECURED",
        CriticalCount: l.critical_count,
        HighCount: l.high_count,
        MissingEvidenceSummary: l.missing_evidence_summary,
      }));
      const wsLayer = XLSX.utils.json_to_sheet(layerData);
      XLSX.utils.book_append_sheet(wb, wsLayer, "Layer Heatmap");

      // Sheet 4: Investigation Gaps
      const gapData = (reportData.investigation_gaps || []).map((g) => ({
        Bank: g.bank_name,
        Account: g.account,
        Layer: g.layer,
        MissingEvidence: g.missing_evidence,
        WhyItMatters: g.why_it_matters,
        RecommendedAction: g.recommended_action,
        Priority: g.priority,
      }));
      const wsGap = XLSX.utils.json_to_sheet(gapData);
      XLSX.utils.book_append_sheet(wb, wsGap, "Investigation Gaps");

      // Sheet 5: Recommended Actions
      const actData = (reportData.recommended_actions || []).map((a, idx) => ({
        Step: idx + 1,
        Urgency: a.urgency,
        Action: a.action,
        TargetEntity: a.target_entity,
        Account: a.account,
        EvidenceBasis: a.evidence_basis,
      }));
      const wsAct = XLSX.utils.json_to_sheet(actData);
      XLSX.utils.book_append_sheet(wb, wsAct, "Action Plan");

      // Save file
      const fileName = `NCRP_Priority_Report_${reportData.case_id || "Case"}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      Swal.fire({
        icon: "success",
        title: "Excel Exported Successfully",
        text: `Saved as ${fileName}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Export Excel error:", err);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text: err?.message || "Could not generate Excel spreadsheet.",
      });
    }
  };

  // PDF Export Handler
  const handleExportPdf = async () => {
    if (!reportData) return;
    try {
      const activeCase = cases.find((c) => String(c.id) === String(selectedCaseId));
      await exportNcrpPriorityPdf(reportData, activeCase, {
        filename: `NCRP_Priority_Report_${reportData.case_id || "Case"}_${Date.now()}.pdf`,
      });
      Swal.fire({
        icon: "success",
        title: "PDF Generated",
        text: "The Priority Report PDF has been downloaded successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      Swal.fire({
        icon: "error",
        title: "PDF Export Failed",
        text: err?.message || "Unable to generate PDF.",
      });
    }
  };

  const caseOptions = useMemo(() => {
    return cases.map((c) => ({
      id: c.id,
      label: c.case_number || `Case #${c.id}`,
      subtitle: c.case_name || "",
      badge: c.status || "ACTIVE",
    }));
  }, [cases]);

  const fileOptions = useMemo(() => {
    return ncrpFiles.map((f) => {
      // 1. Resolve actual uploaded filename from backend fields with safe fallback
      const rawName = f?.original_filename || f?.filename || f?.file_name;
      const displayFilename =
        typeof rawName === "string" && rawName.trim()
          ? rawName.trim()
          : `Unnamed NCRP Workbook (${f?.id ? `#${f.id}` : "Unknown ID"})`;

      // 2. Build subtitle details (Ack number if available, row count, file ID to distinguish duplicates)
      const subParts = [];
      if (f?.acknowledgement_no) {
        subParts.push(`Ack: ${f.acknowledgement_no}`);
      }
      if (f?.total_rows !== undefined && f?.total_rows !== null && f.total_rows > 0) {
        subParts.push(`${f.total_rows} rows`);
      } else if (f?.imported_rows !== undefined && f?.imported_rows !== null && f.imported_rows > 0) {
        subParts.push(`${f.imported_rows} rows`);
      }
      if (f?.id) {
        subParts.push(`ID: #${f.id}`);
      }

      // 3. Format badge (formatted upload date or status)
      const uploadDateStr = f?.created_at || f?.upload_date;
      let badge = "";
      if (uploadDateStr) {
        try {
          const d = new Date(uploadDateStr);
          if (!isNaN(d.getTime())) {
            badge = d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          }
        } catch {
          badge = "";
        }
      }
      if (!badge && f?.status) {
        badge = String(f.status);
      }

      return {
        id: f.id,
        label: displayFilename,
        subtitle: subParts.join(" • "),
        badge,
      };
    });
  }, [ncrpFiles]);

  const overview = reportData?.overview || {};

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <BASNavbar />

      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumb & Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <button
                type="button"
                onClick={() => navigate("/dashboard/reports/ncrp-hub")}
                className="hover:text-emerald-700 flex items-center gap-1 font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                NCRP Reports Hub
              </button>
              <span>/</span>
              <span className="font-semibold text-[#172554]">Report 05: NCRP Investigation Priority</span>
            </div>
            <h1 className="text-2xl font-black text-[#172554] tracking-tight">
              NCRP Investigation Priority Report
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Automated 0–100 forensic prioritization scoring across all 6 NCRP worksheets with explainable rationale and actionable next steps.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowMethodologyModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Scoring Methodology
            </button>
            <button
              type="button"
              disabled={!reportData || loadingReport}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
            <button
              type="button"
              disabled={!reportData || loadingReport}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              label="Investigation Case"
              stepNumber="1"
              value={selectedCaseId}
              options={caseOptions}
              onSelect={(id) => {
                setSelectedCaseId(id);
                setSelectedFileId("");
              }}
              placeholder="Select an active case..."
              searchPlaceholder="Search case number or name..."
              loading={loadingCases}
              badgeColor="emerald"
            />
            <SearchableSelect
              label="NCRP Workbook"
              stepNumber="2"
              value={selectedFileId}
              options={fileOptions}
              onSelect={(id) => setSelectedFileId(id)}
              placeholder="Select an uploaded NCRP workbook..."
              searchPlaceholder="Search filename or ack number..."
              loading={loadingFiles}
              disabled={!selectedCaseId || loadingFiles}
              emptyMessage="No NCRP workbooks uploaded for this case"
              badgeColor="purple"
            />
          </div>
        </div>

        {/* Legal & Decision Support Banner */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 flex items-start gap-3">
          <div className="p-1 bg-rose-100 rounded-lg shrink-0 mt-0.5 text-rose-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-rose-950 uppercase tracking-wider text-[11px] mr-1.5">
              Investigation Decision Support:
            </span>
            <span>
              This report prioritizes accounts, transactions, and fund-flow events to assist Law Enforcement Agencies in triage. It does not constitute a final legal adjudication of fraud or recoverability. Uncertain links are discounted by 40% in scoring.
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loadingReport && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent mb-4" />
            <h3 className="text-base font-bold text-[#172554]">Calculating Investigation Priorities...</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-md text-center">
              Normalizing transactions across all 6 worksheets, tracing fund-flow chains, evaluating cash-outs and unsecured exposure, and scoring triage items.
            </p>
          </div>
        )}

        {/* Error State */}
        {!loadingReport && reportError && (
          <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-rose-900">Failed to load Investigation Priority Report</h3>
            <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">{reportError}</p>
            <button
              type="button"
              onClick={loadReportData}
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loadingReport && !reportError && !reportData && (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#64748B] mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#172554]">Select a Case and NCRP Workbook</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
              Please choose an active investigation case and an uploaded NCRP spreadsheet above to generate the priority analysis.
            </p>
          </div>
        )}

        {/* Report Content */}
        {!loadingReport && !reportError && reportData && (
          <div className="space-y-6">
            {/* SECTION A: Overview Dashboard Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[#172554] uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Section A: Overview & Exposure Breakdown
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaskAccounts((prev) => !prev)}
                    className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {maskAccounts ? "Unmask Accounts" : "Mask Accounts"}
                  </button>
                  <span className="text-[11px] text-[#64748B] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Ack No: <b className="text-[#172554]">{reportData.acknowledgement_no || "N/A"}</b>
                  </span>
                </div>
              </div>

              {/* 5 Core Exposure Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Disputed Exposure */}
                <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm hover:border-blue-300 transition-all">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                    Disputed Exposure
                  </div>
                  <div className="text-xl font-black text-[#172554] mt-1">
                    ₹{formatIndianCurrency(overview.disputed_amount)}
                  </div>
                  <div className="text-[10px] text-blue-600 mt-1 font-medium">
                    Original Victim Complaint
                  </div>
                </div>

                {/* Unique Traced */}
                <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm hover:border-emerald-300 transition-all">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                    Unique Traced
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    ₹{formatIndianCurrency(overview.unique_traced_amount)}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-1 font-medium">
                    {overview.coverage_pct}% of Disputed Corpus
                  </div>
                </div>

                {/* Immediate Cash-Out */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm hover:border-rose-400 transition-all">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    Immediate Cash-Out
                  </div>
                  <div className="text-xl font-black text-rose-600 mt-1">
                    ₹{formatIndianCurrency(overview.cash_out_amount)}
                  </div>
                  <div className="text-[10px] text-rose-700 mt-1 font-medium">
                    ATM, POS, Cheque & Other
                  </div>
                </div>

                {/* Verified Held */}
                <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-sm hover:border-teal-400 transition-all">
                  <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                    Verified Held Amount
                  </div>
                  <div className="text-xl font-black text-teal-700 mt-1">
                    ₹{formatIndianCurrency(overview.verified_held_amount)}
                  </div>
                  <div className="text-[10px] text-teal-700 mt-1 font-medium">
                    Secured by Banks on Hold
                  </div>
                </div>

                {/* Net Unsecured Exposure */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm hover:border-amber-400 transition-all">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Net Unsecured
                  </div>
                  <div className="text-xl font-black text-amber-700 mt-1">
                    ₹{formatIndianCurrency(overview.unsecured_exposure)}
                  </div>
                  <div className="text-[10px] text-amber-800 mt-1 font-medium">
                    Active Recovery Risk
                  </div>
                </div>
              </div>

              {/* Triage Count Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
                <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-rose-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-600" /> Critical
                  </span>
                  <span className="font-black text-rose-600">{overview.critical_count || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-600" /> High
                  </span>
                  <span className="font-black text-amber-600">{overview.high_count || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-blue-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600" /> Medium
                  </span>
                  <span className="font-black text-blue-600">{overview.medium_count || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> Low
                  </span>
                  <span className="font-black text-slate-600">{overview.low_count || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/50 px-3 py-2 text-xs">
                  <span className="font-semibold text-purple-900">Identified Gaps</span>
                  <span className="font-black text-purple-700">{overview.identified_gaps_count || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs">
                  <span className="font-semibold text-emerald-900">Action Items</span>
                  <span className="font-black text-emerald-700">{overview.high_priority_actions_count || 0}</span>
                </div>
              </div>
            </div>

            {/* SECTION I: Evidence-Grounded Investigation Summary */}
            {reportData.investigation_summary && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1 rounded-md bg-blue-100 text-blue-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </span>
                  <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Executive Investigation Summary
                  </h3>
                </div>
                <p className="text-xs font-semibold text-[#172554] leading-relaxed">
                  {reportData.investigation_summary.headline}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {(reportData.investigation_summary.key_findings || []).map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#334155]">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SECTION B: Priority Distribution */}
            <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  Section B: Priority Distribution
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  Total Events: <b>{reportData.priority_distribution?.total_items || 0}</b>
                </span>
              </div>
              <div ref={distributionChartRef} className="h-64 w-full" />
            </div>

            {/* SECTION C: Layer-wise Risk Heatmap */}
            <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Section C: Layer-wise Risk Heatmap & Evidence Coverage
                </h3>
                <span className="text-xs text-[#64748B]">
                  Evaluates progression from Victim → Layer 1 → Downstream Cash-Outs
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                      <th className="py-2.5 px-3">Layer</th>
                      <th className="py-2.5 px-3 text-center">Accounts</th>
                      <th className="py-2.5 px-3">Connected Banks</th>
                      <th className="py-2.5 px-3 text-right">Unique Traced</th>
                      <th className="py-2.5 px-3 text-right">Cash-Out Amount</th>
                      <th className="py-2.5 px-3 text-center">Hold Status</th>
                      <th className="py-2.5 px-3 text-center">Critical</th>
                      <th className="py-2.5 px-3 text-center">High</th>
                      <th className="py-2.5 px-3">Investigation Gaps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {layerHeatmapItems.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-6 text-center text-xs text-[#94A3B8]">
                          No layer risk data available for this workbook.
                        </td>
                      </tr>
                    ) : (
                      paginatedLayerHeatmap.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#172554]">{row.layer}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#334155]">
                            {row.accounts_count}
                          </td>
                          <td className="py-2.5 px-3 text-[#475569]">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {(row.banks || []).slice(0, 3).map((b, bIdx) => (
                                <span key={bIdx} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                                  {b}
                                </span>
                              ))}
                              {(row.banks || []).length > 3 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  +{(row.banks || []).length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            ₹{formatIndianCurrency(row.unique_traced_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                            ₹{formatIndianCurrency(row.cash_out_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.has_verified_hold ? (
                              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold text-teal-800">
                                HELD (₹{formatIndianCurrency(row.verified_held_amount)})
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                                UNSECURED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                            {row.critical_count}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-600">
                            {row.high_count}
                          </td>
                          <td className="py-2.5 px-3 text-[#64748B] text-[11px]">
                            {row.missing_evidence_summary || "Complete"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section C Pagination */}
              <ReportTablePagination
                currentPage={layerPage}
                pageSize={layerPageSize}
                totalItems={layerHeatmapItems.length}
                onPageChange={setLayerPage}
                onPageSizeChange={(newSize) => {
                  setLayerPageSize(newSize);
                  setLayerPage(1);
                }}
              />
            </div>

            {/* SECTION D: High-Priority Transactions & Accounts (Triage Table) */}
            <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Section D: High-Priority Accounts & Transactions
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Forensic prioritization ranked by 0–100 score. Click any row to inspect raw transaction evidence.
                  </p>
                </div>

                {/* Triage Tier Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTierFilter(tier)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        tierFilter === tier
                          ? tier === "CRITICAL"
                            ? "bg-rose-600 text-white shadow-sm"
                            : tier === "HIGH"
                            ? "bg-amber-600 text-white shadow-sm"
                            : tier === "MEDIUM"
                            ? "bg-blue-600 text-white shadow-sm"
                            : tier === "LOW"
                            ? "bg-slate-600 text-white shadow-sm"
                            : "bg-[#172554] text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search and Secondary Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search account, bank, UTR, or reason..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="rounded-xl border border-[#DCE5EF] px-3 py-1.5 text-xs text-[#172554] placeholder-[#94A3B8] outline-none focus:border-emerald-500"
                />
                <select
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="rounded-xl border border-[#DCE5EF] px-3 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Banks</option>
                  {distinctBanks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select
                  value={layerFilter}
                  onChange={(e) => setLayerFilter(e.target.value)}
                  className="rounded-xl border border-[#DCE5EF] px-3 py-1.5 text-xs text-[#172554] outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Layers</option>
                  {distinctLayers.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Triage Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                      <th className="py-2.5 px-3 text-center">Score</th>
                      <th className="py-2.5 px-3">Account & Bank</th>
                      <th className="py-2.5 px-3 text-center">Layer</th>
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Priority Evidence Rationale</th>
                      <th className="py-2.5 px-3 text-center">Confidence</th>
                      <th className="py-2.5 px-3">Source Evidence</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredPriorityItems.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-xs text-[#94A3B8]">
                          No suspect accounts or transactions match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedPriorityItems.map((item, idx) => {
                        const isCritical = item.tier === "CRITICAL";
                        const isHigh = item.tier === "HIGH";
                        const isMedium = item.tier === "MEDIUM";

                        const dispAccount = maskAccounts
                          ? maskAccountNumber(item.account)
                          : item.account;

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedEvidenceItem(item)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-black rounded-lg px-2 py-1 text-xs ${
                                  isCritical
                                    ? "bg-rose-100 text-rose-800"
                                    : isHigh
                                    ? "bg-amber-100 text-amber-800"
                                    : isMedium
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {item.score}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#172554]">{dispAccount}</div>
                              <div className="text-[10px] text-[#64748B]">{item.bank_name || "Unknown"}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-[#334155]">
                              {item.layer}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-[#172554]">{item.event_type}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-[#172554]">
                              ₹{formatIndianCurrency(item.amount)}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="text-[11px] font-semibold text-[#172554] line-clamp-1">
                                {item.primary_reason || item.reasons?.[0]}
                              </div>
                              <div className="text-[10px] text-[#64748B] flex flex-wrap gap-1 mt-0.5">
                                {item.factor_breakdown && (
                                  <span>
                                    CashOut: {item.factor_breakdown.cash_out}/25 | Unsecured: {item.factor_breakdown.unsecured_exposure}/25
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  item.confidence === "CONFIRMED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : item.confidence === "PROBABLE"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {item.confidence}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[10px] text-[#64748B]">
                              <div>{item.source_evidence?.sheet}</div>
                              {item.source_evidence?.row && (
                                <div>Row: {item.source_evidence.row}</div>
                              )}
                              {item.source_evidence?.utr && (
                                <div className="font-mono text-[9px] truncate max-w-[100px]">
                                  {item.source_evidence.utr}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvidenceItem(item);
                                }}
                                className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition-colors"
                                title="View Raw Transaction Evidence"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section D Pagination */}
              <ReportTablePagination
                currentPage={triagePage}
                pageSize={triagePageSize}
                totalItems={filteredPriorityItems.length}
                onPageChange={setTriagePage}
                onPageSizeChange={(newSize) => {
                  setTriagePageSize(newSize);
                  setTriagePage(1);
                }}
              />
            </div>

            {/* SECTION E: Cash Withdrawal & Dispersal Analysis */}
            <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Section E: Cash Withdrawal & Dispersal Analysis
                </h3>

                {/* Tabs */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: "ATM", label: "ATM Withdrawals", count: (reportData.cash_out_analysis?.atm_withdrawals || reportData.cash_withdrawals?.atm_withdrawals || []).length },
                    { id: "POS", label: "POS Terminals", count: (reportData.cash_out_analysis?.pos_transactions || reportData.cash_out_analysis?.pos_withdrawals || reportData.cash_withdrawals?.pos_withdrawals || []).length },
                    { id: "CHEQUE", label: "Cheque Dispersals", count: (reportData.cash_out_analysis?.cheque_withdrawals || reportData.cash_withdrawals?.cheque_withdrawals || []).length },
                    { id: "TRANSFERS", label: "Downstream Transfers", count: (reportData.cash_out_analysis?.downstream_transfers || reportData.cash_out_analysis?.other_dispersals || reportData.cash_withdrawals?.other_dispersals || []).length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDispersalTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        activeDispersalTab === tab.id
                          ? "bg-rose-100 text-rose-800 border border-rose-300 font-bold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Dispersal Content based on active tab */}
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                      <th className="py-2 px-3">Date & Time</th>
                      <th className="py-2 px-3">Account & Bank</th>
                      <th className="py-2 px-3">Layer</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      {activeDispersalTab === "ATM" && <th className="py-2 px-3">ATM ID / Location</th>}
                      {activeDispersalTab === "POS" && <th className="py-2 px-3">Merchant / Terminal ID</th>}
                      {activeDispersalTab === "CHEQUE" && <th className="py-2 px-3">Cheque No & Payee</th>}
                      {activeDispersalTab === "TRANSFERS" && <th className="py-2 px-3">Remarks / Description</th>}
                      <th className="py-2 px-3">Investigation Urgency / Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {activeDispersalItems.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-xs text-[#94A3B8]">
                          No {activeDispersalTab} dispersal transactions reported in this NCRP workbook.
                        </td>
                      </tr>
                    ) : (
                      paginatedDispersalItems.map((w, wIdx) => (
                        <tr key={wIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-[11px] text-[#334155]">{w.date || "-"}</td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-[#172554]">
                              {maskAccounts ? maskAccountNumber(w.account) : w.account}
                            </div>
                            <div className="text-[10px] text-[#64748B]">{w.bank || "Unknown"}</div>
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#334155]">{w.layer}</td>
                          <td className="py-2 px-3 text-right font-black text-rose-600">
                            ₹{formatIndianCurrency(w.amount)}
                          </td>
                          {activeDispersalTab === "ATM" && (
                            <td className="py-2 px-3 text-[#475569]">{w.atm_id || w.location || "N/A"}</td>
                          )}
                          {activeDispersalTab === "POS" && (
                            <td className="py-2 px-3 text-[#475569]">{w.merchant || w.terminal_id || "N/A"}</td>
                          )}
                          {activeDispersalTab === "CHEQUE" && (
                            <td className="py-2 px-3 text-[#475569]">{w.cheque_no || w.payee || "N/A"}</td>
                          )}
                          {activeDispersalTab === "TRANSFERS" && (
                            <td className="py-2 px-3 text-[#475569]">{w.remarks || "Direct transfer"}</td>
                          )}
                          <td className="py-2 px-3 font-semibold text-rose-800 text-[11px]">
                            {w.recommended_lead || "Subpoena CCTV / Terminal Logs"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section E Pagination */}
              <ReportTablePagination
                currentPage={dispersalPage}
                pageSize={dispersalPageSize}
                totalItems={activeDispersalItems.length}
                onPageChange={setDispersalPage}
                onPageSizeChange={(newSize) => {
                  setDispersalPageSize(newSize);
                  setDispersalPage(1);
                }}
              />
            </div>

            {/* SECTION F & G: Bank Gaps & Actionable Next Steps */}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SECTION F: Bank-wise Investigation Gaps */}
              
            </div>

            {/* SECTION H: Bank Risk Concentration Matrix */}
            {(reportData.risk_heatmap?.bank_matrix || reportData.investigation_risk_heatmap?.bank_concentration) && (
              <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
                <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Section H: Bank Concentration & Exposure Matrix
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                        <th className="py-2.5 px-3">Bank Name</th>
                        <th className="py-2.5 px-3 text-center">Accounts</th>
                        <th className="py-2.5 px-3 text-right">Traced Exposure</th>
                        <th className="py-2.5 px-3 text-right">Cash-Out Amount</th>
                        <th className="py-2.5 px-3 text-right">Verified Held</th>
                        <th className="py-2.5 px-3 text-right">Unsecured Risk</th>
                        <th className="py-2.5 px-3 text-center">Triage Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {bankMatrixItems.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-6 text-center text-xs text-[#94A3B8]">
                            No bank exposure matrix data available.
                          </td>
                        </tr>
                      ) : (
                        paginatedBankMatrix.map((bm, bIdx) => (
                          <tr key={bIdx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#172554]">{bm.bank_name}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-[#475569]">{bm.accounts_count}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#172554]">
                              ₹{formatIndianCurrency(bm.total_traced_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                              ₹{formatIndianCurrency(bm.cash_out_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-teal-700">
                              ₹{formatIndianCurrency(bm.verified_held_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                              ₹{formatIndianCurrency(bm.unsecured_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {bm.unsecured_amount > 0 ? (
                                <span className="rounded bg-rose-100 text-rose-800 px-2 py-0.5 text-[9px] font-bold">
                                  UNSECURED
                                </span>
                              ) : (
                                <span className="rounded bg-teal-100 text-teal-800 px-2 py-0.5 text-[9px] font-bold">
                                  FULLY HELD
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Section H Pagination */}
                <ReportTablePagination
                  currentPage={bankMatrixPage}
                  pageSize={bankMatrixPageSize}
                  totalItems={bankMatrixItems.length}
                  onPageChange={setBankMatrixPage}
                  onPageSizeChange={(newSize) => {
                    setBankMatrixPageSize(newSize);
                    setBankMatrixPage(1);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <UserFooter />

      {/* Raw Evidence Drawer / Modal */}
      {selectedEvidenceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#172554]">
                  Transaction Evidence Breakdown
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Source worksheet record details and scoring attribution
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidenceItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Account</span>
                  <div className="font-bold text-[#172554]">{selectedEvidenceItem.account}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Bank</span>
                  <div className="font-bold text-[#172554]">{selectedEvidenceItem.bank_name || "Unknown"}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Amount</span>
                  <div className="font-bold text-rose-600">₹{formatIndianCurrency(selectedEvidenceItem.amount)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Priority Score</span>
                  <div className="font-black text-[#172554]">{selectedEvidenceItem.score} / 100 ({selectedEvidenceItem.tier})</div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-[#172554] mb-1">Factor Attribution (Weights)</h4>
                <div className="grid grid-cols-5 gap-1 text-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="p-1">
                    <div className="text-[9px] text-slate-500 font-bold">Cash-Out</div>
                    <div className="text-xs font-bold text-rose-700">{selectedEvidenceItem.factor_breakdown?.cash_out || 0}/25</div>
                  </div>
                  <div className="p-1">
                    <div className="text-[9px] text-slate-500 font-bold">Unsecured</div>
                    <div className="text-xs font-bold text-amber-700">{selectedEvidenceItem.factor_breakdown?.unsecured_exposure || 0}/25</div>
                  </div>
                  <div className="p-1">
                    <div className="text-[9px] text-slate-500 font-bold">Complexity</div>
                    <div className="text-xs font-bold text-blue-700">{selectedEvidenceItem.factor_breakdown?.complexity || 0}/20</div>
                  </div>
                  <div className="p-1">
                    <div className="text-[9px] text-slate-500 font-bold">Patterns</div>
                    <div className="text-xs font-bold text-purple-700">{selectedEvidenceItem.factor_breakdown?.patterns || 0}/20</div>
                  </div>
                  <div className="p-1">
                    <div className="text-[9px] text-slate-500 font-bold">Urgency</div>
                    <div className="text-xs font-bold text-teal-700">{selectedEvidenceItem.factor_breakdown?.urgency || 0}/10</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-[#172554] mb-1">Source Evidence Location</h4>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <div>Sheet: <b className="text-[#172554]">{selectedEvidenceItem.source_evidence?.sheet}</b></div>
                  <div>Row Number: <b className="text-[#172554]">{selectedEvidenceItem.source_evidence?.row || "N/A"}</b></div>
                  {selectedEvidenceItem.source_evidence?.utr && (
                    <div className="font-mono text-[11px]">UTR: <b className="text-[#172554]">{selectedEvidenceItem.source_evidence.utr}</b></div>
                  )}
                  <div>Match Status: <b className="text-emerald-700">{selectedEvidenceItem.confidence}</b></div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-[#172554] mb-1">Flagged Reasons</h4>
                <ul className="space-y-1">
                  {(selectedEvidenceItem.reasons || []).map((r, rIdx) => (
                    <li key={rIdx} className="text-slate-700 bg-amber-50/50 border border-amber-100 p-2 rounded-lg">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedEvidenceItem.source_evidence?.raw_data && (
                <div>
                  <h4 className="text-[11px] font-bold text-[#172554] mb-1">Raw Worksheet Metadata</h4>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl text-[10px] overflow-x-auto max-h-40">
                    {JSON.stringify(selectedEvidenceItem.source_evidence.raw_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvidenceItem(null)}
                className="rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#172554]">
                  5-Factor Prioritization Scoring Methodology
                </h3>
                <p className="text-xs text-[#64748B]">
                  Mathematical framework and weighting model (Policy v1.0)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 text-xs text-[#334155] leading-relaxed">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="font-bold text-blue-900">Scoring Engine Objective:</span>
                <p className="mt-1 text-blue-800">
                  Ranks transactions, suspect accounts, and fund dispersals on an objective 0–100 scale to help law enforcement immediately identify high-risk, recoverable, or rapidly escaping funds.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#172554] text-xs uppercase tracking-wider mb-2">
                  Factor Weights (Total = 100 Points)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start justify-between border p-2.5 rounded-xl border-rose-100 bg-rose-50/40">
                    <div>
                      <div className="font-bold text-rose-900">1. Immediate Cash-Out Velocity (Max 25 pts)</div>
                      <div className="text-[11px] text-slate-600">Immediate conversion to cash via ATM, POS, or self-cheque withdrawal.</div>
                    </div>
                    <span className="font-black text-rose-700 bg-white px-2 py-0.5 rounded shadow-xs">25 pts</span>
                  </div>
                  <div className="flex items-start justify-between border p-2.5 rounded-xl border-amber-100 bg-amber-50/40">
                    <div>
                      <div className="font-bold text-amber-900">2. Net Unsecured Exposure (Max 25 pts)</div>
                      <div className="text-[11px] text-slate-600">Proportion of traced disputed corpus not yet placed on verified bank hold.</div>
                    </div>
                    <span className="font-black text-amber-700 bg-white px-2 py-0.5 rounded shadow-xs">25 pts</span>
                  </div>
                  <div className="flex items-start justify-between border p-2.5 rounded-xl border-blue-100 bg-blue-50/40">
                    <div>
                      <div className="font-bold text-blue-900">3. Fund-Flow Complexity & Layer Depth (Max 20 pts)</div>
                      <div className="text-[11px] text-slate-600">Multi-hop dispersal, cross-bank movement, and Layer 2+ laundering layering.</div>
                    </div>
                    <span className="font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-xs">20 pts</span>
                  </div>
                  <div className="flex items-start justify-between border p-2.5 rounded-xl border-purple-100 bg-purple-50/40">
                    <div>
                      <div className="font-bold text-purple-900">4. Pattern Indicators & Rapid Dispersion (Max 20 pts)</div>
                      <div className="text-[11px] text-slate-600">Rapid burst transfers, smurfing, split round amounts, and multiple accounts.</div>
                    </div>
                    <span className="font-black text-purple-700 bg-white px-2 py-0.5 rounded shadow-xs">20 pts</span>
                  </div>
                  <div className="flex items-start justify-between border p-2.5 rounded-xl border-teal-100 bg-teal-50/40">
                    <div>
                      <div className="font-bold text-teal-900">5. Investigation Urgency & Actionability (Max 10 pts)</div>
                      <div className="text-[11px] text-slate-600">Recent transaction timestamp, fresh leads, and actionable bank contact points.</div>
                    </div>
                    <span className="font-black text-teal-700 bg-white px-2 py-0.5 rounded shadow-xs">10 pts</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#172554] text-xs uppercase tracking-wider mb-2">
                  Uncertain Link Discounting Policy
                </h4>
                <p className="text-[11px]">
                  When a transaction link between layers lacks an exact matching UTR or timestamp and is flagged as <b className="text-amber-700">UNCERTAIN</b>, its total priority score is reduced by a calibrated <b className="text-[#172554]">40% discount factor</b> to prevent speculative prioritization while preserving visibility.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#172554] text-xs uppercase tracking-wider mb-2">
                  Mathematical Deduplication Rules
                </h4>
                <p className="text-[11px]">
                  Unique Traced Amount is calculated strictly across distinct outbound flow edges to avoid double-counting funds moving across multiple intermediate hops. Cash-outs, verified holds, and transfers are audited in distinct ledger bins.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
              >
                Close Methodology
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
