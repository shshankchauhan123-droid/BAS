import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
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
  return file?.original_filename || `Account ${file?.id || ""}`;
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
// MAIN COMPONENT: TransactionRelationshipReport
// ============================================================

export default function TransactionRelationshipReport() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFileId = searchParams.get("fileId");

  // State
  const [activeCaseId, setActiveCaseId] = useState(caseId || "");
  const [allCases, setAllCases] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [modes, setModes] = useState([]);

  // Account dropdown state
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const accountDropdownRef = useRef(null);

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

  // ------------------------------------------------------------
  // LOAD CASES
  // ------------------------------------------------------------
  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setAllCases(list);

        if (!activeCaseId && list.length > 0) {
          setActiveCaseId(String(list[0].id));
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
      }
    }
    fetchCases();
  }, []);

  // ------------------------------------------------------------
  // LOAD FILES WHEN CASE CHANGES
  // ------------------------------------------------------------
  useEffect(() => {
    if (!activeCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      setAvailableDateRange({
        earliestDate: "",
        latestDate: "",
        loading: false,
      });
      return;
    }

    async function fetchFiles() {
      try {
        const res = await getCaseFiles(activeCaseId);
        const rawList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        const list = rawList.filter((f) => !f.is_superseded);
        setFiles(list);

        if (
          queryFileId &&
          list.some((f) => String(f.id) === String(queryFileId))
        ) {
          setSelectedFileIds([Number(queryFileId)]);
        } else if (list.length >= 1) {
          // Select all statements by default for rich multi-account relationship topology
          setSelectedFileIds(list.map((f) => f.id));
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
        setAvailableDateRange({
          earliestDate: "",
          latestDate: "",
          loading: false,
        });
      }
    }

    fetchFiles();
  }, [activeCaseId, queryFileId]);

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
  const toggleFileSelection = (fileId) => {
    setSelectedFileIds((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
  };

  const handleSelectAllFiles = () => {
    setSelectedFileIds(files.map((f) => f.id));
  };

  const handleClearAllFiles = () => {
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
  };

  // Filtered files for search inside dropdown
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
    return allCases.find((c) => String(c.id) === String(activeCaseId));
  }, [allCases, activeCaseId]);

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

        {/* ======================================================
            CONTROLS & FILTERS CONTAINER
        ====================================================== */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. CASE SELECTOR */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Case
              </label>
              <select
                value={activeCaseId}
                onChange={(e) => {
                  setActiveCaseId(e.target.value);
                  setFilters((prev) => ({
                    ...prev,
                    startDate: "",
                    endDate: "",
                  }));
                }}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition outline-none cursor-pointer shadow-2xs"
              >
                <option value="" disabled>
                  Select a case...
                </option>
                {allCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_name || `Case ${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. ACCOUNT NUMBER DROPDOWN (MULTI-SELECT) */}
            <div className="relative" ref={accountDropdownRef}>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Bank Accounts ({selectedFileIds.length})
              </label>

              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                disabled={!activeCaseId || files.length === 0}
                className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 shadow-2xs cursor-pointer ${
                  isAccountDropdownOpen
                    ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-white text-emerald-900"
                    : selectedFileIds.length > 0
                    ? "border-emerald-300 bg-emerald-50/50 text-emerald-900 hover:border-emerald-400"
                    : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-1.5 truncate">
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
                    {files.length === 0
                      ? "No Accounts"
                      : `Select Accounts (${selectedFileIds.length})`}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
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

              {/* Popover Dropdown Menu */}
              {isAccountDropdownOpen && (
                <div className="absolute left-0 mt-2 z-50 w-[340px] sm:w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
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

                  {/* Search Bar */}
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

                  {/* Select All Toggle */}
                  {files.length > 0 && (
                    <div className="px-1 py-1 mb-1.5 border-b border-slate-100 pb-2">
                      <div
                        className="flex items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 cursor-pointer select-none transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAllSelected) {
                            handleClearAllFiles();
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
                              toggleFileSelection(file.id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                toggleFileSelection(file.id);
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

                  {/* Dropdown Footer Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2 px-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearAllFiles();
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

            {/* 3. TRANSACTION MODE */}
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

            {/* 4. MINIMUM AMOUNT */}
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

            {/* 5. START DATE */}
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

            {/* 6. END DATE */}
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
        {!initialLoad && !error && (
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
        {!initialLoad && !error && (
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
        {initialLoad && !isLoading && !error && (
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
