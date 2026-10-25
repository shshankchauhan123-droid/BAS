import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
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
  return "Account number unavailable";
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

/**
 * Searchable Dropdown for Cascading Selections (Client, User, Case)
 * Keyboard navigable, smart upward/downward popover positioning,
 * search filtering with badges and icons.
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
  const [openUpwards, setOpenUpwards] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const checkPlacement = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 280;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpwards(true);
    } else {
      setOpenUpwards(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      checkPlacement();
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", checkPlacement);
      window.addEventListener("scroll", checkPlacement, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", checkPlacement);
      window.removeEventListener("scroll", checkPlacement, true);
    };
  }, [isOpen, checkPlacement]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
      setHighlightedIndex(0);
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
      const matchSearchKey = opt.searchKey?.toLowerCase().includes(query);
      return matchLabel || matchSubtitle || matchBadge || matchSearchKey;
    });
  }, [options, searchTerm]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex(
          (prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length
        );
      }
    } else if (event.key === "Enter") {
      if (isOpen && filteredOptions[highlightedIndex]) {
        event.preventDefault();
        onSelect(filteredOptions[highlightedIndex].id);
        setIsOpen(false);
      }
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-1.5 ${isOpen ? "z-40" : "z-10"}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold ${
              badgeColor === "emerald"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-blue-50 text-[#172554]"
            }`}
          >
            {stepNumber}
          </span>
          {label}
        </label>
        {selectedItem && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
            Selected
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex min-h-[46px] w-full items-center justify-between rounded-xl border px-3.5 py-2 text-left transition-all outline-none ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50/70 text-slate-400"
            : isOpen
            ? "border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-sm"
            : selectedItem
            ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/70 text-[#172554] shadow-2xs cursor-pointer"
            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white text-slate-600 shadow-2xs cursor-pointer"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {selectedItem?.avatar && (
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800 shrink-0">
              {selectedItem.avatar}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-xs font-bold ${
                disabled
                  ? "text-slate-400"
                  : selectedItem
                  ? "text-[#172554]"
                  : "text-slate-500"
              }`}
            >
              {loading
                ? "Loading options..."
                : selectedItem
                ? selectedItem.label
                : placeholder}
            </p>
            {selectedItem?.subtitle && !loading && (
              <p className="truncate text-[10px] text-slate-500 font-medium">
                {selectedItem.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {loading && (
            <svg
              className="w-4 h-4 text-emerald-600 animate-spin"
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
          )}

          {selectedItem && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onSelect("");
                }
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              title="Clear selection"
            >
              &times;
            </span>
          )}

          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
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

      {isOpen && !disabled && (
        <div
          className={`absolute left-0 z-50 w-full sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-150 select-none ${
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              onClick={(e) => e.stopPropagation()}
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
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          <div
            className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                {searchTerm
                  ? `No matches found for "${searchTerm}"`
                  : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.id) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/80"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.avatar && (
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${
                            isSelected
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {opt.avatar}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold leading-tight">
                          {opt.label}
                        </p>
                        {opt.subtitle && (
                          <p className="truncate text-[10px] text-slate-500 font-medium mt-0.5">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                          opt.badgeColor === "red"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : opt.badgeColor === "blue"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
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
 * Searchable Multi-Select Dropdown for Statement Account Files
 * Displays Account Number as primary label, bank & filename as subtitle,
 * reversible checkboxes, Select All, Clear All, live count, Done button.
 */
