import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseNcrpFiles } from "../../../services/api/ncrp";
import { useAuth } from "../../../context/AuthContext";

/**
 * Custom Searchable Select Dropdown Component
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

  // Close dropdown on click outside
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

  // Focus search input when dropdown opens
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
    const query = searchTerm.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(query);
      const matchSubtitle = opt.subtitle?.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      return matchLabel || matchSubtitle || matchBadge;
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative flex flex-col gap-2 ${isOpen ? "z-40" : "z-10"}`} ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-2 text-sm font-semibold text-[#172554]">
          {stepNumber && (
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                badgeColor === "emerald"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-purple-50 text-purple-700"
              }`}
            >
              {stepNumber}
            </span>
          )}
          {label}
          {loading && (
            <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          )}
        </label>
      )}

      {/* Dropdown trigger button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition-all duration-200 outline-none ${
          disabled
            ? "cursor-not-allowed border-[#E2E8F0] bg-slate-100 text-[#94A3B8]"
            : isOpen
            ? "border-emerald-500 bg-white ring-4 ring-emerald-500/10 shadow-sm"
            : "border-[#DCE5EF] bg-[#F8FAFC] text-[#172033] hover:border-emerald-300 hover:bg-white"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {selectedItem ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="truncate font-semibold text-[#172554]">
                {selectedItem.label}
              </span>
              {selectedItem.badge && (
                <span className="shrink-0 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 uppercase">
                  {selectedItem.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate text-[#64748B]">
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

      {/* Dropdown panel */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="relative mb-2">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-[#DCE5EF] bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-[#172033] outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-emerald-50 font-bold text-emerald-950"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[#172554]">
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-800 uppercase">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="mt-0.5 truncate text-[11px] text-slate-500 font-normal">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span className="shrink-0 text-emerald-600 ml-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-xs text-[#64748B]">
                {searchTerm ? "No matching cases found." : emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NcrpReportsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCaseId = params.caseId || searchParams.get("caseId") || "";
  const [activeCaseId, setActiveCaseId] = useState(urlCaseId);
  const [casesList, setCasesList] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [loadingNcrpFiles, setLoadingNcrpFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch authorized cases
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      try {
        setLoadingCases(true);
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (isMounted) {
          setCasesList(list);
          if (urlCaseId) {
            setActiveCaseId(urlCaseId);
          } else if (list.length > 0 && !activeCaseId) {
            setActiveCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to fetch cases list:", err);
      } finally {
        if (isMounted) {
          setLoadingCases(false);
        }
      }
    }

    fetchCases();
    return () => {
      isMounted = false;
    };
  }, [urlCaseId]);

  // Load selected case metadata and NCRP files
  useEffect(() => {
    if (!activeCaseId) {
      setCaseData(null);
      setNcrpFiles([]);
      return;
    }

    let isMounted = true;
    async function loadCaseMetadata() {
      try {
        setLoadingNcrpFiles(true);
        const [caseRes, ncrpRes] = await Promise.allSettled([
          getCase(activeCaseId),
          getCaseNcrpFiles(activeCaseId),
        ]);

        if (isMounted) {
          if (caseRes.status === "fulfilled") {
            setCaseData(caseRes.value?.data || caseRes.value || null);
          }
          if (ncrpRes.status === "fulfilled") {
            const list = Array.isArray(ncrpRes.value?.data)
              ? ncrpRes.value.data
              : Array.isArray(ncrpRes.value)
              ? ncrpRes.value
              : [];
            setNcrpFiles(list);
          }
        }
      } catch (err) {
        console.error("Failed to load case metadata in NCRP hub:", err);
      } finally {
        if (isMounted) {
          setLoadingNcrpFiles(false);
        }
      }
    }

    loadCaseMetadata();
    return () => {
      isMounted = false;
    };
  }, [activeCaseId]);

  // Case selector options
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: `${c.case_name || "Untitled Case"} — ${c.case_number || `Case #${c.id}`}`,
      subtitle: `Status: ${c.status || "ACTIVE"}${
        c.io?.officer_name ? ` • IO: ${c.io.officer_name}` : ""
      }`,
      badge: c.status || "ACTIVE",
    }));
  }, [casesList]);

  // Reports Catalog Definition
  const ncrpReportsList = useMemo(() => {
    const txGridRoute = activeCaseId
      ? `/reports/ncrp-transaction?caseId=${encodeURIComponent(activeCaseId)}`
      : "/reports/ncrp-transaction";

    const moneyFlowRoute = activeCaseId
      ? `/reports/ncrp-money-flow?caseId=${encodeURIComponent(activeCaseId)}`
      : "/reports/ncrp-money-flow";

    return [
      {
        id: "ncrp-transaction-grid",
        reportNumber: "01",
        title: "NCRP Transaction Grid",
        category: "ncrp-analysis",
        categoryLabel: "NCRP ANALYSIS",
        status: "available",
        isReady: true,
        route: txGridRoute,
        description:
          "View, search, filter, and audit transactions imported from NCRP Excel workbooks.",
        features: [
          "Case-based NCRP workbook selection",
          "Worksheet-level transaction filtering",
          "Search across acknowledgement numbers, account identifiers, UTRs, and bank names",
          "Date and transaction amount filters",
          "Worksheet-specific transaction details",
          "Excel export",
        ],
        icon: (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        ),
      },
      {
        id: "ncrp-money-flow-graph",
        reportNumber: "02",
        title: "Money Flow Graph",
        category: "ncrp-analysis",
        categoryLabel: "NCRP ANALYSIS",
        status: "available",
        isReady: true,
        route: moneyFlowRoute,
        description:
          "Visualize sender-to-receiver money transfers across investigation layers using an interactive Sankey diagram.",
        features: [
          "Layer-wise sender-to-receiver fund transfer visualization",
          "Interactive Sankey flow graph with customizable node layers",
          "Strict 'Money Transfer To' worksheet data isolation",
          "Investigation layer selector (All Layers, Layer 1, Layer 2, etc.)",
          "Comprehensive transfer KPIs and disputed amount metrics",
          "Full-screen graph view, zoom, and rich tooltip intelligence",
        ],
        icon: (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        ),
      },
    ];
  }, [activeCaseId]);

  // Filter reports by search query and category
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return ncrpReportsList.filter((report) => {
      const matchesCategory =
        selectedCategory === "all" || report.category === selectedCategory;

      const matchesSearch =
        !query ||
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.features.some((f) => f.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [ncrpReportsList, searchQuery, selectedCategory]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F8FC] text-[#172033]">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-purple-200/30 blur-3xl" />
        <div className="absolute -right-32 top-40 h-[380px] w-[380px] rounded-full bg-emerald-100/40 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,37,84,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,37,84,0.035) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <BASNavbar />

        <main className="mx-auto w-full max-w-[1700px] flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {/* ========================================================= */}
          {/* 1. CASE SCOPE SELECTION CARD                              */}
          {/* ========================================================= */}
          <section className="relative z-20 rounded-2xl border border-[#E2E8F0] bg-white/95 p-5 shadow-[0_8px_30px_rgba(23,37,84,0.06)] backdrop-blur-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-purple-600" />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
                    NCRP Investigation Scope
                  </p>
                </div>
                <h2 className="mt-1 text-xl font-bold text-[#172554]">
                  Select Investigation Case
                </h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Choose an active investigation case to contextualize NCRP statements and transaction intelligence.
                </p>
              </div>

              {activeCaseId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCaseId("");
                    setCaseData(null);
                    setNcrpFiles([]);
                    setSearchParams({}, { replace: true });
                  }}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#DCE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-center"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset Case
                </button>
              )}
            </div>

            <div className="max-w-xl">
              <SearchableDropdown
                label="Active Case"
                stepNumber="1"
                value={activeCaseId}
                options={caseOptions}
                onSelect={(id) => {
                  setActiveCaseId(String(id));
                  setSearchParams({ caseId: String(id) }, { replace: true });
                }}
                loading={loadingCases}
                placeholder="Choose an investigation case..."
                searchPlaceholder="Search by case name or number..."
                emptyMessage="No investigation cases found"
                badgeColor="purple"
              />
            </div>
          </section>

          {/* ========================================================= */}
          {/* 2. CASE SUMMARY METRICS (Rendered when case selected)     */}
          {/* ========================================================= */}
          {activeCaseId && caseData && (
            <section className="relative z-10 mt-6">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#EEF2F7] pb-5 md:flex-row md:items-center">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[#172554]">
                          {caseData.case_name || "Untitled Case"}
                        </h3>
                        {caseData.case_number && (
                          <span className="rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                            {caseData.case_number}
                          </span>
                        )}
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {caseData.status || "ACTIVE"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">
                        NCRP Cyber Crime Case Details & Document Scope
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start rounded-xl border border-purple-100 bg-purple-50/70 px-3.5 py-2 text-xs font-semibold text-purple-900 md:self-center">
                    <span className="h-2 w-2 rounded-full bg-purple-600" />
                    Target: <span className="font-bold">NCRP Statements</span>
                  </div>
                </div>

                {/* Metadata metrics grid */}
                <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {/* Case Number */}
                  <div className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs font-medium text-[#64748B]">Case Number</p>
                    <p className="mt-1 truncate text-sm font-bold text-[#172554]">
                      {caseData.case_number || `#${caseData.id}`}
                    </p>
                  </div>

                  {/* Case Owner */}
                  <div className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs font-medium text-[#64748B]">Case Owner</p>
                    <p className="mt-1 truncate text-sm font-bold text-[#172554]">
                      {caseData.owner_username || caseData.creator?.username || "—"}
                    </p>
                  </div>

                  {/* Uploaded NCRP Workbooks */}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5">
                    <p className="text-xs font-medium text-purple-800">NCRP Workbooks</p>
                    <p className="mt-1 text-lg font-extrabold text-purple-900">
                      {ncrpFiles.length}
                    </p>
                  </div>

                  {/* Available NCRP Reports */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                    <p className="text-xs font-medium text-emerald-800">Available Reports</p>
                    <p className="mt-1 text-lg font-extrabold text-emerald-700">
                      {ncrpReportsList.filter((r) => r.isReady).length}
                    </p>
                  </div>
                </div>

                {/* Empty NCRP statements notice */}
                {ncrpFiles.length === 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        No NCRP Excel workbooks have been uploaded for this case yet. Upload statements in the NCRP Upload section to analyze transactions.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/upload/ncrp")}
                      className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 shrink-0 ml-3"
                    >
                      Upload NCRP
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* 3. REPORTS CATALOG SECTION                                */}
          {/* ========================================================= */}
          <section className="relative z-10 mt-9">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-1 rounded-full bg-emerald-500" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                    NCRP Intelligence & Analytics
                  </p>
                </div>

                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl">
                  NCRP Reports Hub
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
                  Access and explore specialized transaction intelligence, fraud analysis, and audit reports for imported NCRP Excel statements.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {ncrpReportsList.filter((r) => r.isReady).length === 1
                  ? "1 report available"
                  : `${ncrpReportsList.filter((r) => r.isReady).length} reports available`}
              </div>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-md">
                <svg
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search NCRP reports by title or keyword..."
                  className="w-full rounded-xl border border-[#DCE5EF] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: `All Reports (${ncrpReportsList.length})` },
                  { id: "ncrp-analysis", label: `NCRP Analysis (${ncrpReportsList.length})` },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === cat.id
                        ? "bg-[#172554] text-white shadow-sm"
                        : "border border-[#DCE5EF] bg-white text-[#64748B] hover:border-emerald-200 hover:text-[#172554]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports Cards Grid */}
            {filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredReports.map((report) => (
                  <article
                    key={report.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${report.title}`}
                    onClick={() => navigate(report.route)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(report.route);
                      }
                    }}
                    className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_8px_28px_rgba(23,37,84,0.045)] transition-all duration-300 sm:p-6 outline-none cursor-pointer border-[#E2E8F0] hover:-translate-y-1.5 hover:border-emerald-300 hover:shadow-[0_20px_45px_rgba(23,37,84,0.12)] focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                  >
                    {/* Decorative top accent */}
                    <div className="absolute inset-x-0 top-0 h-1.5 origin-left scale-x-0 bg-gradient-to-r from-[#172554] via-[#059669] to-emerald-400 transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />

                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 transition-all duration-300 group-hover:scale-105">
                        {report.icon}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#172554]">
                          REPORT {report.reportNumber}
                        </span>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      </div>
                    </div>

                    {/* Card title and description */}
                    <div className="mt-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                        {report.categoryLabel}
                      </p>

                      <h3 className="mt-2 text-lg font-bold leading-snug text-[#172554] transition-colors duration-200 group-hover:text-emerald-700">
                        {report.title}
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-[#64748B]">
                        {report.description}
                      </p>
                    </div>

                    {/* Features */}
                    <div className="mt-5 flex-1 border-t border-[#EEF2F7] pt-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                        Included Features
                      </p>

                      <ul className="space-y-2.5">
                        {report.features.map((feature, i) => (
                          <li
                            key={`${report.id}-feature-${i}`}
                            className="flex items-start gap-2.5 text-sm leading-5 text-[#475569]"
                          >
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action button */}
                    <div className="mt-6 border-t border-[#EEF2F7] pt-5">
                      <div
                        aria-hidden="true"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-950/10 transition-all duration-200 select-none group-hover:-translate-y-0.5 group-hover:bg-[#059669] group-hover:shadow-lg group-hover:shadow-emerald-900/20"
                      >
                        <span>Open Report</span>
                        <svg
                          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-4 text-base font-bold text-[#172554]">
                  No reports matched your search
                </h3>
                <p className="mt-1 text-sm text-[#64748B]">
                  No NCRP reports match the query "{searchQuery}".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  Clear Search Query
                </button>
              </div>
            )}
          </section>
        </main>

        <UserFooter />
      </div>
    </div>
  );
}
