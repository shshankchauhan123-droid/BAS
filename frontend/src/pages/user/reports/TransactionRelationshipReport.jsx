
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";

import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";

import {
  getTransactionRelationships,
  getTransactionModes,
} from "../../../services/api/bankTransaction";

import RelationshipGraph from "../../../components/reports/RelationshipGraph";

// ============================================================
// CURRENCY FORMAT
// ============================================================

function formatCurrency(amount) {
  if (
    amount === null ||
    amount === undefined ||
    isNaN(amount)
  ) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================
// DATE NORMALIZATION
// ============================================================

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return null;
  }

  // YYYY-MM-DD
  const isoMatch = stringValue.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(isoMatch[2]).padStart(2, "0");
    const day = String(isoMatch[3]).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  const dashMatch = stringValue.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/
  );

  if (dashMatch) {
    const day = String(dashMatch[1]).padStart(2, "0");
    const month = String(dashMatch[2]).padStart(2, "0");
    const year = dashMatch[3];

    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY OR YYYY/MM/DD
  const slashMatch = stringValue.match(
    /^(\d{1,4})\/(\d{1,2})\/(\d{2,4})$/
  );

  if (slashMatch) {
    const first = slashMatch[1];
    const second = slashMatch[2];
    const third = slashMatch[3];

    // YYYY/MM/DD
    if (first.length === 4) {
      return `${first}-${String(second).padStart(
        2,
        "0"
      )}-${String(third).padStart(2, "0")}`;
    }

    // DD/MM/YYYY
    if (third.length === 4) {
      return `${third}-${String(second).padStart(
        2,
        "0"
      )}-${String(first).padStart(2, "0")}`;
    }
  }

  // Final fallback
  const parsed = new Date(stringValue);

  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

// ============================================================
// GET TRANSACTION DATE
// ============================================================

function getTransactionDate(transaction) {
  if (!transaction || typeof transaction !== "object") {
    return null;
  }

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

      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

// ============================================================
// DATE HELPERS
// ============================================================

function parseLocalDate(dateString) {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day);
}

function dateToString(date) {
  if (!date || isNaN(date.getTime())) {
    return "";
  }

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
  if (!dateString) {
    return "";
  }

  const date = parseLocalDate(dateString);

  if (!date) {
    return dateString;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============================================================
// CUSTOM CALENDAR
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
    value ||
    minDate ||
    maxDate ||
    dateToString(new Date());

  const initialParsed = parseLocalDate(initialDate);

  const [visibleMonth, setVisibleMonth] = useState(
    initialParsed
      ? new Date(
          initialParsed.getFullYear(),
          initialParsed.getMonth(),
          1
        )
      : new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
  );

  // ----------------------------------------------------------
  // CLOSE WHEN CLICKING OUTSIDE
  // ----------------------------------------------------------

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ----------------------------------------------------------
  // UPDATE VISIBLE MONTH WHEN VALUE CHANGES
  // ----------------------------------------------------------

  useEffect(() => {
    if (!value) {
      return;
    }

    const selectedDate = parseLocalDate(value);

    if (selectedDate) {
      setVisibleMonth(
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          1
        )
      );
    }
  }, [value]);

  // ----------------------------------------------------------
  // OPEN CALENDAR
  // ----------------------------------------------------------

  const handleOpen = () => {
    if (minDate) {
      const min = parseLocalDate(minDate);

      if (min) {
        setVisibleMonth(
          new Date(
            min.getFullYear(),
            min.getMonth(),
            1
          )
        );
      }
    }

    if (value) {
      const selected = parseLocalDate(value);

      if (selected) {
        setVisibleMonth(
          new Date(
            selected.getFullYear(),
            selected.getMonth(),
            1
          )
        );
      }
    }

    setIsOpen((prev) => !prev);
  };

  // ----------------------------------------------------------
  // MONTH NAVIGATION
  // ----------------------------------------------------------

  const goPreviousMonth = () => {
    const previous = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1
    );

    if (minDate) {
      const min = parseLocalDate(minDate);

      if (
        min &&
        previous <
          new Date(
            min.getFullYear(),
            min.getMonth(),
            1
          )
      ) {
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

      if (
        max &&
        next >
          new Date(
            max.getFullYear(),
            max.getMonth(),
            1
          )
      ) {
        return;
      }
    }

    setVisibleMonth(next);
  };

  // ----------------------------------------------------------
  // MONTH DATA
  // ----------------------------------------------------------

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();

  /**
   * Convert Sunday=0 to Monday=0.
   */
  const startingDay =
    firstDay.getDay() === 0
      ? 6
      : firstDay.getDay() - 1;

  const calendarDays = [];

  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(
      new Date(year, month, day)
    );
  }

  // ----------------------------------------------------------
  // DATE VALIDATION
  // ----------------------------------------------------------

  const isSelectable = (date) => {
    if (!date) {
      return false;
    }

    const dateString = dateToString(date);

    if (minDate && isDateBefore(dateString, minDate)) {
      return false;
    }

    if (maxDate && isDateAfter(dateString, maxDate)) {
      return false;
    }

    return true;
  };

  const isSelected = (date) => {
    if (!date || !value) {
      return false;
    }

    return dateToString(date) === value;
  };

  // ----------------------------------------------------------
  // DATE CLICK
  // ----------------------------------------------------------

  const handleDateSelect = (date) => {
    if (!date || !isSelectable(date)) {
      return;
    }

    const selectedDate = dateToString(date);

    onChange(selectedDate);

    setIsOpen(false);
  };

  // ----------------------------------------------------------
  // MONTH NAME
  // ----------------------------------------------------------

  const monthName = visibleMonth.toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    }
  );

  // ----------------------------------------------------------
  // NAVIGATION DISABLED STATES
  // ----------------------------------------------------------

  const previousMonth = new Date(
    year,
    month - 1,
    1
  );

  const nextMonth = new Date(
    year,
    month + 1,
    1
  );

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
    <div
      ref={containerRef}
      className="relative w-full"
    >
      {/* LABEL */}

      {label && (
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}

      {/* DATE BUTTON */}

      <button
        type="button"
        onClick={handleOpen}
        className={`w-full min-h-[43px] bg-[#020b09] border rounded-xl px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition outline-none ${
          isOpen
            ? "border-emerald-400 ring-1 ring-emerald-400/30"
            : "border-white/[0.1] hover:border-white/[0.2]"
        }`}
      >
        <span
          className={
            value
              ? "text-white"
              : "text-slate-500"
          }
        >
          {value
            ? formatDisplayDate(value)
            : placeholder}
        </span>

        {/* CALENDAR ICON */}

        <svg
          className="w-5 h-5 text-emerald-400 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
          />

          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />

          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />

          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      </button>

      {/* CALENDAR */}

      {isOpen && (
        <div className="absolute z-[100] top-full left-0 mt-2 w-[310px] bg-[#071713] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/50 p-4">

          {/* CALENDAR HEADER */}

          <div className="flex items-center justify-between mb-4">

            <button
              type="button"
              onClick={goPreviousMonth}
              disabled={previousDisabled}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                previousDisabled
                  ? "border-white/[0.05] text-slate-700 cursor-not-allowed"
                  : "border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="text-sm font-bold text-white">
              {monthName}
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              disabled={nextDisabled}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                nextDisabled
                  ? "border-white/[0.05] text-slate-700 cursor-not-allowed"
                  : "border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

          </div>

          {/* AVAILABLE RANGE */}

          {minDate && maxDate && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[10px] text-slate-400 text-center">
              Available:{" "}
              <span className="text-emerald-400 font-semibold">
                {formatDisplayDate(minDate)}
              </span>{" "}
              →{" "}
              <span className="text-emerald-400 font-semibold">
                {formatDisplayDate(maxDate)}
              </span>
            </div>
          )}

          {/* WEEK DAYS */}

          <div className="grid grid-cols-7 gap-1 mb-2">

            {[
              "Mo",
              "Tu",
              "We",
              "Th",
              "Fr",
              "Sa",
              "Su",
            ].map((day) => (
              <div
                key={day}
                className="h-8 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase"
              >
                {day}
              </div>
            ))}

          </div>

          {/* DAYS */}

          <div className="grid grid-cols-7 gap-1">

            {calendarDays.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-9"
                  />
                );
              }

              const selectable =
                isSelectable(date);

              const selected =
                isSelected(date);

              return (
                <button
                  key={dateToString(date)}
                  type="button"
                  disabled={!selectable}
                  onClick={() =>
                    handleDateSelect(date)
                  }
                  className={`h-9 rounded-lg text-xs font-semibold transition ${
                    selected
                      ? "bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
                      : selectable
                        ? "text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300"
                        : "text-slate-700 cursor-not-allowed"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}

          </div>

          {/* FOOTER */}

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">

            <span className="text-[10px] text-slate-600">
              Select a date
            </span>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-[10px] font-semibold text-rose-400 hover:text-rose-300"
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
// MAIN REPORT
// ============================================================

export default function TransactionRelationshipReport() {
  const { caseId } = useParams();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const queryFileId = searchParams.get("fileId");

  // ============================================================
  // CASE
  // ============================================================

  const [activeCaseId, setActiveCaseId] = useState(
    caseId || ""
  );

  const [allCases, setAllCases] = useState([]);

  // ============================================================
  // FILES
  // ============================================================

  const [files, setFiles] = useState([]);

  const [selectedFileIds, setSelectedFileIds] =
    useState([]);

  // ============================================================
  // TRANSACTION MODES
  // ============================================================

  const [modes, setModes] = useState([]);

  // ============================================================
  // FILTERS
  // ============================================================

  const [filters, setFilters] = useState({
    transactionMode: "All",
    minAmount: "",
    maxAmount: "",
    transactionType: "All",
    startDate: "",
    endDate: "",
  });

  // ============================================================
  // GRAPH DATA
  // ============================================================

  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    transactions: [],
    summary: {},
  });

  // ============================================================
  // AVAILABLE DATE RANGE
  // ============================================================

  const [availableDateRange, setAvailableDateRange] =
    useState({
      earliestDate: "",
      latestDate: "",
      loading: false,
    });

  // ============================================================
  // STATES
  // ============================================================

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState(null);

  const [initialLoad, setInitialLoad] =
    useState(true);

  // ============================================================
  // GRAPH ZOOM
  // ============================================================

  const [graphZoom, setGraphZoom] = useState(1);

  const MIN_ZOOM = 0.5;

  const MAX_ZOOM = 2;

  const ZOOM_STEP = 0.1;

  const zoomIn = () => {
    setGraphZoom((prev) =>
      Math.min(
        MAX_ZOOM,
        Number(
          (prev + ZOOM_STEP).toFixed(2)
        )
      )
    );
  };

  const zoomOut = () => {
    setGraphZoom((prev) =>
      Math.max(
        MIN_ZOOM,
        Number(
          (prev - ZOOM_STEP).toFixed(2)
        )
      )
    );
  };

  const resetZoom = () => {
    setGraphZoom(1);
  };

  // ============================================================
  // LOAD CASES
  // ============================================================

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
      } catch (err) {
        console.error(
          "Failed to load cases:",
          err
        );
      }
    }

    fetchCases();
  }, []);

  // ============================================================
  // LOAD FILES
  // ============================================================

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
        const res =
          await getCaseFiles(activeCaseId);

        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

        setFiles(list);

        if (
          queryFileId &&
          list.some(
            (f) =>
              f.id.toString() ===
              queryFileId.toString()
          )
        ) {
          setSelectedFileIds([
            Number(queryFileId),
          ]);
        } else if (list.length >= 1) {
          setSelectedFileIds([
            list[0].id,
          ]);
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        console.error(
          "Failed to load files:",
          err
        );

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

  // ============================================================
  // LOAD TRANSACTION MODES
  // ============================================================

  useEffect(() => {
    async function fetchModes() {
      try {
        const res =
          await getTransactionModes();

        const modeList =
          Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];

        setModes(modeList);
      } catch (err) {
        console.error(
          "Failed to load modes:",
          err
        );
      }
    }

    fetchModes();
  }, []);

  // ============================================================
  // FIND AVAILABLE DATE RANGE
  // ============================================================

  useEffect(() => {
    if (
      !activeCaseId ||
      selectedFileIds.length === 0
    ) {
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
        const res =
          await getTransactionRelationships(
            activeCaseId,
            {
              fileIds: selectedFileIds,

              transactionMode: "All",

              minAmount: "",

              maxAmount: "",

              transactionType: "All",

              startDate: "",

              endDate: "",
            }
          );

        if (cancelled) {
          return;
        }

        const transactions =
          res?.data?.transactions ||
          res?.transactions ||
          [];

        if (
          !Array.isArray(
            transactions
          ) ||
          transactions.length === 0
        ) {
          setAvailableDateRange({
            earliestDate: "",
            latestDate: "",
            loading: false,
          });

          return;
        }

        const dates = transactions
          .map((transaction) =>
            getTransactionDate(
              transaction
            )
          )
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

        const latestDate =
          dates[dates.length - 1];

        setAvailableDateRange({
          earliestDate,
          latestDate,
          loading: false,
        });

        // ------------------------------------------------------
        // FIX EXISTING FILTER VALUES
        // ------------------------------------------------------

        setFilters((prev) => {
          let newStartDate =
            prev.startDate;

          let newEndDate =
            prev.endDate;

          if (
            newStartDate &&
            newStartDate < earliestDate
          ) {
            newStartDate = earliestDate;
          }

          if (
            newStartDate &&
            newStartDate > latestDate
          ) {
            newStartDate = earliestDate;
          }

          if (
            newEndDate &&
            newEndDate > latestDate
          ) {
            newEndDate = latestDate;
          }

          if (
            newEndDate &&
            newEndDate < earliestDate
          ) {
            newEndDate = latestDate;
          }

          if (
            newStartDate &&
            newEndDate &&
            newStartDate > newEndDate
          ) {
            newEndDate = latestDate;
          }

          return {
            ...prev,

            startDate:
              newStartDate,

            endDate:
              newEndDate,
          };
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to determine available transaction date range:",
          err
        );

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
  }, [
    activeCaseId,
    selectedFileIds,
  ]);

  // ============================================================
  // START DATE
  // ============================================================

  const handleStartDateChange = (
    newStartDate
  ) => {
    setFilters((prev) => {
      let newEndDate =
        prev.endDate;

      if (
        newEndDate &&
        newStartDate &&
        newStartDate > newEndDate
      ) {
        newEndDate =
          newStartDate;
      }

      return {
        ...prev,

        startDate:
          newStartDate,

        endDate:
          newEndDate,
      };
    });
  };

  // ============================================================
  // END DATE
  // ============================================================

  const handleEndDateChange = (
    newEndDate
  ) => {
    setFilters((prev) => {
      let newStartDate =
        prev.startDate;

      if (
        newStartDate &&
        newEndDate &&
        newEndDate < newStartDate
      ) {
        newStartDate =
          newEndDate;
      }

      return {
        ...prev,

        startDate:
          newStartDate,

        endDate:
          newEndDate,
      };
    });
  };

  // ============================================================
  // APPLY FILTERS
  // ============================================================

  const handleApplyFilters =
    async () => {
      if (!activeCaseId) {
        setError(
          "Please select a case."
        );

        return;
      }

      if (
        selectedFileIds.length < 1
      ) {
        setError(
          "Please select at least one file to find relationships."
        );

        setGraphData({
          nodes: [],
          edges: [],
          transactions: [],
          summary: {},
        });

        return;
      }

      // --------------------------------------------------------
      // DATE VALIDATION
      // --------------------------------------------------------

      if (
        filters.startDate &&
        availableDateRange.earliestDate &&
        filters.startDate <
          availableDateRange.earliestDate
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
        filters.endDate >
          availableDateRange.latestDate
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
        filters.startDate >
          filters.endDate
      ) {
        setError(
          "Start date cannot be after end date."
        );

        return;
      }

      setIsLoading(true);

      setError(null);

      setInitialLoad(false);

      try {
        const res =
          await getTransactionRelationships(
            activeCaseId,
            {
              fileIds:
                selectedFileIds,

              ...filters,
            }
          );

        if (res?.data) {
          setGraphData({
            nodes:
              res.data.nodes || [],

            edges:
              res.data.edges || [],

            transactions:
              res.data.transactions ||
              [],

            summary:
              res.data.summary ||
              {},
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
        console.error(err);

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
        setIsLoading(false);
      }
    };

  // ============================================================
  // KPI
  // ============================================================

  const totalRelationships =
    graphData.summary
      ?.relationship_count || 0;

  const totalTransactions =
    graphData.summary
      ?.transaction_count || 0;

  const totalDebit =
    graphData.summary?.total_debit ||
    0;

  const totalCredit =
    graphData.summary?.total_credit ||
    0;

  const totalAmount =
    totalDebit + totalCredit;

  // ============================================================
  // FILE SELECTION
  // ============================================================

  const toggleFileSelection = (
    fileId
  ) => {
    setSelectedFileIds((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter(
          (id) => id !== fileId
        );
      }

      return [
        ...prev,
        fileId,
      ];
    });
  };

  // ============================================================
  // SELECT ALL
  // ============================================================

  const handleSelectAllFiles =
    () => {
      setSelectedFileIds(
        files.map((f) => f.id)
      );
    };

  // ============================================================
  // CLEAR ALL
  // ============================================================

  const handleClearAllFiles =
    () => {
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#020b09] text-white flex flex-col font-sans overflow-x-hidden">

      <BASNavbar />

      <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

          <div>

            <h1 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
              Transaction Flow Report
            </h1>

            <p className="mt-1.5 text-sm text-slate-400">
              Visualize monetary flows and relationships between multiple bank statements.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/dashboard/cases"
              )
            }
            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            Back to Cases
          </button>

        </div>

        {/* ======================================================
            CONTROLS
        ====================================================== */}

        <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-6 mb-8 shadow-2xl">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">

            {/* CASE */}

            <div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Case
              </label>

              <select
                value={
                  activeCaseId
                }
                onChange={(e) => {
                  setActiveCaseId(
                    e.target.value
                  );

                  setFilters(
                    (prev) => ({
                      ...prev,
                      startDate: "",
                      endDate: "",
                    })
                  );
                }}
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition outline-none"
              >

                <option
                  value=""
                  disabled
                >
                  Select a case...
                </option>

                {allCases.map(
                  (c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.case_name ||
                        `Case ${c.id}`}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* TRANSACTION MODE */}

            <div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Transaction Mode
              </label>

              <select
                value={
                  filters.transactionMode
                }
                onChange={(e) =>
                  setFilters(
                    (f) => ({
                      ...f,
                      transactionMode:
                        e.target.value,
                    })
                  )
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >

                <option value="All">
                  All Modes
                </option>

                {modes.map(
                  (m, i) => (
                    <option
                      key={i}
                      value={m}
                    >
                      {m}
                    </option>
                  )
                )}

                <option value="UPI">
                  UPI
                </option>

                <option value="IMPS">
                  IMPS
                </option>

                <option value="NEFT">
                  NEFT
                </option>

                <option value="RTGS">
                  RTGS
                </option>

                <option value="CASH">
                  CASH
                </option>

              </select>

            </div>

            {/* MINIMUM AMOUNT */}

            <div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Min Amount (₹)
              </label>

              <select
                value={
                  filters.minAmount
                }
                onChange={(e) =>
                  setFilters(
                    (f) => ({
                      ...f,
                      minAmount:
                        e.target.value,
                    })
                  )
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >

                <option value="">
                  Any Amount
                </option>

                <option value="10000">
                  {"> ₹10,000"}
                </option>

                <option value="50000">
                  {"> ₹50,000"}
                </option>

                <option value="100000">
                  {"> ₹1,00,000"}
                </option>

                <option value="500000">
                  {"> ₹5,00,000"}
                </option>

              </select>

            </div>

            {/* TRANSACTION TYPE */}

            <div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Txn Type
              </label>

              <select
                value={
                  filters.transactionType
                }
                onChange={(e) =>
                  setFilters(
                    (f) => ({
                      ...f,
                      transactionType:
                        e.target.value,
                    })
                  )
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >

                <option value="All">
                  All (Debit & Credit)
                </option>

                <option value="debit">
                  Debits Only
                </option>

                <option value="credit">
                  Credits Only
                </option>

              </select>

            </div>

            {/* START DATE */}

            <DatePicker
              label="Start Date"
              value={
                filters.startDate
              }
              minDate={
                availableDateRange.earliestDate
              }
              maxDate={
                filters.endDate ||
                availableDateRange.latestDate
              }
              onChange={
                handleStartDateChange
              }
              placeholder={
                availableDateRange.loading
                  ? "Loading dates..."
                  : "Select start date"
              }
            />

            {/* END DATE */}

            <DatePicker
              label="End Date"
              value={
                filters.endDate
              }
              minDate={
                filters.startDate ||
                availableDateRange.earliestDate
              }
              maxDate={
                availableDateRange.latestDate
              }
              onChange={
                handleEndDateChange
              }
              placeholder={
                availableDateRange.loading
                  ? "Loading dates..."
                  : "Select end date"
              }
            />

          </div>

          {/* ====================================================
              DATE RANGE INFORMATION
          ==================================================== */}

          {selectedFileIds.length >
            0 &&
            availableDateRange.loading && (
              <div className="mt-5 flex items-center gap-2 text-xs text-emerald-400">

                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    strokeOpacity="0.25"
                  />

                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>

                Checking available transaction dates...

              </div>
            )}

          {selectedFileIds.length >
            0 &&
            !availableDateRange.loading &&
            availableDateRange.earliestDate &&
            availableDateRange.latestDate && (
              <div className="mt-5 px-4 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">

                  <div className="flex items-center gap-2 text-slate-400">

                    <svg
                      className="w-4 h-4 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="17"
                        rx="2"
                      />

                      <path d="M16 2v4" />
                      <path d="M8 2v4" />
                      <path d="M3 10h18" />
                    </svg>

                    <span>
                      Available transaction period:
                    </span>

                  </div>

                  <span className="font-semibold text-emerald-400">
                    {formatDisplayDate(
                      availableDateRange.earliestDate
                    )}

                    {" → "}

                    {formatDisplayDate(
                      availableDateRange.latestDate
                    )}
                  </span>

                </div>

              </div>
            )}

          {/* ====================================================
              FILE SELECTION
          ==================================================== */}

          {activeCaseId && (
            <div className="mt-6 pt-6 border-t border-white/[0.06]">

              <div className="mb-3 flex items-center justify-between">

                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Select Statements for Relationship Analysis (Min. 1)
                </label>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={
                      handleSelectAllFiles
                    }
                    className="rounded bg-[#020b09] border border-white/[0.1] px-3 py-1.5 text-[10px] font-semibold text-emerald-400 transition hover:bg-emerald-400/10 hover:border-emerald-400/30"
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleClearAllFiles
                    }
                    className="rounded bg-[#020b09] border border-white/[0.1] px-3 py-1.5 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-400/10 hover:border-rose-400/30"
                  >
                    Clear All
                  </button>

                </div>

              </div>

              <div className="flex flex-wrap gap-3">

                {files.map((f) => {

                  const isSelected =
                    selectedFileIds.includes(
                      f.id
                    );

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        toggleFileSelection(
                          f.id
                        )
                      }
                      title={
                        f.original_filename ||
                        `Statement ${f.id}`
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                          : "bg-[#020b09] border-white/[0.1] text-slate-400 hover:border-slate-500"
                      }`}
                    >

                      <div
                        className={`w-3 h-3 rounded flex items-center justify-center border ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-slate-500"
                        }`}
                      >

                        {isSelected && (
                          <svg
                            className="w-2 h-2 text-black"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}

                      </div>

                      {f.account_number
                        ?.toString()
                        .trim() ||
                        "Account number not available"}

                    </button>
                  );
                })}

                {files.length ===
                  0 && (
                  <span className="text-xs text-rose-400">
                    No files found for this case.
                  </span>
                )}

              </div>

            </div>
          )}

          {/* ====================================================
              ACTION
          ==================================================== */}

          <div className="mt-6 pt-6 border-t border-white/[0.06] flex justify-end">

            <button
              type="button"
              onClick={
                handleApplyFilters
              }
              disabled={
                isLoading ||
                selectedFileIds.length <
                  1 ||
                availableDateRange.loading
              }
              className={`px-8 py-2.5 rounded-xl font-bold text-sm transition shadow-lg ${
                isLoading ||
                selectedFileIds.length <
                  1 ||
                availableDateRange.loading
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-400 text-black hover:bg-emerald-300 shadow-emerald-500/20"
              }`}
            >
              {isLoading
                ? "Generating Graph..."
                : availableDateRange.loading
                  ? "Loading Date Range..."
                  : "Apply Filters & Generate Graph"}
            </button>

          </div>

        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mb-8 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-xl text-sm font-semibold flex items-center gap-3">

            <svg
              className="w-5 h-5"
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

            {error}

          </div>
        )}

        {/* ======================================================
            KPI CARDS
        ====================================================== */}

        {!initialLoad &&
          !error && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

              {/* SELECTED FILES */}

              <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                  Selected Files
                </span>

                <span className="text-2xl font-extrabold text-white">
                  {
                    selectedFileIds.length
                  }
                </span>

              </div>

              {/* RELATIONSHIPS */}

              <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

                <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">
                  Direct Relationships
                </span>

                <span className="text-2xl font-extrabold text-emerald-400">
                  {
                    totalRelationships
                  }
                </span>

              </div>

              {/* TRANSACTIONS */}

              <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

                <span className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-wider mb-1">
                  Total Transactions
                </span>

                <span className="text-2xl font-extrabold text-cyan-400">
                  {
                    totalTransactions
                  }
                </span>

              </div>

              {/* TOTAL VOLUME */}

              <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

                <span className="text-[10px] text-indigo-500/70 font-bold uppercase tracking-wider mb-1">
                  Total Volume
                </span>

                <span className="text-2xl font-extrabold text-indigo-400">
                  {formatCurrency(
                    totalAmount
                  )}
                </span>

              </div>

            </div>
          )}

        {/* ======================================================
            GRAPH
        ====================================================== */}

        {!initialLoad &&
          !error && (
            <div className="bg-[#061411] border border-white/[0.08] rounded-2xl overflow-hidden">

              {/* GRAPH HEADER */}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.08]">

                <div>

                  <h2 className="text-sm font-bold text-white">
                    Transaction Relationship Graph
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Explore relationships between accounts and transactions.
                  </p>

                </div>

                {/* ZOOM */}

                <div className="flex items-center gap-2">

                  {/* ZOOM OUT */}

                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={
                      graphZoom <=
                      MIN_ZOOM
                    }
                    title="Zoom Out"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                      graphZoom <=
                      MIN_ZOOM
                        ? "bg-slate-900 border-white/[0.05] text-slate-700 cursor-not-allowed"
                        : "bg-[#020b09] border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >

                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14" />
                    </svg>

                  </button>

                  {/* VALUE */}

                  <button
                    type="button"
                    onClick={
                      resetZoom
                    }
                    title="Reset Zoom"
                    className="min-w-[68px] h-9 px-3 rounded-lg bg-[#020b09] border border-white/[0.1] text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 transition"
                  >
                    {Math.round(
                      graphZoom * 100
                    )}
                    %
                  </button>

                  {/* ZOOM IN */}

                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={
                      graphZoom >=
                      MAX_ZOOM
                    }
                    title="Zoom In"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                      graphZoom >=
                      MAX_ZOOM
                        ? "bg-slate-900 border-white/[0.05] text-slate-700 cursor-not-allowed"
                        : "bg-[#020b09] border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >

                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>

                  </button>

                  {/* RESET */}

                  <button
                    type="button"
                    onClick={
                      resetZoom
                    }
                    title="Reset Zoom"
                    className="h-9 px-3 rounded-lg bg-[#020b09] border border-white/[0.1] text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-500 transition"
                  >
                    Reset
                  </button>

                </div>

              </div>

              {/* GRAPH */}

              <div
                className="relative w-full overflow-auto"
                style={{
                  height: "700px",
                }}
              >

                <div
                  className="min-w-full min-h-full flex items-center justify-center"
                  style={{
                    transform: `scale(${graphZoom})`,
                    transformOrigin:
                      "center center",
                    transition:
                      "transform 0.2s ease",

                    width:
                      graphZoom > 1
                        ? `${graphZoom * 100}%`
                        : "100%",

                    height:
                      graphZoom > 1
                        ? `${graphZoom * 100}%`
                        : "100%",
                  }}
                >

                  <div className="w-full h-full">

                    <RelationshipGraph
                      nodes={
                        graphData.nodes
                      }
                      edges={
                        graphData.edges
                      }
                      transactions={
                        graphData.transactions
                      }
                    />

                  </div>

                </div>

              </div>

              {/* GRAPH FOOTER */}

              <div className="px-5 py-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">

                <div className="flex items-center gap-2 text-xs text-slate-500">

                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                    />

                    <path d="m20 20-4-4" />

                    <path d="M8 11h6" />

                    <path d="M11 8v6" />
                  </svg>

                  <span>
                    Use the controls to zoom the relationship graph.
                  </span>

                </div>

                <div className="text-xs text-slate-600">

                  Zoom:{" "}

                  <span className="text-emerald-400 font-semibold">
                    {Math.round(
                      graphZoom * 100
                    )}
                    %
                  </span>

                </div>

              </div>

            </div>
          )}

        {/* ======================================================
            INITIAL STATE
        ====================================================== */}

        {initialLoad &&
          !isLoading &&
          !error && (
            <div className="h-[400px] border border-white/[0.04] bg-[#03100d]/50 rounded-2xl flex flex-col items-center justify-center border-dashed">

              <svg
                className="w-12 h-12 text-slate-700 mb-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>

              <p className="text-slate-500 font-medium">
                Select 1 or more files and apply filters to generate graph.
              </p>

            </div>
          )}

      </main>

    </div>
  );
}