function SearchableAccountMultiSelect({
  label = "Select Bank Accounts",
  stepNumber = 4,
  files = [],
  selectedFileIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  disabled = false,
  loading = false,
  getDisplayAccountNumber,
  getDisplayAccountSubtitle,
  accountSearchQuery,
  setAccountSearchQuery,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [openUpwards, setOpenUpwards] = useState(false);
  const dropdownRef = useRef(null);

  const searchValue =
    accountSearchQuery !== undefined ? accountSearchQuery : localSearch;
  const setSearchValue =
    setAccountSearchQuery !== undefined ? setAccountSearchQuery : setLocalSearch;

  const selectedCount = selectedFileIds.length;
  const isAllSelected = files.length > 0 && selectedCount === files.length;

  const checkPlacement = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 350;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpwards(true);
    } else {
      setOpenUpwards(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      checkPlacement();
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("resize", checkPlacement);
      window.addEventListener("scroll", checkPlacement, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", checkPlacement);
      window.removeEventListener("scroll", checkPlacement, true);
    };
  }, [isOpen, checkPlacement]);

  const filteredFiles = useMemo(() => {
    if (!searchValue || !searchValue.trim()) return files;
    const q = searchValue.trim().toLowerCase();
    return files.filter((f) => {
      const acc = (
        getDisplayAccountNumber
          ? getDisplayAccountNumber(f)
          : String(f?.account_number || "")
      ).toLowerCase();
      const sub = (
        getDisplayAccountSubtitle ? getDisplayAccountSubtitle(f) : ""
      ).toLowerCase();
      const orig = String(f?.original_filename || "").toLowerCase();
      const bank = String(f?.bank_name || "").toLowerCase();
      return (
        acc.includes(q) ||
        sub.includes(q) ||
        orig.includes(q) ||
        bank.includes(q)
      );
    });
  }, [files, searchValue, getDisplayAccountNumber, getDisplayAccountSubtitle]);

  return (
    <div
      className={`relative flex flex-col gap-1.5 ${isOpen ? "z-40" : "z-10"}`}
      ref={dropdownRef}
    >
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-[11px] font-extrabold text-emerald-700">
            {stepNumber}
          </span>
          {label}
        </label>
        {files.length > 0 && (
          <span className="text-[11px] font-semibold text-slate-500">
            {selectedCount} of {files.length}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`group flex min-h-[46px] w-full items-center justify-between rounded-xl border px-3.5 py-2 text-left transition-all outline-none ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50/70 text-slate-400"
            : isOpen
            ? "border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-sm"
            : selectedCount > 0
            ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/70 text-[#172554] shadow-2xs cursor-pointer"
            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white text-slate-600 shadow-2xs cursor-pointer"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
              selectedCount > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200/70 text-slate-500"
            }`}
          >
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

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#172554]">
              {loading
                ? "Loading statement accounts..."
                : files.length === 0
                ? "No accounts available"
                : selectedCount === 0
                ? "Select Bank Accounts (0 selected)"
                : selectedCount === files.length
                ? `All Accounts Selected (${files.length})`
                : `Select Bank Accounts (${selectedCount} of ${files.length} selected)`}
            </p>
            {files.length > 0 && !loading && (
              <p className="truncate text-[10px] text-slate-500">
                {selectedCount === 0
                  ? "Click to choose account files"
                  : `${selectedCount} account statement(s) active`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              {selectedCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
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

      {/* Dropdown Menu Popover */}
      {isOpen && !disabled && (
        <div
          className={`absolute left-0 z-50 w-full sm:w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-150 select-none ${
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2 px-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[#172554] tracking-wide">
                Bank Accounts
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                {files.length} {files.length === 1 ? "account" : "accounts"}
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-700">
              {selectedCount} of {files.length} selected
            </span>
          </div>

          {/* Search Bar */}
          <div className="mb-2">
            <div className="relative">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search account number, bank, or file..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                onClick={(e) => e.stopPropagation()}
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
              {searchValue && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchValue("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between px-1 mb-2 text-[11px]">
            <span className="text-slate-500 font-medium">
              Showing {filteredFiles.length} of {files.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll();
                }}
                disabled={files.length === 0}
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">&bull;</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
                disabled={selectedCount === 0}
                className="font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Master Checkbox Row */}
          {files.length > 0 && (
            <div className="px-1 py-1 mb-1.5 border-b border-slate-100 pb-2">
              <div
                className="flex items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 cursor-pointer select-none transition"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAllSelected) {
                    onClearAll();
                  } else {
                    onSelectAll();
                  }
                }}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAllSelected) {
                        onClearAll();
                      } else {
                        onSelectAll();
                      }
                    }}
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

          {/* Scrollable Accounts List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredFiles.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                {searchValue
                  ? `No accounts found matching "${searchValue}"`
                  : "No accounts available"}
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isChecked = selectedFileIds.some(
                  (id) => String(id) === String(file.id)
                );
                const accNumber = getDisplayAccountNumber(file);
                const bankSubtitle = getDisplayAccountSubtitle(file);
                const isMerged = Boolean(
                  file.is_merged ||
                    String(file.original_filename || "")
                      .toLowerCase()
                      .startsWith("merged_statement")
                );
                const statusUpper = String(file.status || "").toUpperCase();

                return (
                  <div
                    key={file.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(file.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onToggle(file.id);
                      }
                    }}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs font-medium"
                        : "hover:bg-slate-50/90 border-slate-100 bg-white text-slate-700 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(file.id);
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
                          {statusUpper === "FAILED" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                              FAILED
                            </span>
                          )}
                          {statusUpper !== "COMPLETED" &&
                            statusUpper !== "FAILED" &&
                            !isMerged &&
                            statusUpper && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                {statusUpper}
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

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2 px-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              disabled={selectedCount === 0}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Clear All
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="rounded-xl bg-[#059669] hover:bg-[#047857] px-4 py-1.5 text-xs font-bold text-white transition shadow-sm cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DynamicReportDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const paramFileId = searchParams.get("fileId");

  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";

  // Super Admin Cascading State: Client -> User -> Case -> Accounts
  const [superAdminClients, setSuperAdminClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  const [superAdminUsers, setSuperAdminUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [superAdminCases, setSuperAdminCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Non-SuperAdmin Case switcher & Active Case
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");

  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  // Request sequence counter refs to discard stale async responses
  const clientReqIdRef = useRef(0);
  const userReqIdRef = useRef(0);
  const caseReqIdRef = useRef(0);
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

  // 1. Super Admin: Load all registered client companies on mount
  useEffect(() => {
    if (!isSuperAdmin) return;
    let isMounted = true;
    setLoadingClients(true);
    getClients()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res?.data || res?.items || [];
        setSuperAdminClients(list);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load clients:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingClients(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin]);

  // 2. Non-SuperAdmin: Fetch assigned cases on mount
  useEffect(() => {
    if (isSuperAdmin) return;
    let isMounted = true;
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const res = await getCases();
        if (!isMounted) return;
        if (res?.data) {
          setCases(res.data);
          if (
            paramCaseId &&
            res.data.some((c) => String(c.id) === String(paramCaseId))
          ) {
            setSelectedCaseId(String(paramCaseId));
          } else if (res.data.length > 0 && !selectedCaseId) {
            setSelectedCaseId(String(res.data[0].id));
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load cases:", err);
        setError("Failed to load cases.");
      } finally {
        if (isMounted) setIsLoadingCases(false);
      }
    }
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, paramCaseId]);

  // Sync selectedCaseId if paramCaseId changes (e.g. browser back/forward or navigation)
  useEffect(() => {
    if (paramCaseId && String(paramCaseId) !== String(selectedCaseId)) {
      setSelectedCaseId(String(paramCaseId));
      setSelectedFileIds([]);
      setAccountSearchQuery("");
      setModeData([]);
      setTotalTransactions(0);
      setSummaryData(null);
      setSelectedMode("");
      setTransactions([]);
      setTransactionTotal(0);
      setTransactionTotalPages(0);
      initialUrlFileProcessedRef.current = false;
    }
  }, [paramCaseId, selectedCaseId]);

  // Memoized options for cascading dropdowns
  const selectedClientObj = useMemo(() => {
    return (superAdminClients || []).find(
      (c) => String(c.id) === String(selectedClientId)
    );
  }, [superAdminClients, selectedClientId]);

  const clientOptions = useMemo(() => {
    return (superAdminClients || []).map((client) => ({
      id: client.id,
      label: client.name || "Unnamed Client",
      subtitle: client.company_code
        ? `Code: ${client.company_code}`
        : `Client ID #${client.id}`,
      badge: client.is_active ? "ACTIVE" : "INACTIVE",
      badgeColor: client.is_active ? "emerald" : "red",
      avatar: (client.name || "C").charAt(0).toUpperCase(),
      searchKey: `${client.name || ""} ${client.company_code || ""}`,
    }));
  }, [superAdminClients]);

  const userOptions = useMemo(() => {
    const clientName = selectedClientObj?.name || "Client";
    return (superAdminUsers || []).map((u) => ({
      id: u.id,
      label: `${u.username} (${clientName})`,
      subtitle: u.email || `${u.role || "User"}`,
      badge: u.role ? String(u.role).toUpperCase() : undefined,
      avatar: (u.username || "U").charAt(0).toUpperCase(),
      searchKey: `${u.username || ""} ${u.email || ""}`,
    }));
  }, [superAdminUsers, selectedClientObj]);

  const caseOptions = useMemo(() => {
    return (superAdminCases || []).map((c) => {
      const ioName =
        c.io?.officer_name ||
        c.io?.name ||
        (c.io_id ? `IO #${c.io_id}` : null);
      const statusText = c.status || "DRAFT";
      const subtitleParts = [];
      subtitleParts.push(`Status: ${statusText}`);
      if (ioName) {
        subtitleParts.push(`IO: ${ioName}`);
      }
      return {
        id: c.id,
        label: `${c.case_name || "Untitled Case"} — ${
          c.case_number || `ID #${c.id}`
        }`,
        subtitle: subtitleParts.join(" • "),
        badge: statusText,
        badgeColor:
          statusText === "ACTIVE"
            ? "emerald"
            : statusText === "COMPLETED"
            ? "blue"
            : "amber",
        avatar: "📁",
        searchKey: `${c.case_name || ""} ${c.case_number || ""} ${statusText} ${
          ioName || ""
        }`,
      };
    });
  }, [superAdminCases]);

  // Super Admin: Client Selection
  const handleClientSelect = async (clientId) => {
    const normClientId = String(clientId || "");
    if (normClientId === String(selectedClientId)) return;

    clientReqIdRef.current++;
    userReqIdRef.current++;
    caseReqIdRef.current++;
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;

    setSelectedClientId(normClientId);
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    setError("");

    if (!normClientId) return;

    const currentReqId = ++userReqIdRef.current;
    try {
      setLoadingUsers(true);
      const res = await getUsers(normClientId);
      if (currentReqId !== userReqIdRef.current) return;
      const rawList =
        res?.users || res?.items || (Array.isArray(res) ? res : []);
      setSuperAdminUsers(rawList);
    } catch (err) {
      if (currentReqId !== userReqIdRef.current) return;
      console.error("Failed to load users for client:", err);
    } finally {
      if (currentReqId === userReqIdRef.current) {
        setLoadingUsers(false);
      }
    }
  };

  // Super Admin: User Selection
  const handleUserSelect = async (userId) => {
    const normUserId = String(userId || "");
    if (normUserId === String(selectedUserId)) return;

    userReqIdRef.current++;
    caseReqIdRef.current++;
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;

    setSelectedUserId(normUserId);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    setError("");

    if (!normUserId) return;

    const currentReqId = ++caseReqIdRef.current;
    try {
      setLoadingCases(true);
      const res = await getCases(normUserId);
      if (currentReqId !== caseReqIdRef.current) return;
      const rawList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setSuperAdminCases(rawList);
    } catch (err) {
      if (currentReqId !== caseReqIdRef.current) return;
      console.error("Failed to load cases for user:", err);
    } finally {
      if (currentReqId === caseReqIdRef.current) {
        setLoadingCases(false);
      }
    }
  };

  // Super Admin / Shared: Case Selection
  const handleCaseSelect = (caseId) => {
    const normCaseId = String(caseId || "");
    if (normCaseId === String(selectedCaseId)) return;

    caseReqIdRef.current++;
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;

    setSelectedCaseId(normCaseId);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    setError("");
    initialUrlFileProcessedRef.current = false;

    if (normCaseId) {
      setSearchParams({ caseId: normCaseId });
    } else {
      setSearchParams({});
    }
  };

  // Reset Cascading Scope for Super Admin
  const handleResetCascadingSelection = () => {
    clientReqIdRef.current++;
    userReqIdRef.current++;
    caseReqIdRef.current++;
    modeReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;

    setSelectedClientId("");
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
    setSelectedMode("");
    setTransactions([]);
    setTransactionTotal(0);
    setTransactionTotalPages(0);
    setError("");
    setSearchParams({});
  };

  // Handle Case Switching for non-SuperAdmin
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(selectedCaseId)) return;
    handleCaseSelect(newCaseId);
  };

  // Load Files when Case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setModeData([]);
      setTotalTransactions(0);
      setSummaryData(null);
      setSelectedMode("");
      setTransactions([]);
      setTransactionTotal(0);
      setTransactionTotalPages(0);
      setIsLoadingFiles(false);
      return;
    }

    let isMounted = true;
    async function loadFiles() {
      setIsLoadingFiles(true);
      try {
        const [caseRes, filesRes] = await Promise.all([
          getCase(selectedCaseId).catch(() => null),
          getCaseFiles(selectedCaseId, false, "BANK_STATEMENT"),
        ]);
        if (!isMounted) return;

        const activeFiles = (filesRes?.data || filesRes || []).filter(
          (f) => !f.is_superseded && (!f.document_type || f.document_type === "BANK_STATEMENT") && f.document_type !== "UNKNOWN"
        );
        setFiles(activeFiles);

        // If Super Admin and client/user not set yet (e.g. direct URL navigation), sync them!
        if (isSuperAdmin && loadedCase) {
          const cId = loadedCase.client_id || loadedCase.client?.id;
          const uId = loadedCase.created_by || loadedCase.assigned_to;
          if (cId && !selectedClientId) {
            setSelectedClientId(String(cId));
            getUsers(cId)
              .then((res) => {
                if (!isMounted) return;
                const uList =
                  res?.users || res?.items || (Array.isArray(res) ? res : []);
                setSuperAdminUsers(uList);
              })
              .catch(() => {});
          }
          if (uId && !selectedUserId) {
            setSelectedUserId(String(uId));
            getCases(uId)
              .then((res) => {
                if (!isMounted) return;
                const cList = Array.isArray(res?.data)
                  ? res.data
                  : Array.isArray(res)
                  ? res
                  : [];
                setSuperAdminCases(cList);
              })
              .catch(() => {});
          }
        }

        if (
          paramFileId &&
          !initialUrlFileProcessedRef.current &&
          activeFiles.some((f) => String(f.id) === String(paramFileId))
        ) {
          initialUrlFileProcessedRef.current = true;
          const matched = activeFiles.find(
            (f) => String(f.id) === String(paramFileId)
          );
          setSelectedFileIds([matched.id]);
        } else {
          // By default select all active files
          const allIds = activeFiles.map((f) => f.id);
          setSelectedFileIds(allIds);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
      } finally {
        if (isMounted) {
          setIsLoadingFiles(false);
        }
      }
    }

    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, isSuperAdmin]);

  // Fetch Mode-Wise Data and Summary when File Selection Changes
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.length === 0) {
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
        const fileIdsArray = selectedFileIds.map((id) => String(id));
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
        const fileIdsArray = selectedFileIds.map((id) => String(id));
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

  // Load transactions when selected mode changes
  useEffect(() => {
    if (!selectedMode || selectedFileIds.length === 0 || !selectedCaseId) {
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
        const fileIdsArray = selectedFileIds.map((id) => String(id));
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

  // Mode KPIs for drill-down inspection
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
    setTimeout(() => {
      document
        .getElementById("transactions-grid")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleFileToggle = (fileId) => {
    const isCurrentlySelected = selectedFileIds.some(
      (id) => String(id) === String(fileId)
    );
    let nextIds;
    if (isCurrentlySelected) {
      nextIds = selectedFileIds.filter((id) => String(id) !== String(fileId));
    } else {
      nextIds = [
        ...selectedFileIds.filter((id) => String(id) !== String(fileId)),
        fileId,
      ];
    }
    setSelectedFileIds(nextIds);
    setSelectedMode("");
    setTransactionPage(1);

    if (nextIds.length === 0) {
      setModeData([]);
      setTotalTransactions(0);
      setSummaryData(null);
      setTransactions([]);
      setTransactionTotal(0);
      setTransactionTotalPages(0);
      modeReqIdRef.current++;
      summaryReqIdRef.current++;
      txReqIdRef.current++;
    }
  };

  const handleSelectAllFiles = () => {
    if (!files || files.length === 0) return;
    const allIds = Array.from(new Set(files.map((f) => f.id)));
    setSelectedFileIds(allIds);
    setSelectedMode("");
    setTransactionPage(1);
  };

  const handleClearFiles = () => {
    setSelectedFileIds([]);
    setSelectedMode("");
    setTransactionPage(1);
    setModeData([]);
    setTotalTransactions(0);
    setSummaryData(null);
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
          {selectedCaseId && selectedFileIds.length > 0 && summaryData?.most_active_date && (
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
                    {new Date(summaryData.most_active_date)
                      .toLocaleDateString("en-GB")
                      .replace(/\//g, "-")}
                  </div>
                  <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {Number(summaryData.most_active_date_count).toLocaleString("en-IN")}{" "}
                    Transactions
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================
            CASCADING SELECTION PANEL
        ========================================================== */}
        <div className="relative z-30 mb-6">
          {isSuperAdmin ? (
            <section className="relative z-30 rounded-2xl border border-[#E2E8F0] bg-white/95 p-5 shadow-[0_8px_30px_rgba(23,37,84,0.06)] backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                      Tenant-Aware Cascading Scope
                    </p>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Super Admin
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-[#172554]">
                    Select Client, User, Case & Accounts
                  </h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Follow the 4-step sequence to scope and analyze bank statement transactions.
                  </p>
                </div>

                {(selectedClientId || selectedUserId || selectedCaseId) && (
                  <button
                    type="button"
                    onClick={handleResetCascadingSelection}
                    className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#DCE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-center cursor-pointer"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Reset Selection
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Step 1: Select Client */}
                <SearchableDropdown
                  stepNumber={1}
                  label="Select Client"
                  value={selectedClientId}
                  options={clientOptions}
                  onSelect={handleClientSelect}
                  placeholder="Choose a client company..."
                  searchPlaceholder="Search client by name or code..."
                  loading={loadingClients}
                  disabled={loadingClients}
                  emptyMessage="No client companies found"
                  badgeColor="emerald"
                />

                {/* Step 2: Select User */}
                <SearchableDropdown
                  stepNumber={2}
                  label="Select User"
                  value={selectedUserId}
                  options={userOptions}
                  onSelect={handleUserSelect}
                  placeholder={
                    !selectedClientId
                      ? "Select a client first"
                      : "Choose a user..."
                  }
                  searchPlaceholder="Search user by username or email..."
                  loading={loadingUsers}
                  disabled={!selectedClientId || loadingUsers}
                  emptyMessage={
                    !selectedClientId
                      ? "Select a client first"
                      : "No users found for this client"
                  }
                  badgeColor="blue"
                />

                {/* Step 3: Select Case */}
                <SearchableDropdown
                  stepNumber={3}
                  label="Select Case"
                  value={selectedCaseId}
                  options={caseOptions}
                  onSelect={handleCaseSelect}
                  placeholder={
                    !selectedUserId
                      ? "Select a user first"
                      : "Choose an investigation case..."
                  }
                  searchPlaceholder="Search case by name or number..."
                  loading={loadingCases}
                  disabled={!selectedUserId || loadingCases}
                  emptyMessage={
                    !selectedUserId
                      ? "Select a user first"
                      : "No cases found for this user"
                  }
                  badgeColor="emerald"
                />

                {/* Step 4: Select Accounts */}
                <SearchableAccountMultiSelect
                  stepNumber={4}
                  label="Select Accounts"
                  files={files}
                  selectedFileIds={selectedFileIds}
                  onToggle={handleFileToggle}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleClearFiles}
                  disabled={
                    !selectedCaseId || isLoadingFiles || files.length === 0
                  }
                  loading={isLoadingFiles}
                  getDisplayAccountNumber={getDisplayAccountNumber}
                  getDisplayAccountSubtitle={getDisplayBankSubtitle}
                  accountSearchQuery={accountSearchQuery}
                  setAccountSearchQuery={setAccountSearchQuery}
                />
              </div>
            </section>
          ) : (
            /* NON-SUPERADMIN: Quick Case Switcher & Upgraded Accounts */
            <div className="relative z-30 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-900/5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SearchableDropdown
                  stepNumber={1}
                  label="Select / Switch Case"
                  value={selectedCaseId}
                  options={cases.map((c) => ({
                    id: c.id,
                    label: `${c.case_name || "Untitled Case"} — ${
                      c.case_number || `ID #${c.id}`
                    }`,
                    subtitle: `Status: ${c.status || "DRAFT"} • IO: ${
                      c.io?.officer_name || c.io?.name || "Not Assigned"
                    }`,
                    badge: c.status || "DRAFT",
                    avatar: "📁",
                    searchKey: `${c.case_name || ""} ${c.case_number || ""}`,
                  }))}
                  onSelect={handleSwitchCase}
                  placeholder="Choose an investigation case..."
                  searchPlaceholder="Search case..."
                  loading={isLoadingCases}
                  disabled={isLoadingCases}
                  emptyMessage="No cases available"
                  badgeColor="emerald"
                />

                <SearchableAccountMultiSelect
                  stepNumber={2}
                  label="Select Accounts"
                  files={files}
                  selectedFileIds={selectedFileIds}
                  onToggle={handleFileToggle}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleClearFiles}
                  disabled={
                    !selectedCaseId || isLoadingFiles || files.length === 0
                  }
                  loading={isLoadingFiles}
                  getDisplayAccountNumber={getDisplayAccountNumber}
                  getDisplayAccountSubtitle={getDisplayBankSubtitle}
                  accountSearchQuery={accountSearchQuery}
                  setAccountSearchQuery={setAccountSearchQuery}
                />
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            EMPTY & PROMPT STATES
        ========================================================== */}
        {isSuperAdmin && !selectedCaseId && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
              Select Client, User, and Case
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Choose a client company, assigned user, and investigation case from the cascading dropdowns above to inspect transaction mode distribution, counts, and channel intelligence.
            </p>
          </div>
        )}

        {!isSuperAdmin && !selectedCaseId && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
              Select an Investigation Case
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Choose a case from the dropdown above to analyze transaction modes and bank statement channels.
            </p>
          </div>
        )}

        {selectedCaseId && isLoadingFiles && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="inline-flex items-center gap-3 text-emerald-600 font-semibold text-sm">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading case statement files...
            </div>
          </div>
        )}

        {selectedCaseId && !isLoadingFiles && files.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#172554] mb-1">
              No Statement Files Uploaded
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              This case has no bank statement files or accounts attached yet. Upload statement files to view transaction mode analytics.
            </p>
          </div>
        )}

        {selectedCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3 border border-blue-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#172554] mb-1">
              No Bank Accounts Selected
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
              Select one or more bank accounts from the dropdown above to display mode distribution, transaction statistics, and channel breakdown.
            </p>
            <button
              type="button"
              onClick={handleSelectAllFiles}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
            >
              Select All Accounts ({files.length})
            </button>
          </div>
        )}

        {/* =========================================================
            FIVE PRIMARY KPI CARDS (Only when accounts selected)
        ========================================================== */}
        {selectedCaseId && !isLoadingFiles && selectedFileIds.length > 0 && (
          <div className="arthbodh-animate-entrance arthbodh-stagger-2 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {/* 1. Total Debit Amount */}
            <div className="arthbodh-card-elevate min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Total Debit Amount
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200/80">
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
                <div className="min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-black font-mono text-rose-600 tracking-tight tabular-nums break-words"
                    title={`₹ ${
                      summaryData?.total_debits
                        ? Number(summaryData.total_debits).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0.00"
                    }`}
                  >
                    ₹{" "}
                    {summaryData?.total_debits
                      ? Number(summaryData.total_debits).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                    Total fund withdrawals
                  </div>
                </div>
              )}
            </div>

            {/* 2. Total Credit Amount */}
            <div className="arthbodh-card-elevate min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Total Credit Amount
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/80">
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
                <div className="min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-black font-mono text-emerald-600 tracking-tight tabular-nums break-words"
                    title={`₹ ${
                      summaryData?.total_credits
                        ? Number(summaryData.total_credits).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0.00"
                    }`}
                  >
                    ₹{" "}
                    {summaryData?.total_credits
                      ? Number(summaryData.total_credits).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                    Total fund deposits
                  </div>
                </div>
              )}
            </div>

            {/* 3. Debit Transactions */}
            <div className="arthbodh-card-elevate min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Debit Transactions
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80">
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
                <div className="min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-black font-mono text-[#172554] tracking-tight tabular-nums break-words"
                    title={
                      summaryData?.debit_transactions
                        ? Number(summaryData.debit_transactions).toLocaleString("en-IN")
                        : "0"
                    }
                  >
                    {summaryData?.debit_transactions
                      ? Number(summaryData.debit_transactions).toLocaleString("en-IN")
                      : "0"}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                    Debit transaction volume
                  </div>
                </div>
              )}
            </div>

            {/* 4. Credit Transactions */}
            <div className="arthbodh-card-elevate min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Credit Transactions
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 border border-teal-200/80">
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
                <div className="min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-black font-mono text-[#172554] tracking-tight tabular-nums break-words"
                    title={
                      summaryData?.credit_transactions
                        ? Number(summaryData.credit_transactions).toLocaleString("en-IN")
                        : "0"
                    }
                  >
                    {summaryData?.credit_transactions
                      ? Number(summaryData.credit_transactions).toLocaleString("en-IN")
                      : "0"}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                    Credit transaction volume
                  </div>
                </div>
              )}
            </div>

            {/* 5. Most Active Date */}
            <div className="arthbodh-card-elevate min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Most Active Date
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/80">
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
                <div className="min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-black text-[#172554] tracking-tight tabular-nums break-words"
                    title={
                      summaryData?.most_active_date
                        ? `${new Date(summaryData.most_active_date)
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")} (${Number(
                            summaryData.most_active_date_count || 0
                          ).toLocaleString("en-IN")} transactions)`
                        : "No Data"
                    }
                  >
                    {summaryData?.most_active_date
                      ? new Date(summaryData.most_active_date)
                          .toLocaleDateString("en-GB")
                          .replace(/\//g, "-")
                      : "No Data"}
                  </div>
                  {summaryData?.most_active_date ? (
                    <div className="text-[11px] font-semibold text-emerald-600 mt-1 truncate">
                      {Number(summaryData.most_active_date_count).toLocaleString("en-IN")}{" "}
                      Transactions
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                      Awaiting statement data
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            VERTICAL BAR CHART SECTION (Only when accounts selected)
        ========================================================== */}
        {selectedCaseId && !isLoadingFiles && selectedFileIds.length > 0 && (
          <div className="arthbodh-animate-entrance arthbodh-stagger-3 mt-6">
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
                  No transactions found for the selected bank accounts.
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
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Highest Debit Amount
                  </h3>
                  <div
                    className="text-xl font-black font-mono text-rose-600 tabular-nums break-words"
                    title={`₹ ${
                      modeKPIs.highestDebit
                        ? Number(modeKPIs.highestDebit).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0.00"
                    }`}
                  >
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
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Highest Credit Amount
                  </h3>
                  <div
                    className="text-xl font-black font-mono text-emerald-600 tabular-nums break-words"
                    title={`₹ ${
                      modeKPIs.highestCredit
                        ? Number(modeKPIs.highestCredit).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0.00"
                    }`}
                  >
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
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Most Active Date
                  </h3>
                  <div className="min-w-0">
                    <div
                      className="text-xl font-black text-[#172554] tabular-nums break-words"
                      title={
                        modeKPIs.mostActiveDate
                          ? `${new Date(modeKPIs.mostActiveDate)
                              .toLocaleDateString("en-GB")
                              .replace(/\//g, "-")} (${Number(
                              modeKPIs.mostActiveDateCount || 0
                            ).toLocaleString("en-IN")} transactions)`
                          : "No Data"
                      }
                    >
                      {modeKPIs.mostActiveDate
                        ? new Date(modeKPIs.mostActiveDate)
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")
                        : "No Data"}
                    </div>
                    {modeKPIs.mostActiveDate && (
                      <div className="text-xs font-semibold text-emerald-600 mt-0.5 truncate">
                        {Number(modeKPIs.mostActiveDateCount).toLocaleString("en-IN")}{" "}
                        Transactions
                      </div>
                    )}
                  </div>
                </div>

                {/* Average Value */}
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Average Transaction Value
                  </h3>
                  <div
                    className="text-xl font-black font-mono text-emerald-700 tabular-nums break-words"
                    title={`₹ ${
                      modeKPIs.averageValue
                        ? Number(modeKPIs.averageValue).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0.00"
                    }`}
                  >
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
        )}
      </main>

      <UserFooter />
    </div>
  );
}

// Export named chart component as well in case external modules import it
export { DynamicModeWiseChart };
