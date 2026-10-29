import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import html2pdf from "html2pdf.js";
import Swal from "sweetalert2";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
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
  return "Account number unavailable";
}

function getDisplayAccountSubtitle(file) {
  const parts = [];
  if (file?.bank_name) parts.push(file.bank_name);
  if (file?.original_filename) parts.push(file.original_filename);
  if (file?.file_size) parts.push(formatFileSize(file.file_size));
  return parts.join(" • ") || "Bank Statement Document";
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

// ============================================================
// MAIN COMPONENT: FinancialTransactionIntelligenceReport
// ============================================================

export default function FinancialTransactionIntelligenceReport() {
  const { caseId: routeCaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramCaseId = searchParams.get("caseId") || routeCaseId || "";
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
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");
  const [cases, setCases] = useState([]);
  const [isLoadingCases, setIsLoadingCases] = useState(false);

  // Files State
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

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

  // Race-condition safety refs
  const clientReqIdRef = useRef(0);
  const userReqIdRef = useRef(0);
  const caseReqIdRef = useRef(0);
  const analysisReqIdRef = useRef(0);
  const initialUrlFileProcessedRef = useRef(false);

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
    async function fetchCases() {
      setIsLoadingCases(true);
      try {
        const res = await getCases();
        if (!isMounted) return;
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
        if (!isMounted) return;
        console.error("Failed to load cases:", err);
      } finally {
        if (isMounted) setIsLoadingCases(false);
      }
    }

    fetchCases();
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
      setAnalysisData(null);
      setError(null);
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
    analysisReqIdRef.current++;

    setSelectedClientId(normClientId);
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setAnalysisData(null);
    setError(null);
    setFilters({
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      channel: "",
    });

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
    analysisReqIdRef.current++;

    setSelectedUserId(normUserId);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setAnalysisData(null);
    setError(null);
    setFilters({
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      channel: "",
    });

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
  const handleCaseSelect = (caseIdVal) => {
    const normCaseId = String(caseIdVal || "");
    if (normCaseId === String(selectedCaseId)) return;

    caseReqIdRef.current++;
    analysisReqIdRef.current++;

    setSelectedCaseId(normCaseId);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setAnalysisData(null);
    setError(null);
    setFilters({
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      channel: "",
    });
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
    analysisReqIdRef.current++;

    setSelectedClientId("");
    setSelectedUserId("");
    setSuperAdminUsers([]);
    setSelectedCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setAnalysisData(null);
    setError(null);
    setFilters({
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      minAmount: "",
      maxAmount: "",
      channel: "",
    });
    setSearchParams({});
  };

  // Handle Case Switching for non-SuperAdmin
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(selectedCaseId)) return;
    handleCaseSelect(newCaseId);
  };

  // Fetch files when selectedCaseId changes
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setAnalysisData(null);
      setError(null);
      setIsLoadingFiles(false);
      return;
    }

    let isMounted = true;
    async function fetchFiles() {
      setIsLoadingFiles(true);
      try {
        const [caseRes, filesRes] = await Promise.all([
          getCase(selectedCaseId).catch(() => null),
          getCaseFiles(selectedCaseId, false, "BANK_STATEMENT"),
        ]);
        if (!isMounted) return;

        const loadedCase = caseRes?.data || caseRes;
        const rawFiles = Array.isArray(filesRes?.data)
          ? filesRes.data
          : Array.isArray(filesRes)
          ? filesRes
          : [];
        const activeFiles = rawFiles.filter(
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
          setSelectedFileIds([Number(paramFileId)]);
        } else if (activeFiles.length > 0) {
          setSelectedFileIds(activeFiles.map((f) => f.id));
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
        setError("Failed to load statements for this case.");
      } finally {
        if (isMounted) {
          setIsLoadingFiles(false);
        }
      }
    }

    fetchFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, isSuperAdmin, paramFileId]);

  // Fetch Financial Analysis
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
    if (selectedFileIds.length > 0 && selectedCaseId) {
      fetchAnalysis(selectedFileIds);
    } else {
      setAnalysisData(null);
    }
  }, [selectedFileIds, selectedCaseId]);

  // File Selection Handlers
  const handleFileToggle = (fileId) => {
    analysisReqIdRef.current++;
    setSelectedFileIds((prev) => {
      const exists = prev.includes(fileId);
      if (exists) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
  };

  const handleSelectAllFiles = () => {
    analysisReqIdRef.current++;
    setSelectedFileIds(files.map((f) => f.id));
  };

  const handleClearFiles = () => {
    analysisReqIdRef.current++;
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

  const currentCase = useMemo(() => {
    const list = isSuperAdmin ? superAdminCases : cases;
    return (list || []).find((c) => String(c.id) === String(selectedCaseId));
  }, [isSuperAdmin, superAdminCases, cases, selectedCaseId]);

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

          {/* =========================================================
              CASCADING SELECTION PANEL
          ========================================================== */}
          <div className="relative z-30 mb-8 print:hidden" data-html2canvas-ignore="true">
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
                      Follow the 4-step sequence to scope and analyze financial transaction intelligence.
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
                    label="Select Bank Accounts"
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
                    getDisplayAccountSubtitle={getDisplayAccountSubtitle}
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
                        c.io?.officer_name ||
                        c.io?.name ||
                        (c.io_id ? `IO #${c.io_id}` : "Not Assigned")
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
                    label="Select Bank Accounts"
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
                    getDisplayAccountSubtitle={getDisplayAccountSubtitle}
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
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs mb-8 print:hidden" data-html2canvas-ignore="true">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
                Select Client, User, and Case
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Choose a client company, assigned user, and investigation case from the cascading dropdowns above to analyze financial transaction intelligence.
              </p>
            </div>
          )}

          {!isSuperAdmin && !selectedCaseId && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs mb-8 print:hidden" data-html2canvas-ignore="true">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
                Select an Investigation Case
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Choose a case from the dropdown above to view financial intelligence across statement accounts.
              </p>
            </div>
          )}

          {selectedCaseId && isLoadingFiles && (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs mb-8 print:hidden" data-html2canvas-ignore="true">
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
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs mb-8 print:hidden" data-html2canvas-ignore="true">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#172554] mb-1">
                No Statement Files Uploaded
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                This case has no bank statement files or accounts attached yet. Upload statement files to view financial intelligence.
              </p>
            </div>
          )}

          {selectedCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs mb-8 print:hidden" data-html2canvas-ignore="true">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3 border border-blue-200">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#172554] mb-1">
                No Bank Accounts Selected
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
                Select one or more bank accounts from the dropdown above to generate financial intelligence across transactions.
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
              SECONDARY FINANCIAL FILTERS (SCOPED TO SELECTED FILES)
          ========================================================== */}
          {selectedCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && (
            <div
              className="bg-white border border-slate-200/90 rounded-2xl p-5 mb-8 shadow-xs print:hidden"
              data-html2canvas-ignore="true"
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Financial Analysis Filters
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          )}

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
              LOADING STATE & ANALYSIS CONTENT
          ====================================================== */}
          {selectedCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && (
            <>
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
              !error && (
                <div className="h-[320px] border-2 border-dashed border-slate-200 bg-white/80 rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-xs mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#172554] mb-1">
                    No Financial Records Found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    No transactions matching the criteria were found in the selected statement files.
                  </p>
                </div>
              )
            )}
          </>
        )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}