import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
import {
  getTransactionRelationships,
  getTransactionModes,
} from "../../../services/api/bankTransaction";

import RelationshipGraph from "../../../components/reports/RelationshipGraph";

// ============================================================
// CURRENCY & NUMBER FORMATTERS
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

// ============================================================
// DATE NORMALIZATION & HELPERS
// ============================================================

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  // YYYY-MM-DD
  const isoMatch = stringValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(isoMatch[2]).padStart(2, "0");
    const day = String(isoMatch[3]).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  const dashMatch = stringValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const day = String(dashMatch[1]).padStart(2, "0");
    const month = String(dashMatch[2]).padStart(2, "0");
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY OR YYYY/MM/DD
  const slashMatch = stringValue.match(/^(\d{1,4})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const first = slashMatch[1];
    const second = slashMatch[2];
    const third = slashMatch[3];

    if (first.length === 4) {
      return `${first}-${String(second).padStart(2, "0")}-${String(third).padStart(2, "0")}`;
    }
    if (third.length === 4) {
      return `${third}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(stringValue);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

function getTransactionDate(transaction) {
  if (!transaction || typeof transaction !== "object") return null;

  const possibleDateFields = [
    "transaction_date",
    "transactionDate",
    "date",
    "txn_date",
    "txnDate",
    "value_date",
    "valueDate",
    "posting_date",
    "postingDate",
    "transaction_datetime",
    "transactionDateTime",
    "created_at",
    "createdAt",
  ];

  for (const field of possibleDateFields) {
    if (
      transaction[field] !== null &&
      transaction[field] !== undefined &&
      transaction[field] !== ""
    ) {
      const normalized = normalizeDate(transaction[field]);
      if (normalized) return normalized;
    }
  }

  return null;
}

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToString(date) {
  if (!date || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateBefore(date1, date2) {
  return date1 < date2;
}

function isDateAfter(date1, date2) {
  return date1 > date2;
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const date = parseLocalDate(dateString);
  if (!date) return dateString;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============================================================
// LIGHT DATE PICKER COMPONENT
// ============================================================

function DatePicker({
  value,
  minDate,
  maxDate,
  onChange,
  placeholder = "Select date",
  label,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const initialDate =
    value || minDate || maxDate || dateToString(new Date());
  const initialParsed = parseLocalDate(initialDate);

  const [visibleMonth, setVisibleMonth] = useState(
    initialParsed
      ? new Date(initialParsed.getFullYear(), initialParsed.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!value) return;
    const selectedDate = parseLocalDate(value);
    if (selectedDate) {
      setVisibleMonth(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      );
    }
  }, [value]);

  const handleOpen = () => {
    if (minDate) {
      const min = parseLocalDate(minDate);
      if (min) {
        setVisibleMonth(new Date(min.getFullYear(), min.getMonth(), 1));
      }
    }
    if (value) {
      const selected = parseLocalDate(value);
      if (selected) {
        setVisibleMonth(
          new Date(selected.getFullYear(), selected.getMonth(), 1)
        );
      }
    }
    setIsOpen((prev) => !prev);
  };

  const goPreviousMonth = () => {
    const previous = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1
    );
    if (minDate) {
      const min = parseLocalDate(minDate);
      if (min && previous < new Date(min.getFullYear(), min.getMonth(), 1)) {
        return;
      }
    }
    setVisibleMonth(previous);
  };

  const goNextMonth = () => {
    const next = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1
    );
    if (maxDate) {
      const max = parseLocalDate(maxDate);
      if (max && next > new Date(max.getFullYear(), max.getMonth(), 1)) {
        return;
      }
    }
    setVisibleMonth(next);
  };

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const calendarDays = [];
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const isSelectable = (date) => {
    if (!date) return false;
    const dateString = dateToString(date);
    if (minDate && isDateBefore(dateString, minDate)) return false;
    if (maxDate && isDateAfter(dateString, maxDate)) return false;
    return true;
  };

  const isSelected = (date) => {
    if (!date || !value) return false;
    return dateToString(date) === value;
  };

  const handleDateSelect = (date) => {
    if (!date || !isSelectable(date)) return;
    onChange(dateToString(date));
    setIsOpen(false);
  };

  const monthName = visibleMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const previousMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const previousDisabled =
    minDate &&
    previousMonth <
      new Date(
        parseLocalDate(minDate).getFullYear(),
        parseLocalDate(minDate).getMonth(),
        1
      );

  const nextDisabled =
    maxDate &&
    nextMonth >
      new Date(
        parseLocalDate(maxDate).getFullYear(),
        parseLocalDate(maxDate).getMonth(),
        1
      );

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={handleOpen}
        className={`w-full min-h-[42px] bg-slate-50/80 border rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center justify-between gap-2 transition outline-none shadow-2xs ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-white text-slate-800"
            : "border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300"
        }`}
      >
        <span className={value ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>

        <svg
          className="w-4 h-4 text-emerald-600 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[100] top-full left-0 mt-2 w-[310px] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 p-4">
          {/* CALENDAR HEADER */}
          <div className="flex items-center justify-between mb-3.5">
            <button
              type="button"
              onClick={goPreviousMonth}
              disabled={previousDisabled}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                previousDisabled
                  ? "border-slate-100 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="text-xs font-extrabold text-[#172554]">
              {monthName}
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              disabled={nextDisabled}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                nextDisabled
                  ? "border-slate-100 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* AVAILABLE RANGE */}
          {minDate && maxDate && (
            <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-[10px] text-emerald-800 text-center font-medium">
              Available:{" "}
              <span className="font-bold">{formatDisplayDate(minDate)}</span>
              {" → "}
              <span className="font-bold">{formatDisplayDate(maxDate)}</span>
            </div>
          )}

          {/* WEEK DAYS */}
          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
              <div
                key={day}
                className="h-7 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {/* DAYS */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const selectable = isSelectable(date);
              const selected = isSelected(date);

              return (
                <button
                  key={dateToString(date)}
                  type="button"
                  disabled={!selectable}
                  onClick={() => handleDateSelect(date)}
                  className={`h-8 rounded-lg text-xs font-semibold transition ${
                    selected
                      ? "bg-[#059669] text-white shadow-sm font-bold"
                      : selectable
                      ? "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* FOOTER */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              Select date
            </span>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SEARCHABLE DROPDOWN & MULTI-SELECT COMPONENTS
// ============================================================

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
// MAIN COMPONENT: TransactionRelationshipReport
// ============================================================

export default function TransactionRelationshipReport() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFileId = searchParams.get("fileId");
  const paramCaseId = searchParams.get("caseId") || caseId || "";

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
  const [activeCaseId, setActiveCaseId] = useState(paramCaseId || "");
  const [allCases, setAllCases] = useState([]);
  const [loadingAllCases, setLoadingAllCases] = useState(false);

  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [modes, setModes] = useState([]);

  // Race-condition safety refs
  const clientReqIdRef = useRef(0);
  const userReqIdRef = useRef(0);
  const caseReqIdRef = useRef(0);
  const analysisReqIdRef = useRef(0);
  const initialUrlFileProcessedRef = useRef(false);

  // Filters
  const [filters, setFilters] = useState({
    transactionMode: "All",
    minAmount: "",
    maxAmount: "",
    transactionType: "All",
    startDate: "",
    endDate: "",
  });

  // Graph Data
  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    transactions: [],
    summary: {},
  });

  // Available Date Range
  const [availableDateRange, setAvailableDateRange] = useState({
    earliestDate: "",
    latestDate: "",
    loading: false,
  });

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Zoom
  const [graphZoom, setGraphZoom] = useState(1);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.1;

  // ------------------------------------------------------------
  // ZOOM CONTROLS
  // ------------------------------------------------------------
  const zoomIn = () => {
    setGraphZoom((prev) =>
      Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2)))
    );
  };

  const zoomOut = () => {
    setGraphZoom((prev) =>
      Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2)))
    );
  };

  const resetZoom = () => {
    setGraphZoom(1);
  };

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
      setLoadingAllCases(true);
      try {
        const res = await getCases();
        if (!isMounted) return;
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setAllCases(list);

        if (
          paramCaseId &&
          list.some((c) => String(c.id) === String(paramCaseId))
        ) {
          setActiveCaseId(String(paramCaseId));
        } else if (list.length > 0 && !activeCaseId) {
          setActiveCaseId(String(list[0].id));
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load cases:", err);
      } finally {
        if (isMounted) setLoadingAllCases(false);
      }
    }
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, paramCaseId]);

  // Sync activeCaseId if paramCaseId changes (e.g. browser back/forward or navigation)
  useEffect(() => {
    if (paramCaseId && String(paramCaseId) !== String(activeCaseId)) {
      setActiveCaseId(String(paramCaseId));
      setSelectedFileIds([]);
      setAccountSearchQuery("");
      setFilters((prev) => ({
        ...prev,
        startDate: "",
        endDate: "",
      }));
      setAvailableDateRange({
        earliestDate: "",
        latestDate: "",
        loading: false,
      });
      setGraphData({
        nodes: [],
        edges: [],
        transactions: [],
        summary: {},
      });
      setInitialLoad(true);
      setError(null);
      initialUrlFileProcessedRef.current = false;
    }
  }, [paramCaseId, activeCaseId]);

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
    setActiveCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
    setAvailableDateRange({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);

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
    setActiveCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
    setAvailableDateRange({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);

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
    if (normCaseId === String(activeCaseId)) return;

    caseReqIdRef.current++;
    analysisReqIdRef.current++;

    setActiveCaseId(normCaseId);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
    setAvailableDateRange({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);
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
    setActiveCaseId("");
    setSuperAdminCases([]);
    setFiles([]);
    setSelectedFileIds([]);
    setAccountSearchQuery("");
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
    setAvailableDateRange({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);
    setSearchParams({});
  };

  // Handle Case Switching for non-SuperAdmin
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) return;
    handleCaseSelect(newCaseId);
  };

  // Load Files when Case changes
  useEffect(() => {
    if (!activeCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setAvailableDateRange({
        earliestDate: "",
        latestDate: "",
        loading: false,
      });
      setIsLoadingFiles(false);
      return;
    }

    let isMounted = true;
    async function fetchFiles() {
      setIsLoadingFiles(true);
      try {
        const [caseRes, filesRes] = await Promise.all([
          getCase(activeCaseId).catch(() => null),
          getCaseFiles(activeCaseId, false, "BANK_STATEMENT"),
        ]);
        if (!isMounted) return;

        const loadedCase = caseRes?.data || caseRes;
        const rawList = Array.isArray(filesRes?.data)
          ? filesRes.data
          : Array.isArray(filesRes)
          ? filesRes
          : [];

        const activeFiles = rawList.filter(
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
          queryFileId &&
          !initialUrlFileProcessedRef.current &&
          activeFiles.some((f) => String(f.id) === String(queryFileId))
        ) {
          initialUrlFileProcessedRef.current = true;
          setSelectedFileIds([Number(queryFileId)]);
        } else if (activeFiles.length >= 1) {
          // Select all statement files by default for rich multi-account relationship topology
          setSelectedFileIds(activeFiles.map((f) => f.id));
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
        setAvailableDateRange({
          earliestDate: "",
          latestDate: "",
          loading: false,
        });
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
  }, [activeCaseId, isSuperAdmin, queryFileId]);

  // ------------------------------------------------------------
  // LOAD TRANSACTION MODES
  // ------------------------------------------------------------
  useEffect(() => {
    async function fetchModes() {
      try {
        const res = await getTransactionModes();
        const modeList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setModes(modeList);
      } catch (err) {
        console.error("Failed to load modes:", err);
      }
    }
    fetchModes();
  }, []);

  // ------------------------------------------------------------
  // FIND AVAILABLE DATE RANGE BASED ON SELECTED FILES
  // ------------------------------------------------------------
  useEffect(() => {
    if (!activeCaseId || selectedFileIds.length === 0) {
      setAvailableDateRange({
        earliestDate: "",
        latestDate: "",
        loading: false,
      });
      return;
    }

    let cancelled = false;

    async function fetchAvailableDateRange() {
      setAvailableDateRange((prev) => ({
        ...prev,
        loading: true,
      }));

      try {
        const res = await getTransactionRelationships(activeCaseId, {
          fileIds: selectedFileIds,
          transactionMode: "All",
          minAmount: "",
          maxAmount: "",
          transactionType: "All",
          startDate: "",
          endDate: "",
        });

        if (cancelled) return;

        const transactions =
          res?.data?.transactions || res?.transactions || [];

        if (!Array.isArray(transactions) || transactions.length === 0) {
          setAvailableDateRange({
            earliestDate: "",
            latestDate: "",
            loading: false,
          });
          return;
        }

        const dates = transactions
          .map((transaction) => getTransactionDate(transaction))
          .filter(Boolean)
          .sort();

        if (dates.length === 0) {
          setAvailableDateRange({
            earliestDate: "",
            latestDate: "",
            loading: false,
          });
          return;
        }

        const earliestDate = dates[0];
        const latestDate = dates[dates.length - 1];

        setAvailableDateRange({
          earliestDate,
          latestDate,
          loading: false,
        });

        // Harmonize existing filter dates within bounds
        setFilters((prev) => {
          let newStartDate = prev.startDate;
          let newEndDate = prev.endDate;

          if (newStartDate && newStartDate < earliestDate) {
            newStartDate = earliestDate;
          }
          if (newStartDate && newStartDate > latestDate) {
            newStartDate = earliestDate;
          }
          if (newEndDate && newEndDate > latestDate) {
            newEndDate = latestDate;
          }
          if (newEndDate && newEndDate < earliestDate) {
            newEndDate = latestDate;
          }
          if (newStartDate && newEndDate && newStartDate > newEndDate) {
            newEndDate = latestDate;
          }

          return {
            ...prev,
            startDate: newStartDate,
            endDate: newEndDate,
          };
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to determine date range:", err);
        setAvailableDateRange({
          earliestDate: "",
          latestDate: "",
          loading: false,
        });
      }
    }

    fetchAvailableDateRange();

    return () => {
      cancelled = true;
    };
  }, [activeCaseId, selectedFileIds]);

  // Date change handlers
  const handleStartDateChange = (newStartDate) => {
    setFilters((prev) => {
      let newEndDate = prev.endDate;
      if (newEndDate && newStartDate && newStartDate > newEndDate) {
        newEndDate = newStartDate;
      }
      return {
        ...prev,
        startDate: newStartDate,
        endDate: newEndDate,
      };
    });
  };

  const handleEndDateChange = (newEndDate) => {
    setFilters((prev) => {
      let newStartDate = prev.startDate;
      if (newStartDate && newEndDate && newEndDate < newStartDate) {
        newStartDate = newEndDate;
      }
      return {
        ...prev,
        startDate: newStartDate,
        endDate: newEndDate,
      };
    });
  };

  // ------------------------------------------------------------
  // APPLY FILTERS & FETCH RELATIONSHIP GRAPH
  // ------------------------------------------------------------
  const handleApplyFilters = async () => {
    if (!activeCaseId) {
      setError("Please select a valid case.");
      return;
    }

    if (selectedFileIds.length < 1) {
      setError("Please select at least one account statement file.");
      setGraphData({
        nodes: [],
        edges: [],
        transactions: [],
        summary: {},
      });
      return;
    }

    if (
      filters.startDate &&
      availableDateRange.earliestDate &&
      filters.startDate < availableDateRange.earliestDate
    ) {
      setError(
        `Start date cannot be before ${formatDisplayDate(
          availableDateRange.earliestDate
        )}.`
      );
      return;
    }

    if (
      filters.endDate &&
      availableDateRange.latestDate &&
      filters.endDate > availableDateRange.latestDate
    ) {
      setError(
        `End date cannot be after ${formatDisplayDate(
          availableDateRange.latestDate
        )}.`
      );
      return;
    }

    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      setError("Start date cannot be after end date.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInitialLoad(false);

    const currentReqId = ++analysisReqIdRef.current;

    try {
      const res = await getTransactionRelationships(activeCaseId, {
        fileIds: selectedFileIds,
        ...filters,
      });

      if (currentReqId !== analysisReqIdRef.current) return;

      if (res?.data) {
        setGraphData({
          nodes: res.data.nodes || [],
          edges: res.data.edges || [],
          transactions: res.data.transactions || [],
          summary: res.data.summary || {},
        });
      } else {
        setGraphData({
          nodes: [],
          edges: [],
          transactions: [],
          summary: {},
        });
      }

      setGraphZoom(1);
    } catch (err) {
      if (currentReqId !== analysisReqIdRef.current) return;
      console.error("Relationship fetch error:", err);
      setError(
        err?.response?.data?.detail ||
          "Failed to load relationship graph. The backend may be offline."
      );
      setGraphData({
        nodes: [],
        edges: [],
        transactions: [],
        summary: {},
      });
    } finally {
      if (currentReqId === analysisReqIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // ------------------------------------------------------------
  // FILE SELECTION HANDLERS
  // ------------------------------------------------------------
  const handleFileToggle = (fileId) => {
    analysisReqIdRef.current++;
    setSelectedFileIds((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);
  };

  const handleSelectAllFiles = () => {
    analysisReqIdRef.current++;
    setSelectedFileIds(files.map((f) => f.id));
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);
  };

  const handleClearAllFiles = () => {
    analysisReqIdRef.current++;
    setSelectedFileIds([]);
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
    setAvailableDateRange({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });
    setGraphData({
      nodes: [],
      edges: [],
      transactions: [],
      summary: {},
    });
    setInitialLoad(true);
    setError(null);
  };

  const currentCase = useMemo(() => {
    const list = isSuperAdmin ? superAdminCases : allCases;
    return (list || []).find((c) => String(c.id) === String(activeCaseId));
  }, [isSuperAdmin, superAdminCases, allCases, activeCaseId]);

  // KPI Metrics
  const totalRelationships = graphData.summary?.relationship_count || 0;
  const totalTransactions = graphData.summary?.transaction_count || 0;
  const totalDebit = graphData.summary?.total_debit || 0;
  const totalCredit = graphData.summary?.total_credit || 0;
  const totalAmount = totalDebit + totalCredit;

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
            HEADER & ACTIONS
        ====================================================== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/80 pb-6">
          <div>
            {/* Back Button */}
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    activeCaseId
                      ? `/dashboard/cases/${activeCaseId}/reports`
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

              {activeCaseId && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/cases/${activeCaseId}`)}
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

            {/* Eyebrow and Title */}
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#059669]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                Financial Investigation
              </span>
              <span className="h-3 w-px bg-slate-300" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                Relationship Intelligence
              </span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
              Transaction Flow & Relationship{" "}
              <span className="text-[#059669]">Analysis</span>
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-3xl">
              Visualize multi-account fund flows, trace counterparty connections, and uncover hidden transaction paths across selected statements.
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
                {currentCase?.case_name || (activeCaseId ? `Case #${activeCaseId}` : "None")}
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
          </div>
        </div>

        {/* =========================================================
            CASCADING SELECTION PANEL
        ========================================================== */}
        <div className="relative z-30 mb-8">
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
                    Follow the 4-step sequence to scope and analyze transaction flow and relationship topology.
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
                  label="Select Bank Accounts"
                  files={files}
                  selectedFileIds={selectedFileIds}
                  onToggle={handleFileToggle}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleClearAllFiles}
                  disabled={
                    !activeCaseId || isLoadingFiles || files.length === 0
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
                  label="Select Bank Accounts"
                  files={files}
                  selectedFileIds={selectedFileIds}
                  onToggle={handleFileToggle}
                  onSelectAll={handleSelectAllFiles}
                  onClearAll={handleClearAllFiles}
                  disabled={
                    !activeCaseId || isLoadingFiles || files.length === 0
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
        {isSuperAdmin && !activeCaseId && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
              Select Client, User, and Case
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Choose a client company, assigned user, and investigation case from the cascading dropdowns above to analyze transaction flows and relationship topology.
            </p>
          </div>
        )}

        {!isSuperAdmin && !activeCaseId && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#172554] mb-1">
              Select an Investigation Case
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Choose a case from the dropdown above to analyze transaction flows and bank statement relationships.
            </p>
          </div>
        )}

        {activeCaseId && isLoadingFiles && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs mb-8">
            <div className="inline-flex items-center gap-3 text-emerald-600 font-semibold text-sm">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading case statement files...
            </div>
          </div>
        )}

        {activeCaseId && !isLoadingFiles && files.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs mb-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#172554] mb-1">
              No Statement Files Uploaded
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              This case has no bank statement files or accounts attached yet. Upload statement files to view relationship flow analysis.
            </p>
          </div>
        )}

        {activeCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs mb-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3 border border-blue-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#172554] mb-1">
              No Bank Accounts Selected
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
              Select one or more bank accounts from the dropdown above to generate relationship paths and entity interactions.
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

        {/* ======================================================
            GRAPH FILTERS & GENERATION CONTAINER
        ====================================================== */}
        {activeCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. TRANSACTION MODE */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Transaction Mode
                </label>
                <select
                  value={filters.transactionMode}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      transactionMode: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition outline-none cursor-pointer shadow-2xs"
                >
                  <option value="All">All Modes</option>
                  {modes.map((m, i) => (
                    <option key={i} value={m}>
                      {m}
                    </option>
                  ))}
                  {!modes.includes("UPI") && <option value="UPI">UPI</option>}
                  {!modes.includes("IMPS") && <option value="IMPS">IMPS</option>}
                  {!modes.includes("NEFT") && <option value="NEFT">NEFT</option>}
                  {!modes.includes("RTGS") && <option value="RTGS">RTGS</option>}
                  {!modes.includes("CASH") && <option value="CASH">CASH</option>}
                </select>
              </div>

              {/* 2. MINIMUM AMOUNT */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Min Amount (₹)
                </label>
                <select
                  value={filters.minAmount}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minAmount: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition outline-none cursor-pointer shadow-2xs"
                >
                  <option value="">Any Amount</option>
                  <option value="10000">{"> ₹10,000"}</option>
                  <option value="50000">{"> ₹50,000"}</option>
                  <option value="100000">{"> ₹1,00,000"}</option>
                  <option value="500000">{"> ₹5,00,000"}</option>
                </select>
              </div>

              {/* 3. START DATE */}
              <div>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  minDate={availableDateRange.earliestDate}
                  maxDate={filters.endDate || availableDateRange.latestDate}
                  onChange={handleStartDateChange}
                  placeholder={
                    availableDateRange.loading
                      ? "Loading..."
                      : "Select start date"
                  }
                />
              </div>

              {/* 4. END DATE */}
              <div>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  minDate={filters.startDate || availableDateRange.earliestDate}
                  maxDate={availableDateRange.latestDate}
                  onChange={handleEndDateChange}
                  placeholder={
                    availableDateRange.loading
                      ? "Loading..."
                      : "Select end date"
                  }
                />
              </div>
            </div>

            {/* SECONDARY ROW: TXN TYPE + DATE PERIOD INFO + ACTION */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Transaction Type Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Txn Type:
                  </span>
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, transactionType: "All" }))
                      }
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        filters.transactionType === "All"
                          ? "bg-white text-[#172554] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, transactionType: "debit" }))
                      }
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        filters.transactionType === "debit"
                          ? "bg-rose-50 text-rose-700 shadow-xs border border-rose-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Debits Only
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, transactionType: "credit" }))
                      }
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        filters.transactionType === "credit"
                          ? "bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Credits Only
                    </button>
                  </div>
                </div>

                {/* Date Period Indicator */}
                {selectedFileIds.length > 0 && availableDateRange.loading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    <span>Checking date range...</span>
                  </div>
                )}

                {selectedFileIds.length > 0 &&
                  !availableDateRange.loading &&
                  availableDateRange.earliestDate &&
                  availableDateRange.latestDate && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-xs">
                      <svg
                        className="w-3.5 h-3.5 text-emerald-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="17" rx="2" />
                        <path d="M16 2v4" />
                        <path d="M8 2v4" />
                        <path d="M3 10h18" />
                      </svg>
                      <span className="text-slate-600 font-medium">Period:</span>
                      <span className="font-bold text-emerald-800">
                        {formatDisplayDate(availableDateRange.earliestDate)}
                        {" → "}
                        {formatDisplayDate(availableDateRange.latestDate)}
                      </span>
                    </div>
                  )}
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  disabled={
                    isLoading ||
                    selectedFileIds.length < 1 ||
                    availableDateRange.loading
                  }
                  className={`w-full sm:w-auto px-7 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                    isLoading ||
                    selectedFileIds.length < 1 ||
                    availableDateRange.loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-[#059669] text-white hover:bg-[#047857] active:scale-95 shadow-emerald-700/10"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Generating Graph...</span>
                    </>
                  ) : availableDateRange.loading ? (
                    <>
                      <span className="w-4 h-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      <span>Loading Dates...</span>
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
                      <span>Apply Filters & Generate Graph</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            ERROR BANNER
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
            ANALYSIS SUMMARY KPI CARDS
        ====================================================== */}
        {activeCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && !initialLoad && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
            {/* 1. SELECTED ACCOUNTS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                Selected Accounts
              </span>
              <span className="text-2xl font-extrabold text-[#172554]">
                {selectedFileIds.length}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Statements in scope
              </span>
            </div>

            {/* 2. DIRECT RELATIONSHIPS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">
                Direct Relationships
              </span>
              <span className="text-2xl font-extrabold text-[#059669]">
                {totalRelationships}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Connected entities
              </span>
            </div>

            {/* 3. TRANSACTIONS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider mb-1">
                Matching Txns
              </span>
              <span className="text-2xl font-extrabold text-sky-700">
                {totalTransactions.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Filtered records
              </span>
            </div>

            {/* 4. TOTAL VOLUME */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-1">
                Total Volume
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-indigo-900 truncate" title={formatCurrency(totalAmount)}>
                {formatCurrency(totalAmount)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Debit + Credit
              </span>
            </div>

            {/* 5. TOTAL DEBIT */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1">
                <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span>Total Debit</span>
              </div>
              <span className="text-xl sm:text-2xl font-extrabold text-rose-600 truncate" title={formatCurrency(totalDebit)}>
                {formatCurrency(totalDebit)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Outflow volume
              </span>
            </div>

            {/* 6. TOTAL CREDIT */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-center shadow-xs transition hover:border-slate-300">
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span>Total Credit</span>
              </div>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 truncate" title={formatCurrency(totalCredit)}>
                {formatCurrency(totalCredit)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Inflow volume
              </span>
            </div>
          </div>
        )}

        {/* ======================================================
            GRAPH CONTAINER
        ====================================================== */}
        {activeCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && !initialLoad && !error && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden mb-8">
            {/* GRAPH HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-extrabold text-[#172554] tracking-tight">
                  Transaction Flow & Relationship Topology
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Interactive network graph of account statements, counterparties, and directional fund transfers.
                </p>
              </div>

              {/* ZOOM CONTROLS */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {/* ZOOM OUT */}
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={graphZoom <= MIN_ZOOM}
                  title="Zoom Out"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    graphZoom <= MIN_ZOOM
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                  </svg>
                </button>

                {/* ZOOM PERCENTAGE */}
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset Zoom (100%)"
                  className="min-w-[54px] h-8 px-2 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
                >
                  {Math.round(graphZoom * 100)}%
                </button>

                {/* ZOOM IN */}
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={graphZoom >= MAX_ZOOM}
                  title="Zoom In"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    graphZoom >= MAX_ZOOM
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>

                {/* RESET */}
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset to 100%"
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* GRAPH VIEWPORT */}
            <div
              className="relative w-full overflow-auto bg-slate-50/20"
              style={{
                height: "720px",
              }}
            >
              <div
                className="min-w-full min-h-full flex items-center justify-center"
                style={{
                  transform: `scale(${graphZoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s ease",
                  width: graphZoom > 1 ? `${graphZoom * 100}%` : "100%",
                  height: graphZoom > 1 ? `${graphZoom * 100}%` : "100%",
                }}
              >
                <div className="w-full h-full">
                  <RelationshipGraph
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    transactions={graphData.transactions}
                  />
                </div>
              </div>
            </div>

            {/* GRAPH FOOTER */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <svg
                  className="w-4 h-4 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                  <path d="M8 11h6" />
                  <path d="M11 8v6" />
                </svg>
                <span>
                  Click any account node or connection line to drill down into specific transactions.
                </span>
              </div>

              <div className="text-slate-500 font-medium">
                Active Zoom:{" "}
                <span className="text-[#059669] font-bold">
                  {Math.round(graphZoom * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            INITIAL EMPTY STATE
        ====================================================== */}
        {activeCaseId && !isLoadingFiles && files.length > 0 && selectedFileIds.length > 0 && initialLoad && !isLoading && !error && (
          <div className="h-[420px] border-2 border-dashed border-slate-200 bg-white/80 rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-xs">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            <h3 className="text-base font-extrabold text-[#172554] mb-1">
              Ready to Generate Transaction Relationship Graph
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6">
              Select one or more bank account statements from the dropdown above and click <span className="font-semibold text-emerald-800">Apply Filters & Generate Graph</span> to explore account interactions.
            </p>

            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={selectedFileIds.length === 0}
              className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Generate Graph with {selectedFileIds.length} Selected Account{selectedFileIds.length === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </main>

      <UserFooter />
    </div>
  );
}
