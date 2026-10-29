import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
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

// Light theme color palette for multi-statement file legends & badges
const LIGHT_FILE_BADGES = [
  { badge: "border-cyan-200 bg-cyan-50 text-cyan-800", dot: "bg-cyan-500" },
  { badge: "border-purple-200 bg-purple-50 text-purple-800", dot: "bg-purple-500" },
  { badge: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  { badge: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  { badge: "border-pink-200 bg-pink-50 text-pink-800", dot: "bg-pink-500" },
  { badge: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-500" },
  { badge: "border-indigo-200 bg-indigo-50 text-indigo-800", dot: "bg-indigo-500" },
  { badge: "border-orange-200 bg-orange-50 text-orange-800", dot: "bg-orange-500" },
];

function getLightFileBadge(fileId) {
  const num = Number(fileId) || 0;
  return LIGHT_FILE_BADGES[Math.abs(num) % LIGHT_FILE_BADGES.length];
}

function getDisplayAccountNumber(file) {
  if (file?.account_number && String(file.account_number).trim()) {
    return String(file.account_number).trim();
  }
  const filename = String(file?.original_filename || "");
  const match = filename.match(
    /(?:Merged_Statement_|Statement_)?(\d{9,18})/i
  );
  if (match && match[1]) {
    return match[1];
  }
  return "Account number unavailable";
}

function getDisplayBankSubtitle(file) {
  const parts = [];
  if (file?.bank_name && String(file.bank_name).trim()) {
    parts.push(String(file.bank_name).trim());
  }
  if (file?.account_name && String(file.account_name).trim()) {
    parts.push(String(file.account_name).trim());
  }
  if (file?.original_filename && String(file.original_filename).trim()) {
    parts.push(String(file.original_filename).trim());
  }
  if (file?.file_size) {
    parts.push(formatFileSize(file.file_size));
  }
  return parts.length > 0 ? parts.join(" • ") : "Bank Statement";
}

/**
 * Searchable Single-Select Dropdown Component
 * Follows BAS Light Theme tokens (#F5F8FC bg, #172554 navy, #059669 emerald, #E2E8F0 borders)
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
          <span className="text-[10px] font-bold text-emerald-700">Selected</span>
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
            ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/70 shadow-2xs cursor-pointer"
            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white text-slate-600 shadow-2xs cursor-pointer"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
              <span>Loading options...</span>
            </div>
          ) : selectedItem ? (
            <>
              {selectedItem.avatar && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-bold text-emerald-800">
                  {selectedItem.avatar}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#172554]">
                  {selectedItem.label}
                </p>
                {selectedItem.subtitle && (
                  <p className="truncate text-[10px] text-[#64748B]">
                    {selectedItem.subtitle}
                  </p>
                )}
              </div>
            </>
          ) : (
            <span className="truncate text-xs font-medium text-slate-400">
              {placeholder}
            </span>
          )}
        </div>

        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-600" : "group-hover:text-[#172554]"
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
      </button>

      {/* Dropdown panel */}
      {isOpen && !disabled && (
        <div
          className={`absolute left-0 z-50 w-full min-w-[280px] rounded-2xl border border-[#E2E8F0] bg-white p-2.5 shadow-[0_20px_45px_rgba(23,37,84,0.16)] animate-in fade-in zoom-in-95 duration-150 ${
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {/* Search bar */}
          <div className="relative mb-2 px-0.5">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
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
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-xs text-[#172033] outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto px-0.5 py-0.5 space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.id) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition outline-none cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200"
                        : isHighlighted
                        ? "bg-slate-100 text-[#172554]"
                        : "text-[#334155] hover:bg-slate-50 hover:text-[#172554]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {opt.avatar && (
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {opt.avatar}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{opt.label}</p>
                        {opt.subtitle && (
                          <p className="truncate text-[10px] text-[#64748B]">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      {opt.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                            opt.badgeColor === "emerald"
                              ? "bg-emerald-100 text-emerald-800"
                              : opt.badgeColor === "red"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <svg
                          className="h-4 w-4 text-emerald-600 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-[#94A3B8]">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Searchable Multi-Select Account Files Component
 * Features:
 * - Bank account number as primary label
 * - Original filename, bank, and size as secondary info
 * - Fully reversible checkboxes (checking/unchecking immediately updates selection)
 * - Select All / Clear All buttons and master checkbox
 * - Selected count display e.g. "Select Accounts (1 of 2 selected)"
 * - Done button to close without losing selection
 * - Click propagation prevented so toggling accounts never closes dropdown unexpectedly
 */
function SearchableAccountMultiSelect({
  label = "Select Accounts",
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
                ? "Select Accounts (0 selected)"
                : selectedCount === files.length
                ? `All Accounts Selected (${files.length})`
                : `Select Accounts (${selectedCount} of ${files.length} selected)`}
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
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
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

function CaseFileReport() {
  const navigate = useNavigate();
  const { caseId: paramCaseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";

  // Sequence counters to ignore stale async responses
  const summaryReqIdRef = useRef(0);
  const txReqIdRef = useRef(0);
  const graphReqIdRef = useRef(0);

  // Track if initial fileId from URL query has been processed for the active case
  const initialUrlFileProcessedRef = useRef(false);

  // Active case state & all cases for switcher (non-SuperAdmin)
  const [activeCaseId, setActiveCaseId] = useState(paramCaseId || "");
  const [allCases, setAllCases] = useState([]);
  const [loadingAllCases, setLoadingAllCases] = useState(false);

  // Super Admin Cascading State: Client -> User -> Case -> Account
  const [superAdminClients, setSuperAdminClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  const [superAdminUsers, setSuperAdminUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [superAdminCases, setSuperAdminCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const clientReqIdRef = useRef(0);
  const userReqIdRef = useRef(0);
  const caseReqIdRef = useRef(0);

  // Sync activeCaseId if paramCaseId changes (e.g. browser back/forward or route change)
  useEffect(() => {
    if (paramCaseId && String(paramCaseId) !== String(activeCaseId)) {
      setActiveCaseId(paramCaseId);
      setSelectedFileIds([]);
      setAccountSearchQuery("");
      setSummary(null);
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(0);
      setGraphTransactions([]);
      setDynamicModeCounts({});
      summaryReqIdRef.current++;
      txReqIdRef.current++;
      graphReqIdRef.current++;
      initialUrlFileProcessedRef.current = false;
    }
  }, [paramCaseId, activeCaseId]);

  // Load clients for Super Admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    let isMounted = true;
    async function fetchClients() {
      try {
        setLoadingClients(true);
        const res = await getClients();
        const list =
          res?.items || res?.clients || (Array.isArray(res) ? res : []);
        if (isMounted) {
          setSuperAdminClients(list);
        }
      } catch (err) {
        console.error("Failed to fetch clients for Super Admin:", err);
      } finally {
        if (isMounted) setLoadingClients(false);
      }
    }
    fetchClients();
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin]);

  // Fetch all cases for non-SuperAdmin users
  useEffect(() => {
    if (isSuperAdmin) return;
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
  }, [isSuperAdmin, activeCaseId]);

  // Super Admin: Client Selection
  const handleClientSelect = async (clientId) => {
    const normClientId = String(clientId || "");
    if (normClientId === String(selectedClientId)) return;

    clientReqIdRef.current++;
    userReqIdRef.current++;
    caseReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;

    setSelectedClientId(normClientId);
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setActiveCaseId("");
    setSuperAdminCases([]);
    setCaseData(null);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setSummary(null);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setGraphTransactions([]);
    setDynamicModeCounts({});
    setCaseError("");

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
    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;

    setSelectedUserId(normUserId);
    setActiveCaseId("");
    setSuperAdminCases([]);
    setCaseData(null);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setSummary(null);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setGraphTransactions([]);
    setDynamicModeCounts({});
    setCaseError("");

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
    if (normCaseId === String(activeCaseId)) return;

    caseReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;

    setActiveCaseId(normCaseId);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setSummary(null);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setGraphTransactions([]);
    setDynamicModeCounts({});
    setCaseError("");
    initialUrlFileProcessedRef.current = false;

    if (normCaseId) {
      navigate(`/dashboard/cases/${normCaseId}/reports/file-statement`);
    } else {
      navigate(`/dashboard/reports/file-statement`);
    }
  };

  // Reset Cascading Scope for Super Admin
  const handleResetCascadingSelection = () => {
    clientReqIdRef.current++;
    userReqIdRef.current++;
    caseReqIdRef.current++;
    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;

    setSelectedClientId("");
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setActiveCaseId("");
    setSuperAdminCases([]);
    setCaseData(null);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setSummary(null);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setGraphTransactions([]);
    setDynamicModeCounts({});
    setCaseError("");
    setSearchParams({}, { replace: true });
    navigate(`/dashboard/reports/file-statement`, { replace: true });
  };

  // Handle Case Switching for non-SuperAdmin
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) return;
    setActiveCaseId(newCaseId);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setSummary(null);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setGraphTransactions([]);
    setDynamicModeCounts({});
    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;
    initialUrlFileProcessedRef.current = false;
    setSearchParams({}, { replace: true });
    navigate(`/dashboard/cases/${newCaseId}/reports/file-statement`);
  };

  // Memoized options for cascading dropdowns
  const selectedClientObj = useMemo(() => {
    return (superAdminClients || []).find(
      (c) => String(c.id) === String(selectedClientId)
    );
  }, [superAdminClients, selectedClientId]);

  const selectedUserObj = useMemo(() => {
    return (superAdminUsers || []).find(
      (u) => String(u.id) === String(selectedUserId)
    );
  }, [superAdminUsers, selectedUserId]);

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
          statusText === "ACTIVE" || statusText === "COMPLETED"
            ? "emerald"
            : "slate",
        avatar: "📁",
        searchKey: `${c.case_name || ""} ${c.case_number || ""} ${statusText} ${
          ioName || ""
        }`,
      };
    });
  }, [superAdminCases]);

  // Case & Files state
  const [caseData, setCaseData] = useState(null);
  const [files, setFiles] = useState([]);
  const [isCaseLoading, setIsCaseLoading] = useState(Boolean(activeCaseId));
  const [caseError, setCaseError] = useState("");

  // Selected files - default empty so user picks single or multiple files manually
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // O(1) file lookup map for instantaneous lookups with zero freeze/hang
  const fileMap = useMemo(() => {
    const map = new Map();
    (files || []).forEach((f) => map.set(String(f.id), f));
    return map;
  }, [files]);

  // Filtered files for the dropdown search (preserves active selections)
  const filteredDropdownFiles = useMemo(() => {
    if (!accountSearchQuery || !accountSearchQuery.trim()) return files || [];
    const q = accountSearchQuery.trim().toLowerCase();
    return (files || []).filter((f) => {
      const accNo = (
        getDisplayAccountNumber
          ? getDisplayAccountNumber(f)
          : String(f?.account_number || "")
      ).toLowerCase();
      const bank = String(f?.bank_name || "").toLowerCase();
      const orig = String(f?.original_filename || "").toLowerCase();
      return accNo.includes(q) || bank.includes(q) || orig.includes(q);
    });
  }, [files, accountSearchQuery]);

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
    if (!summary || selectedFileIds.length === 0) {
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
  }, [summary, selectedFileIds]);

  // Transactions list for selected file
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [isExportingCSV, setIsExportingCSV] = useState(false);
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
        getCaseFiles(activeCaseId, false, "BANK_STATEMENT"),
      ]);

      const loadedCase = caseRes?.data || caseRes;
      const rawFiles = Array.isArray(filesRes?.data)
        ? filesRes.data
        : Array.isArray(filesRes)
        ? filesRes
        : [];
      const loadedFiles = rawFiles.filter(
        (f) => !f.is_superseded && (!f.document_type || f.document_type === "BANK_STATEMENT") && f.document_type !== "UNKNOWN"
      );

      setCaseData(loadedCase);
      setFiles(loadedFiles);

      // If Super Admin and client/user not set yet (e.g. direct URL navigation), sync them!
      if (isSuperAdmin && loadedCase) {
        const cId = loadedCase.client_id || loadedCase.client?.id;
        const uId = loadedCase.created_by || loadedCase.assigned_to;
        if (cId && !selectedClientId) {
          setSelectedClientId(String(cId));
          getUsers(cId)
            .then((res) => {
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

      // Handle initial URL fileId query parameter only once per case load
      if (!initialUrlFileProcessedRef.current) {
        initialUrlFileProcessedRef.current = true;
        const queryFileId = searchParams.get("fileId");
        if (queryFileId) {
          const matchingFile = loadedFiles.find(
            (f) => String(f.id) === String(queryFileId)
          );
          if (matchingFile) {
            setSelectedFileIds([matchingFile.id]);
          } else {
            setSelectedFileIds([]);
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.delete("fileId");
                return next;
              },
              { replace: true }
            );
          }
        } else {
          setSelectedFileIds([]);
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
  }, [activeCaseId]);

  useEffect(() => {
    loadCaseAndFiles();
  }, [loadCaseAndFiles]);

  // ------------------------------------------------------------
  // Selected Files Object & Selection Metrics
  // ------------------------------------------------------------
  const selectedFilesData = useMemo(() => {
    return files.filter((file) =>
      selectedFileIds.some((id) => String(id) === String(file.id))
    );
  }, [files, selectedFileIds]);

  const selectedCount = useMemo(() => {
    if (!files || files.length === 0 || selectedFileIds.length === 0) return 0;
    return files.filter((file) =>
      selectedFileIds.some((id) => String(id) === String(file.id))
    ).length;
  }, [files, selectedFileIds]);

  const isAllSelected = useMemo(() => {
    if (!files || files.length === 0) return false;
    return files.every((file) =>
      selectedFileIds.some((id) => String(id) === String(file.id))
    );
  }, [files, selectedFileIds]);

  // ------------------------------------------------------------
  // Handle File Selection Change (Single or Multiple)
  // ------------------------------------------------------------
  const handleSelectFile = (fileId) => {
    const normId = String(fileId);
    const isCurrentlySelected = selectedFileIds.some(
      (id) => String(id) === normId
    );

    let nextIds;
    if (isCurrentlySelected) {
      nextIds = selectedFileIds.filter((id) => String(id) !== normId);
    } else {
      nextIds = [
        ...selectedFileIds.filter((id) => String(id) !== normId),
        fileId,
      ];
    }

    setSelectedFileIds(nextIds);

    // Synchronize URL query parameter cleanly outside state updater
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextIds.length === 1) {
          next.set("fileId", String(nextIds[0]));
        } else {
          next.delete("fileId");
        }
        return next;
      },
      { replace: true }
    );

    // When all files are deselected, clear report data immediately
    if (nextIds.length === 0) {
      summaryReqIdRef.current++;
      txReqIdRef.current++;
      graphReqIdRef.current++;

      setSummary(null);
      setIsSummaryLoading(false);
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(0);
      setIsTxLoading(false);
      setTxError("");
      setGraphTransactions([]);
      setIsGraphLoading(false);
      setDynamicModeCounts({});
    }

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
    setSearchInput("");
    setActiveQuickFilter("all");
  };

  const handleSelectAllFiles = () => {
    if (!files || files.length === 0) return;
    const allIds = Array.from(new Set(files.map((f) => f.id)));
    setSelectedFileIds(allIds);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fileId");
        return next;
      },
      { replace: true }
    );

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
    setSearchInput("");
    setActiveQuickFilter("all");
  };

  const handleDeselectAllFiles = () => {
    setSelectedFileIds([]);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fileId");
        return next;
      },
      { replace: true }
    );

    summaryReqIdRef.current++;
    txReqIdRef.current++;
    graphReqIdRef.current++;

    setSummary(null);
    setIsSummaryLoading(false);
    setTransactions([]);
    setTotalTransactions(0);
    setTotalPages(0);
    setIsTxLoading(false);
    setTxError("");
    setGraphTransactions([]);
    setIsGraphLoading(false);
    setDynamicModeCounts({});
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      handleDeselectAllFiles();
    } else {
      handleSelectAllFiles();
    }
  };

  // ------------------------------------------------------------
  // Load Summary for Selected File
  // ------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    const reqId = ++summaryReqIdRef.current;

    if (!activeCaseId || selectedFileIds.length === 0) {
      setSummary(null);
      setIsSummaryLoading(false);
      return;
    }

    try {
      setIsSummaryLoading(true);
      const res = await getCaseTransactionSummary(
        activeCaseId,
        selectedFileIds.join(",")
      );
      if (reqId === summaryReqIdRef.current) {
        setSummary(res?.data || null);
      }
    } catch (err) {
      if (reqId === summaryReqIdRef.current) {
        console.error("Failed to load case summary:", err);
        setSummary(null);
      }
    } finally {
      if (reqId === summaryReqIdRef.current) {
        setIsSummaryLoading(false);
      }
    }
  }, [activeCaseId, selectedFileIds]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ------------------------------------------------------------
  // Load Filtered Transactions for Selected File
  // ------------------------------------------------------------
  const loadFilteredTransactions = useCallback(async () => {
    const reqId = ++txReqIdRef.current;

    if (!activeCaseId || selectedFileIds.length === 0) {
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(0);
      setDynamicModeCounts({});
      setIsTxLoading(false);
      setTxError("");
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

      if (reqId === txReqIdRef.current) {
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
      }
    } catch (err) {
      if (reqId === txReqIdRef.current) {
        console.error("Failed to load transactions for file:", err);
        setTxError(
          err?.response?.data?.detail ||
            err?.message ||
            "Unable to load transactions for this file."
        );
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(0);
        setDynamicModeCounts({});
      }
    } finally {
      if (reqId === txReqIdRef.current) {
        setIsTxLoading(false);
      }
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
    const reqId = ++graphReqIdRef.current;

    if (viewMode !== "graph" || !activeCaseId || selectedFileIds.length === 0) {
      setGraphTransactions([]);
      setIsGraphLoading(false);
      return;
    }

    // If current transactions already contain the complete dataset
    if (totalTransactions > 0 && transactions.length >= totalTransactions) {
      setGraphTransactions(transactions);
      return;
    }

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
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: 1,
          pageSize: Math.min(totalTransactions || 5000, 10000),
        });

        if (reqId === graphReqIdRef.current) {
          setGraphTransactions(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (reqId === graphReqIdRef.current) {
          console.error("Failed to load graph full transactions:", err);
          setGraphTransactions([]);
        }
      } finally {
        if (reqId === graphReqIdRef.current) {
          setIsGraphLoading(false);
        }
      }
    }

    fetchFullGraphData();
    return () => {
      graphReqIdRef.current++;
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
    if (Object.keys(dynamicModeCounts).length > 0) {
      return dynamicModeCounts;
    }

    const counts = {};
    if (Array.isArray(summary?.available_modes)) {
      summary.available_modes.forEach((item) => {
        if (item.mode) counts[item.mode.toUpperCase()] = item.count;
      });
    }
    
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

  // ------------------------------------------------------------
  // Comprehensive CSV Export (All Filtered Pages + Counter Party)
  // ------------------------------------------------------------
  const handleExportCSV = async () => {
    if (isExportingCSV) return;

    if (!activeCaseId || selectedFileIds.length === 0 || !totalTransactions) {
      Swal.fire({
        icon: "info",
        title: "No Data",
        text: selectedFileIds.length === 0
          ? "Please select at least one statement file to export transactions."
          : "There are no transactions matching your active filters to export.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#059669",
        customClass: {
          popup: "bas-popup",
        },
      });
      return;
    }

    setIsExportingCSV(true);
    Swal.fire({
      title: "Exporting Transactions...",
      html: `Preparing export for <b>${totalTransactions}</b> filtered transactions. Please wait...`,
      allowOutsideClick: false,
      showConfirmButton: false,
      background: "#ffffff",
      color: "#172554",
      customClass: {
        popup: "bas-popup",
      },
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const BATCH_SIZE = 5000;
      let allTransactions = [];
      let currentPage = 1;
      let expectedTotal = totalTransactions;

      while (true) {
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
          page: currentPage,
          pageSize: BATCH_SIZE,
        });

        const batch = Array.isArray(res?.data) ? res.data : [];
        if (!batch.length) break;

        allTransactions = allTransactions.concat(batch);
        expectedTotal = res?.total || expectedTotal;

        if (allTransactions.length >= expectedTotal || batch.length < BATCH_SIZE) {
          break;
        }

        currentPage += 1;
        if (currentPage > 20) break;
      }

      if (!allTransactions.length) {
        throw new Error("No transaction records retrieved for export.");
      }

      const headers = [
        "Index",
        "Statement File ID",
        "Transaction Date",
        "Account Name",
        "Account Number",
        "Payment Mode",
        "Narration / Description",
        "Counter Party Name",
        "Counter Party Type",
        "Counter Party Source",
        "Debit Amount (INR)",
        "Credit Amount (INR)",
        "Balance (INR)",
        "Cheque Number",
        "Reference Number",
        "PDF Source Page",
        "Row Index",
      ];

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = allTransactions.map((tx, idx) => {
        return [
          idx + 1,
          tx.file_id || "",
          tx.transaction_date || "",
          tx.account_name || "",
          tx.account_number || "",
          tx.mode || "",
          tx.description || tx.raw_narration || "",
          tx.counterparty_name || "",
          tx.counterparty_type || "",
          tx.counterparty_source || "",
          tx.debit !== null && tx.debit !== undefined ? tx.debit : "",
          tx.credit !== null && tx.credit !== undefined ? tx.credit : "",
          tx.balance !== null && tx.balance !== undefined ? tx.balance : "",
          tx.cheque_number || "",
          tx.reference_number || "",
          tx.source_page !== null && tx.source_page !== undefined ? tx.source_page : "",
          tx.source_row !== null && tx.source_row !== undefined ? tx.source_row : "",
        ];
      });

      const csvContent =
        "\uFEFF" +
        [
          headers.map(escapeCSV).join(","),
          ...rows.map((row) => row.map(escapeCSV).join(",")),
        ].join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute("download", `Bank_Statement_Transaction_Report_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Export Completed",
        text: `Successfully exported all ${allTransactions.length} filtered transactions to CSV.`,
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#059669",
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          popup: "bas-popup",
        },
      });
    } catch (err) {
      console.error("Export CSV failed:", err);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text: err?.response?.data?.detail || err?.message || "Failed to export all transactions. Please try again.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#dc2626",
        customClass: {
          popup: "bas-popup",
        },
      });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExport = handleExportCSV;

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
      sortBy: "transaction_date",
      sortOrder: "asc",
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

  return (
    <div className="arthbodh-user-dashboard relative min-h-screen bg-[#F5F8FC] text-[#172033] flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* SCOPED STYLES & MICRO-INTERACTIONS */}
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
          animation: arthbodhFadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .arthbodh-card-elevate {
          transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease;
        }

        .arthbodh-card-elevate:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -5px rgba(23, 37, 84, 0.08), 0 4px 6px -3px rgba(23, 37, 84, 0.03);
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

        .bas-popup {
          border: 1px solid #E2E8F0 !important;
          border-radius: 20px !important;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12) !important;
          background: #ffffff !important;
          color: #172554 !important;
          padding: 24px !important;
        }
      `}</style>

      {/* Subtle Ambient Light Grid Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-[450px] w-[450px] rounded-full bg-blue-200/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(226, 232, 240, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.8) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <BASNavbar />

      <main className="relative z-10 mx-auto w-full max-w-[1700px] px-4 py-8 sm:px-8 lg:px-10 pb-16 flex-1">
        {/* ===================================================
            HEADER & NAVIGATION
        ==================================================== */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 arthbodh-animate-entrance relative z-30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {/* Back & Navigation Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <button
                  type="button"
                  onClick={() => navigate(activeCaseId ? `/dashboard/cases/${activeCaseId}/reports` : "/dashboard/cases")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-300 active:scale-95 cursor-pointer"
                >
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Reports Center
                </button>

                {activeCaseId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/cases/${activeCaseId}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-blue-900 hover:border-blue-300 active:scale-95 cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Case Details
                  </button>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#059669]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                    Financial Investigation
                  </span>
                  <span className="h-3 w-px bg-slate-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Analytical Report
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                  Bank Statement & Transactions{" "}
                  <span className="text-[#059669]">Report</span>
                </h1>
              </div>

              {/* Context Badges (Client, User, Case, IO) */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                {isSuperAdmin && selectedClientObj && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/80 px-3.5 py-1.5 text-xs font-bold text-purple-900 shadow-2xs">
                    <span className="text-purple-700 font-semibold text-[11px] uppercase tracking-wider">
                      Client:
                    </span>
                    <span className="text-[#172554]">{selectedClientObj.name}</span>
                  </div>
                )}

                {isSuperAdmin && selectedUserObj && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-bold text-blue-900 shadow-2xs">
                    <span className="text-blue-700 font-semibold text-[11px] uppercase tracking-wider">
                      User:
                    </span>
                    <span className="text-[#172554]">{selectedUserObj.username}</span>
                  </div>
                )}

                {/* Case Name Badge */}
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
                    {caseData?.case_name
                      ? caseData.case_name
                      : activeCaseId
                      ? "Loading..."
                      : "Please Select a Case"}
                  </span>
                </div>

                {/* IO Name Badge */}
                <div className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-1.5 text-xs font-bold text-sky-900 shadow-2xs">
                  <svg
                    className="h-4 w-4 text-sky-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-sky-700 font-semibold text-[11px] uppercase tracking-wider">
                    IO:
                  </span>
                  <span className="text-[#172554]">
                    {caseData?.io?.officer_name
                      ? `${caseData.io.officer_name}${
                          caseData.io.designation
                            ? ` (${caseData.io.designation})`
                            : ""
                        }`
                      : "Not Assigned"}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-95 cursor-pointer"
              >
                <svg
                  className="h-4 w-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print Report
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={
                  isExportingCSV ||
                  selectedFileIds.length === 0 ||
                  totalTransactions === 0
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-[#047857] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                title="Export All Filtered Transactions across all pages to CSV"
              >
                {isExportingCSV ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Exporting CSV...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Export CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SUPER ADMIN: Cascading Client -> User -> Case -> Accounts */}
          {/* ========================================================= */}
          {isSuperAdmin ? (
            <section className="relative z-30 rounded-2xl border border-[#E2E8F0] bg-white/95 p-5 shadow-[0_8px_30px_rgba(23,37,84,0.06)] backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                      Tenant-Aware Cascading Scope
                    </p>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-[#172554]">
                    Select Client, User, Case & Accounts
                  </h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Follow the 4-step sequence to scope and analyze bank statement transactions.
                  </p>
                </div>

                {(selectedClientId || selectedUserId || activeCaseId) && (
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
                  value={activeCaseId}
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
                  onToggle={handleSelectFile}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleDeselectAllFiles}
                  disabled={
                    !activeCaseId || isCaseLoading || files.length === 0
                  }
                  loading={isCaseLoading}
                  getDisplayAccountNumber={getDisplayAccountNumber}
                  getDisplayAccountSubtitle={getDisplayBankSubtitle}
                  accountSearchQuery={accountSearchQuery}
                  setAccountSearchQuery={setAccountSearchQuery}
                />
              </div>
            </section>
          ) : (
            /* ========================================================= */
            /* NON-SUPERADMIN: Quick Case Switcher & Upgraded Accounts   */
            /* ========================================================= */
            <div className="relative z-30 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-900/5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SearchableDropdown
                  stepNumber={1}
                  label="Select / Switch Case"
                  value={activeCaseId}
                  options={allCases.map((c) => ({
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
                  loading={loadingAllCases}
                  disabled={loadingAllCases}
                  emptyMessage="No cases available"
                  badgeColor="emerald"
                />

                <SearchableAccountMultiSelect
                  stepNumber={2}
                  label="Select Accounts"
                  files={files}
                  selectedFileIds={selectedFileIds}
                  onToggle={handleSelectFile}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleDeselectAllFiles}
                  disabled={
                    !activeCaseId || isCaseLoading || files.length === 0
                  }
                  loading={isCaseLoading}
                  getDisplayAccountNumber={getDisplayAccountNumber}
                  getDisplayAccountSubtitle={getDisplayBankSubtitle}
                  accountSearchQuery={accountSearchQuery}
                  setAccountSearchQuery={setAccountSearchQuery}
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* EMPTY, LOADING & PROMPT STATES                            */}
        {/* ========================================================= */}

        {/* Prompt state: Super Admin has not selected a case yet */}
        {isSuperAdmin && !activeCaseId && (
          <div className="relative z-10 mt-8 rounded-2xl border border-dashed border-[#CBD5E1] bg-white/80 p-10 text-center shadow-sm backdrop-blur-sm sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/50">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#172554]">
              Select Client, User & Case to View Report
            </h3>
            <p className="mt-2 text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
              Please select a client company, user, and investigation case from the cascading dropdowns above to begin financial statement analysis.
            </p>
          </div>
        )}

        {/* Loading state for case files */}
        {activeCaseId && isCaseLoading && (
          <div className="relative z-10 mt-8 flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs font-semibold">
              Loading case statements & transactions...
            </p>
          </div>
        )}

        {/* Case Error State */}
        {activeCaseId && !isCaseLoading && caseError && (
          <div className="relative z-10 mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-rose-700">{caseError}</p>
          </div>
        )}

        {/* Empty state: No files uploaded to case */}
        {activeCaseId && !isCaseLoading && !caseError && files.length === 0 && (
          <div className="relative z-10 mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-extrabold text-[#172554]">
              No Statement Files Available
            </h3>
            <p className="mt-1.5 text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
              No statement files have been uploaded to this case yet. Please upload bank statements in Case Details first.
            </p>
            {activeCaseId && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/cases/${activeCaseId}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                >
                  Go to Case Details to Upload Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state: Case has files, but none selected */}
        {activeCaseId &&
          !isCaseLoading &&
          files.length > 0 &&
          selectedFileIds.length === 0 && (
            <div className="relative z-10 mt-8 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-10 sm:p-14 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-600 shadow-sm">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-extrabold text-[#172554]">
                No Statement File Selected
              </h3>
              <p className="mt-1.5 text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                Please select one or more account files above to view the financial statement summary and transaction analysis.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllFiles}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Select All {files.length} Accounts
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
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-50/40 via-white to-blue-50/30 p-6 shadow-sm shadow-slate-900/5 relative overflow-hidden">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl" />

              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between relative z-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-6 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                      Executive Report
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
                      {selectedFilesData.length} Selected Statement(s)
                    </span>
                    {isSummaryLoading && (
                      <span className="text-xs text-slate-500 animate-pulse flex items-center gap-1 font-medium">
                        <span className="h-3 w-3 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
                        Updating summary...
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#172554] sm:text-2xl">
                    Financial Statement Overview
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Period:{" "}
                      <strong className="text-[#172554] ml-1 font-bold">
                        {summary?.start_date ? formatDate(summary.start_date) : "N/A"}
                      </strong>{" "}
                      &rarr;{" "}
                      <strong className="text-[#172554] font-bold">
                        {summary?.end_date ? formatDate(summary.end_date) : "N/A"}
                      </strong>
                    </span>

                    <span className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-1.5 shadow-2xs">
                      <svg className="h-3.5 w-3.5 text-cyan-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Combined Turnover:{" "}
                      <strong className="text-cyan-900 ml-1 font-bold">
                        {formatCurrency(financialMetrics.totalTurnover)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Progress bar visual for Flow Distribution */}
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 min-w-[280px] sm:min-w-[340px] shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Debits: {financialMetrics.debitPercent}%
                    </span>
                    <span className="text-[#059669] font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#059669]" />
                      Credits: {financialMetrics.creditPercent}%
                    </span>
                  </div>
                  {/* Two-tone bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      style={{ width: `${financialMetrics.debitPercent}%` }}
                      className="h-full bg-rose-500 transition-all duration-500"
                      title={`Debits: ${financialMetrics.debitPercent}%`}
                    />
                    <div
                      style={{ width: `${financialMetrics.creditPercent}%` }}
                      className="h-full bg-[#059669] transition-all duration-500"
                      title={`Credits: ${financialMetrics.creditPercent}%`}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between font-medium">
                    <span>Cashflow Distribution</span>
                    <span className={financialMetrics.isPositive ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                      {financialMetrics.isPositive ? "Net Positive Inflow" : "Net Outflow Deficit"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Financial Metric Cards with rich design */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Transactions */}
              <div className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:border-cyan-300 arthbodh-card-elevate">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Transactions
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-2xs">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-[#172554]">
                  {summary ? summary.total_transactions.toLocaleString() : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  <span>Statements verified & analyzed</span>
                </div>
              </div>

              {/* Total Debits (Withdrawals) */}
              <div className="group relative rounded-2xl border border-rose-200/80 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:border-rose-300 arthbodh-card-elevate">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                    Total Debits (Dr)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 shadow-2xs">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 truncate" title={summary ? formatCurrency(summary.total_debits) : ""}>
                  {summary ? formatCurrency(summary.total_debits) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600/80 font-medium">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span>{financialMetrics.debitPercent}% of total movement</span>
                </div>
              </div>

              {/* Total Credits (Deposits) */}
              <div className="group relative rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:border-emerald-300 arthbodh-card-elevate">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Total Credits (Cr)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#059669] truncate" title={summary ? formatCurrency(summary.total_credits) : ""}>
                  {summary ? formatCurrency(summary.total_credits) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700/80 font-medium">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{financialMetrics.creditPercent}% of total movement</span>
                </div>
              </div>

              {/* Net Movement */}
              <div className={`group relative rounded-2xl border p-5 shadow-sm shadow-slate-900/5 transition arthbodh-card-elevate bg-white ${
                financialMetrics.isPositive
                  ? "border-emerald-200/80 hover:border-emerald-300"
                  : "border-rose-200/80 hover:border-rose-300"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${financialMetrics.isPositive ? "text-emerald-800" : "text-rose-700"}`}>
                    Net Movement
                  </span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-2xs ${
                    financialMetrics.isPositive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-600"
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
                  financialMetrics.isPositive ? "text-[#059669]" : "text-rose-600"
                }`}>
                  {summary ? formatCurrency(financialMetrics.netMovement) : "-"}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${financialMetrics.isPositive ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span>{financialMetrics.isPositive ? "Surplus (Inflow > Outflow)" : "Deficit (Outflow > Inflow)"}</span>
                </div>
              </div>
            </div>

            {/* ===================================================
                FILTER CONTROLS (Grid View Only)
            ==================================================== */}
            {viewMode === "grid" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 space-y-4">
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
                        className={`w-full rounded-xl border bg-slate-50/60 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition ${
                          searchError
                            ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                            : filters.search
                            ? "border-emerald-400 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 shadow-2xs"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                        }`}
                      />
                      <svg
                        className={`absolute left-3.5 top-3 h-4 w-4 transition ${
                          searchError
                            ? "text-rose-500"
                            : filters.search
                            ? "text-emerald-600"
                            : "text-slate-400"
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
                          className="absolute right-3 top-2.5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
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
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
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
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
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
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
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
                  <div className="lg:col-span-3">
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
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 pr-9 text-xs font-semibold text-slate-800 [color-scheme:light] transition focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            fromDateRef.current?.showPicker();
                          } catch (_) {}
                        }}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-600 transition"
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
                  <div className="lg:col-span-3">
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
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 pr-9 text-xs font-semibold text-slate-800 [color-scheme:light] transition focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            toDateRef.current?.showPicker();
                          } catch (_) {}
                        }}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-600 transition"
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
                </div>

                {/* Date range error warning */}
                {dateRangeError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700">
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
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition duration-200">
                    {/* Filter Suite Tabs */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab("amount")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                          activeFilterTab === "amount"
                            ? "bg-[#059669] text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                          activeFilterTab === "timing"
                            ? "bg-[#059669] text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        <span>⏱️ Timing & Days</span>
                        {filters.dayType && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFilterTab("keywords")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                          activeFilterTab === "keywords"
                            ? "bg-[#059669] text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                          activeFilterTab === "balance"
                            ? "bg-[#059669] text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                      {/* TAB: Amount & Structuring */}
                      {activeFilterTab === "amount" && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
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
                                  className={`rounded-lg px-3 py-1.5 text-xs transition cursor-pointer font-bold ${
                                    filters.amountPattern === item.id
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Min / Max Amount */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-1">
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
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-1">
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
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB: Timing & Days */}
                      {activeFilterTab === "timing" && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                            Day of the Week Filter:
                          </label>
                          <p className="text-xs text-slate-500">
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
                                className={`rounded-lg px-3 py-1.5 text-xs transition cursor-pointer font-bold ${
                                  filters.dayType === item.id
                                    ? "bg-purple-100 text-purple-900 border border-purple-300"
                                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TAB: Keywords & Audit */}
                      {activeFilterTab === "keywords" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-1">
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
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                            />
                            <p className="mt-1 text-[11px] text-slate-500 font-medium">
                              Removes regular salary or interest noise to expose suspect transactions.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-slate-200">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
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
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Has Cheque Number Only (Paper Clearing Audit)</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
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
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Has UTR / Reference ID Only (Electronic Audit)</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* TAB: Balance & Source Page */}
                      {activeFilterTab === "balance" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-1">
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
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-1">
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
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 items-center">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-700 hover:text-rose-800">
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
                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                              />
                              <span>⚠️ Low Balance Dips (Balance ≤ ₹1,000)</span>
                            </label>

                            <div className="flex items-center gap-2">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 shrink-0">
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
                                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
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
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mr-1">
                      Active Filters ({activeFiltersCount}):
                    </span>

                    {filters.search && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-800">
                        Search: &quot;{filters.search}&quot;
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("search")}
                          className="hover:text-emerald-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.transactionType && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700">
                        Type: {filters.transactionType.toUpperCase()}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("transactionType")}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {(filters.dateFrom || filters.dateTo) && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700">
                        Date: {filters.dateFrom || "Start"} to {filters.dateTo || "End"}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("dateRange")}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.channel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-800">
                        Mode: {filters.channel.toUpperCase()}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("channel")}
                          className="hover:text-emerald-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.amountPattern && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-xs font-bold text-amber-800">
                        Pattern: {filters.amountPattern}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("amountPattern")}
                          className="hover:text-amber-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {(filters.minAmount || filters.maxAmount) && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700">
                        Amount: ₹{filters.minAmount || "0"} - ₹{filters.maxAmount || "∞"}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("amountRange")}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.dayType && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-0.5 text-xs font-bold text-purple-800">
                        Days: {filters.dayType}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("dayType")}
                          className="hover:text-purple-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.excludeKeyword && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-0.5 text-xs font-bold text-rose-800">
                        Excluding: &quot;{filters.excludeKeyword}&quot;
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("excludeKeyword")}
                          className="hover:text-rose-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {(filters.minBalance || filters.maxBalance) && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700">
                        Balance: ₹{filters.minBalance || "0"} - ₹{filters.maxBalance || "∞"}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("balanceRange")}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.isLowBalance && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-0.5 text-xs font-bold text-rose-800">
                        Low Balance (&le; ₹1k)
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("isLowBalance")}
                          className="hover:text-rose-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.hasChequeOnly && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-bold text-blue-800">
                        Cheque Only
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("hasChequeOnly")}
                          className="hover:text-blue-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.hasReferenceOnly && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-bold text-blue-800">
                        Reference Only
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("hasReferenceOnly")}
                          className="hover:text-blue-950 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    {filters.sourcePage && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700">
                        PDF Page: {filters.sourcePage}
                        <button
                          type="button"
                          onClick={() => clearSingleFilter("sourcePage")}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="ml-auto text-xs text-rose-600 hover:text-rose-700 underline font-bold transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}

                {/* TRANSACTION MODE / CHANNEL (SINGLE SOURCE OF TRUTH) */}
                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Transaction Mode / Channel
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">
                      {allFilterModes.length} modes active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={!filters.channel}
                        onChange={() => {
                          setFilters((prev) => ({ ...prev, channel: "", page: 1 }));
                          setActiveQuickFilter("all");
                        }}
                        className="rounded border-slate-300 text-emerald-600 accent-[#059669] focus:ring-emerald-500 h-4 w-4"
                      />
                      <span className={!filters.channel ? "text-emerald-800 font-bold" : "text-slate-600"}>All Modes</span>
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
                          className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold rounded-lg px-2 py-1 border transition ${
                            isSelected
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold"
                              : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
                            className="rounded border-slate-300 text-emerald-600 accent-[#059669] focus:ring-emerald-500 h-3.5 w-3.5"
                          />
                          <span className="text-[13px] leading-none">{meta.icon}</span>
                          <span>{meta.label}</span>
                          {item.count > 0 && (
                            <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                              {item.count}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* DYNAMIC DATA-DRIVEN FILTERS & PAGE SIZE ROW */}
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Data Filters:
                      </span>

                      {/* All Flow */}
                      <button
                        type="button"
                        onClick={() => applyQuickFilter("all")}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                          activeQuickFilter === "all" && !filters.transactionType && !filters.channel
                            ? "bg-[#059669] text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        All Flow
                      </button>

                      {/* Debits */}
                      <button
                        type="button"
                        onClick={() => handleQuickFilterByType("debit")}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                          filters.transactionType === "debit"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        🔴 Debits
                      </button>

                      {/* Credits */}
                      <button
                        type="button"
                        onClick={() => handleQuickFilterByType("credit")}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                          filters.transactionType === "credit"
                            ? "bg-[#059669] text-white shadow-xs"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        🟢 Credits
                      </button>

                      {/* Debit/Credit Sub-Panel */}
                      {filters.transactionType && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                          <span className="text-[10px] uppercase text-slate-500 font-bold">
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
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition ${
                              filters.sortBy === 'amount' && filters.sortOrder === 'asc'
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
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
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition ${
                              filters.sortBy === 'amount' && filters.sortOrder === 'desc'
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
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
                              className="bg-white border border-slate-200 text-slate-800 text-[11px] rounded-lg px-2.5 py-1 w-36 focus:outline-none focus:border-emerald-500 font-medium"
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
                            ? "border-emerald-500 bg-[#059669] text-white shadow-xs"
                            : "border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100"
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
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-emerald-500 focus:outline-none cursor-pointer"
                      >
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                        <option value={200}>200 / page</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-slate-500 hover:text-slate-900 underline font-bold transition cursor-pointer"
                      >
                        Reset All
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE CUSTOM FILTER BUILDER */}
                  {showFilterBuilder && (
                    <form
                      onSubmit={handleApplyCustomFilter}
                      className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
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
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value="contains">Contains Keyword</option>
                          <option value="not_contains">Exclude Keyword</option>
                        </select>
                      )}

                      {(filterRuleField === "amount" || filterRuleField === "balance") && (
                        <select
                          value={filterRuleOperator}
                          onChange={(e) => setFilterRuleOperator(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value="debit">🔴 Debits Only</option>
                          <option value="credit">🟢 Credits Only</option>
                        </select>
                      )}

                      {filterRuleField === "mode" && (
                        <select
                          value={filterRuleValue}
                          onChange={(e) => setFilterRuleValue(e.target.value)}
                          className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value="has_any">Has Cheque / Ref Number</option>
                          <option value="contains">Matches Number</option>
                        </select>
                      )}

                      {filterRuleField === "date" && (
                        <select
                          value={filterRuleOperator}
                          onChange={(e) => setFilterRuleOperator(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                          className="w-52 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
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
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                          />
                          {filterRuleOperator === "between" && (
                            <>
                              <span className="text-slate-400 text-xs">to</span>
                              <input
                                type="number"
                                placeholder="Max ₹"
                                value={filterRuleValue2}
                                onChange={(e) => setFilterRuleValue2(e.target.value)}
                                className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
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
                          className="w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                        />
                      )}

                      {filterRuleField === "date" && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={filterRuleValue}
                            onChange={(e) => setFilterRuleValue(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 [color-scheme:light] focus:border-emerald-500 focus:outline-none cursor-pointer"
                          />
                          {filterRuleOperator === "between" && (
                            <>
                              <span className="text-slate-400 text-xs">to</span>
                              <input
                                type="date"
                                value={filterRuleValue2}
                                onChange={(e) => setFilterRuleValue2(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 [color-scheme:light] focus:border-emerald-500 focus:outline-none cursor-pointer"
                              />
                            </>
                          )}
                        </div>
                      )}

                      {/* Apply & Cancel */}
                      <button
                        type="submit"
                        className="rounded-lg bg-[#059669] hover:bg-[#047857] px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs cursor-pointer"
                      >
                        Apply Filter
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFilterBuilder(false)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
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
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-900/5">
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      viewMode === "graph"
                        ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {viewMode === "graph" ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="text-sm font-extrabold text-[#172554]">
                        {viewMode === "grid" ? "Filtered Transactions Ledger" : "Forensic Financial Analytics"}
                      </h4>
                      {viewMode === "graph" ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                            {(graphTransactions.length > 0 ? graphTransactions.length : transactions.length)} Plotted
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800">
                            Interactive Studio
                          </span>
                        </>
                      ) : (
                        selectedFileIds.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                            📁 Across {selectedFileIds.length} Statement Files
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5 font-medium">
                      {viewMode === "grid"
                        ? `Showing ${transactions.length} of ${totalTransactions} filtered transactions`
                        : "Explore transaction patterns, financial flows, and time-based trends."}
                    </p>
                  </div>
                </div>

                {/* View Switcher: Grid View vs Graph View & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={isExportingCSV || !transactions.length}
                    className="flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-emerald-900/10"
                    title="Export All Filtered Data across all pages to CSV"
                  >
                    {isExportingCSV ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Export CSV</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white text-[#172554] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
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
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        viewMode === "graph"
                          ? "bg-white text-[#172554] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
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
                    <div className="hidden sm:block text-xs text-slate-500 font-medium border-l border-slate-200 pl-3">
                      Page <span className="font-extrabold text-[#172554]">{filters.page}</span> of{" "}
                      <span className="font-extrabold text-[#172554]">{totalPages || 1}</span>
                    </div>
                  )}
                </div>
              </div>

              {txError && (
                <div className="mx-6 my-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-base">⚠️</span>
                    <span>{txError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadFilteredTransactions()}
                    className="rounded-lg bg-rose-100 px-3 py-1 font-bold text-rose-800 hover:bg-rose-200 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {viewMode === "graph" ? (
                <div className="p-6 bg-white">
                  {isGraphLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      <p className="text-xs font-semibold text-slate-500">Loading complete statement dataset for graph ({totalTransactions} transactions)...</p>
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
                    <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 border-b border-slate-200 bg-slate-50/60 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />
                        <span>Statement Legend:</span>
                      </span>
                      {selectedFileIds.map((fid) => {
                        const f = fileMap.get(String(fid));
                        if (!f) return null;
                        const col = getLightFileBadge(fid);
                        return (
                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${col.badge}`}
                            title={`Statement File: ${f.original_filename || getDisplayAccountNumber(f)}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                            <span className="truncate max-w-[170px] font-mono">{getDisplayAccountNumber(f)}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 select-none">
                          <th className="py-3.5 px-4">#</th>
                          {selectedFileIds.length > 1 && (
                            <th className="py-3.5 px-4 whitespace-nowrap text-cyan-800">
                              Statement File
                            </th>
                          )}
                          <th
                            onClick={() => handleSortColumn("transaction_date")}
                            className="py-3.5 px-4 whitespace-nowrap cursor-pointer hover:text-emerald-700 transition"
                            title="Click to sort by date"
                          >
                            Date {filters.sortBy === "transaction_date" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Account Name</th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Account Number</th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Mode</th>
                          <th
                            onClick={() => handleSortColumn("description")}
                            className="py-3.5 px-4 min-w-[280px] cursor-pointer hover:text-emerald-700 transition"
                            title="Click to sort by description"
                          >
                            Narration / Description {filters.sortBy === "description" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th className="py-3.5 px-4 whitespace-nowrap">Counter Party</th>
                          <th
                            onClick={() => handleSortColumn("debit")}
                            className="py-3.5 px-4 text-right whitespace-nowrap text-rose-600 cursor-pointer hover:text-rose-700 transition"
                            title="Click to sort by debit amount"
                          >
                            Debit (Dr) {filters.sortBy === "debit" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th
                            onClick={() => handleSortColumn("credit")}
                            className="py-3.5 px-4 text-right whitespace-nowrap text-[#059669] cursor-pointer hover:text-emerald-700 transition"
                            title="Click to sort by credit amount"
                          >
                            Credit (Cr) {filters.sortBy === "credit" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                          <th
                            onClick={() => handleSortColumn("balance")}
                            className="py-3.5 px-4 text-right whitespace-nowrap text-[#172554] cursor-pointer hover:text-emerald-700 transition"
                            title="Click to sort by balance"
                          >
                            Balance {filters.sortBy === "balance" ? (filters.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isTxLoading ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                <p className="text-xs font-semibold text-slate-500">Loading filtered transactions...</p>
                              </div>
                            </td>
                          </tr>
                        ) : selectedFileIds.length === 0 ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center text-slate-500">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </div>
                              <h4 className="text-sm font-extrabold text-[#172554]">No Statement Selected</h4>
                              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                                Please select one or more statement files from above to view the transactions grid.
                              </p>
                            </td>
                          </tr>
                        ) : transactions.length === 0 ? (
                          <tr>
                            <td colSpan={selectedFileIds.length > 1 ? 10 : 9} className="py-16 text-center">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <h4 className="text-sm font-extrabold text-[#172554]">No Matching Transactions</h4>
                              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                                No transactions match your active filters. Try adjusting your search keyword, dates, mode, or amount ranges.
                              </p>
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                              >
                                Clear Filters
                              </button>
                            </td>
                          </tr>
                        ) : (
                          transactions.map((tx, idx) => {
                            const rowNumber = (filters.page - 1) * filters.pageSize + idx + 1;
                            return (
                              <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                                  {rowNumber}
                                </td>
                                {selectedFileIds.length > 1 && (
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {(() => {
                                      const fileMatch = fileMap.get(String(tx.file_id));
                                      const fName = fileMatch ? getDisplayAccountNumber(fileMatch) : (tx.file_id ? `Account #${tx.file_id}` : "-");
                                      const col = getLightFileBadge(tx.file_id);

                                      return (
                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${col.badge} max-w-[190px]`}
                                          title={`Account: ${fName}`}
                                        >
                                          <span className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
                                          <span className="truncate font-mono">{fName}</span>
                                        </span>
                                      );
                                    })()}
                                  </td>
                                )}
                                <td className="py-3.5 px-4 font-mono whitespace-nowrap text-slate-700 font-semibold">
                                  {formatDate(tx.transaction_date)}
                                </td>
                                <td className="py-3.5 px-4 text-[#172554] font-semibold whitespace-nowrap">
                                  {tx.account_name ? (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickFilterByText(tx.account_name)}
                                      className="hover:text-emerald-700 hover:underline transition text-left cursor-pointer font-bold"
                                      title="Click to filter by this account"
                                    >
                                      {tx.account_name}
                                    </button>
                                  ) : "-"}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap font-medium">
                                  {tx.account_number || "-"}
                                </td>
                                <td className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                                  {tx.mode ? (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickFilterByMode(tx.mode)}
                                      className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition cursor-pointer font-bold"
                                      title={`Click to filter by mode: ${tx.mode}`}
                                    >
                                      {tx.mode}
                                    </button>
                                  ) : "-"}
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 break-words leading-relaxed max-w-md font-medium">
                                  <span
                                    onClick={() => handleQuickFilterByText(tx.description || tx.raw_narration)}
                                    className="cursor-pointer hover:text-emerald-700 transition-colors"
                                    title="Click to search / filter by this narration"
                                  >
                                    {tx.description || tx.raw_narration || "-"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs leading-5">
                                  {tx.counterparty_name ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="font-bold text-[#172554]">
                                        {tx.counterparty_name}
                                      </span>
                                      {tx.counterparty_identifier && (
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          ID: {tx.counterparty_identifier}
                                        </span>
                                      )}
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {tx.counterparty_type && (
                                          <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-800">
                                            {tx.counterparty_type}
                                          </span>
                                        )}
                                        {tx.counterparty_source && (
                                          <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-800">
                                            {tx.counterparty_source}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                  {tx.debit !== null && tx.debit !== undefined ? formatCurrency(tx.debit) : "-"}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-[#059669] whitespace-nowrap">
                                  {tx.credit !== null && tx.credit !== undefined ? formatCurrency(tx.credit) : "-"}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-[#172554] whitespace-nowrap">
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: Math.max(prev.page - 1, 1),
                      }))
                    }
                    disabled={filters.page <= 1 || isTxLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    &larr; Previous
                  </button>

                  <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                    <span>Page</span>
                    <span className="font-extrabold text-[#172554]">{filters.page}</span>
                    <span>of</span>
                    <span className="font-extrabold text-[#172554]">{totalPages}</span>
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
