import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
import ClientAdminReportModal from "../../../components/admin/ClientAdminReportModal";

/**
 * Custom Searchable Select Dropdown Component
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

  // Dynamic placement check (auto-flip if near bottom of viewport)
  const checkPlacement = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownEstimatedHeight = 280;

    // Flip upwards if insufficient space below and more space above
    if (spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpwards(true);
    } else {
      setOpenUpwards(false);
    }
  }, []);

  // Close dropdown on click outside or escape
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

  // Focus search input when dropdown opens
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

  // Reset highlighted index when search results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Keyboard navigation handler
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
      className={`relative flex flex-col gap-2 ${isOpen ? "z-40" : "z-10"}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <label className="flex items-center gap-2 text-sm font-semibold text-[#172554]">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
            badgeColor === "emerald"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-blue-50 text-[#172554]"
          }`}
        >
          {stepNumber}
        </span>
        {label}
        {loading && (
          <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        )}
      </label>

      {/* Dropdown trigger button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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
              {selectedItem.avatar && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                  {selectedItem.avatar}
                </span>
              )}
              <span className="truncate font-semibold text-[#172554]">
                {selectedItem.label}
              </span>
              {selectedItem.badge && (
                <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#172554]">
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
          className={`absolute left-0 z-50 w-full rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-[0_20px_45px_rgba(23,37,84,0.16)] ${
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {/* Search bar */}
          <div className="relative mb-2 px-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
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
              className="w-full rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] py-2 pl-9 pr-3 text-xs text-[#172033] outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto px-1 py-1 space-y-1">
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
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition outline-none ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 font-semibold"
                        : isHighlighted
                        ? "bg-slate-100 text-[#172554]"
                        : "text-[#334155] hover:bg-slate-50 hover:text-[#172554]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {opt.avatar && (
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {opt.avatar}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold text-[#172554]">
                            {opt.label}
                          </p>
                        </div>
                        {opt.subtitle && (
                          <p className="truncate text-xs text-[#64748B]">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="shrink-0 text-emerald-600">
                        <svg
                          className="h-4 w-4"
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
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-xs text-[#64748B]">
                {searchTerm ? "No matching results found." : emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseReportsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { caseId: paramCaseId } = useParams();

  const [activeCaseId, setActiveCaseId] = useState(paramCaseId || "");
  const [allCases, setAllCases] = useState([]);
  const [loadingAllCases, setLoadingAllCases] = useState(false);

  const [caseData, setCaseData] = useState(null);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Client Admin: User -> Case -> File
  const [clientUsers, setClientUsers] = useState([]);
  const [userCases, setUserCases] = useState([]);
  const [caseFiles, setCaseFiles] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Super Admin: Client-User -> Case Cascading Selection
  const [superAdminUsers, setSuperAdminUsers] = useState([]);
  const [superAdminCases, setSuperAdminCases] = useState([]);
  const [selectedSuperAdminUserId, setSelectedSuperAdminUserId] = useState("");
  const [loadingSuperAdminUsers, setLoadingSuperAdminUsers] = useState(false);
  const [loadingSuperAdminCases, setLoadingSuperAdminCases] = useState(false);

  // Track latest request to avoid race conditions
  const latestCaseRequestIdRef = useRef(0);

  // 1. Load users for Super Admin
  useEffect(() => {
    if (!isSuperAdmin) return;

    let isMounted = true;

    async function loadSuperAdminUsers() {
      try {
        setLoadingSuperAdminUsers(true);
        setError("");

        const res = await getUsers();
        const list =
          res?.users ||
          res?.items ||
          (Array.isArray(res) ? res : []);

        if (isMounted) {
          // Filter to active client users (users belonging to a company)
          const validUsers = list.filter((u) => u.client_name || u.client_id != null);
          setSuperAdminUsers(validUsers);
        }
      } catch (err) {
        console.error("Failed to load users for Super Admin:", err);
        if (isMounted) {
          setError("Failed to load client and user options.");
        }
      } finally {
        if (isMounted) {
          setLoadingSuperAdminUsers(false);
        }
      }
    }

    loadSuperAdminUsers();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin]);

  // 2. Load users for Client Admin
  useEffect(() => {
    if (!isClientAdmin) return;

    let isMounted = true;

    async function loadClientUsers() {
      try {
        setLoadingUsers(true);

        const res = await getUsers();
        const list =
          res?.users ||
          res?.items ||
          (Array.isArray(res) ? res : []);

        if (isMounted) {
          setClientUsers(list);
        }
      } catch (err) {
        console.error("Failed to load client users:", err);
      } finally {
        if (isMounted) {
          setLoadingUsers(false);
        }
      }
    }

    loadClientUsers();

    return () => {
      isMounted = false;
    };
  }, [isClientAdmin]);

  // 3. Normal User: fetch their authorized cases
  useEffect(() => {
    if (isClientAdmin || isSuperAdmin) return;

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

          if (!activeCaseId && list.length > 0) {
            setActiveCaseId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch cases list:", err);
      } finally {
        if (isMounted) {
          setLoadingAllCases(false);
        }
      }
    }

    fetchCases();

    return () => {
      isMounted = false;
    };
  }, [isClientAdmin, isSuperAdmin, activeCaseId]);

  // Keep the selected case synchronized with the URL if navigated with param
  useEffect(() => {
    if (paramCaseId && paramCaseId !== activeCaseId) {
      setActiveCaseId(paramCaseId);
    }
  }, [paramCaseId, activeCaseId]);

  // Super Admin: When client user selection changes
  const handleSuperAdminUserSelect = async (userId) => {
    const stringUserId = String(userId);
    setSelectedSuperAdminUserId(stringUserId);
    setActiveCaseId("");
    setCaseData(null);
    setFiles([]);
    setSuperAdminCases([]);
    setError("");

    if (!stringUserId) return;

    const currentRequestId = ++latestCaseRequestIdRef.current;

    try {
      setLoadingSuperAdminCases(true);

      const res = await getCases(stringUserId);

      // Prevent race conditions: discard response if user selection changed in the meantime
      if (currentRequestId !== latestCaseRequestIdRef.current) {
        return;
      }

      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setSuperAdminCases(list);
    } catch (err) {
      if (currentRequestId !== latestCaseRequestIdRef.current) return;
      console.error("Failed to load cases for selected user:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load cases for this user."
      );
    } finally {
      if (currentRequestId === latestCaseRequestIdRef.current) {
        setLoadingSuperAdminCases(false);
      }
    }
  };

  // Super Admin: When case is selected
  const handleSuperAdminCaseSelect = (caseId) => {
    if (String(caseId) === String(activeCaseId)) {
      return;
    }
    setActiveCaseId(caseId);
  };

  // Client Admin: Handle user change
  const handleUserChange = async (e) => {
    const newUserId = e.target.value;

    setSelectedUserId(newUserId);
    setSelectedCaseId("");
    setSelectedFileId("");
    setUserCases([]);
    setCaseFiles([]);

    if (!newUserId) return;

    try {
      setLoadingCases(true);

      const res = await getCases(newUserId);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setUserCases(list);
    } catch (err) {
      console.error("Failed to load cases for user:", err);
    } finally {
      setLoadingCases(false);
    }
  };

  // Client Admin: Handle case change
  const handleCaseChange = async (e) => {
    const newCaseId = e.target.value;

    setSelectedCaseId(newCaseId);
    setSelectedFileId("");
    setCaseFiles([]);

    if (!newCaseId) return;

    setActiveCaseId(newCaseId);

    try {
      setLoadingFiles(true);

      const res = await getCaseFiles(newCaseId, false, "BANK_STATEMENT");
      const rawList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setCaseFiles(
        rawList.filter(
          (file) => !file.is_superseded && (!file.document_type || file.document_type === "BANK_STATEMENT") && file.document_type !== "UNKNOWN"
        )
      );
    } catch (err) {
      console.error("Failed to load files for case:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFileId(e.target.value);
  };

  // Normal User: Switch active case
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) {
      return;
    }
    setActiveCaseId(newCaseId);
  };

  // Load case details and associated files for activeCaseId
  const loadCaseData = useCallback(async () => {
    if (!activeCaseId) {
      setIsLoading(false);
      setCaseData(null);
      setFiles([]);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const [caseRes, filesRes] = await Promise.all([
        getCase(activeCaseId),
        getCaseFiles(activeCaseId, false, "BANK_STATEMENT"),
      ]);

      const fetchedCase = caseRes?.data || caseRes;
      setCaseData(fetchedCase);

      const fileList = Array.isArray(filesRes?.data)
        ? filesRes.data
        : Array.isArray(filesRes)
        ? filesRes
        : [];

      setFiles(
        fileList.filter(
          (file) => !file.is_superseded && (!file.document_type || file.document_type === "BANK_STATEMENT") && file.document_type !== "UNKNOWN"
        )
      );

      // If Super Admin arrived via direct URL, synchronize the selected user
      if (isSuperAdmin && !selectedSuperAdminUserId && fetchedCase) {
        const ownerId = fetchedCase.created_by || fetchedCase.assigned_to;
        if (ownerId) {
          setSelectedSuperAdminUserId(String(ownerId));
          // Load cases for this owner so dropdown displays properly
          getCases(ownerId).then((res) => {
            const list = Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res)
              ? res
              : [];
            setSuperAdminCases(list);
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Failed to load case data:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load case information."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeCaseId, isSuperAdmin, selectedSuperAdminUserId]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Report catalog
  const reportsList = [
    {
      id: "file-statement",
      reportNumber: "01",
      title: "Bank Statement & Transactions Report",
      category: "statement",
      categoryLabel: "Statement Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/file-statement`
        : "/dashboard/reports/file-statement",
      description:
        "Comprehensive file-wise statement audit with fully filtered transactions, live narration and reference search with validation, debit/credit breakdown, balances, and CSV/Print export.",
      features: [
        "File-wise statement switching",
        "Live search with input validation",
        "Instant calendar date range pickers",
        "Debit & Credit type filters",
        "Opening & Closing balance checks",
        "Export CSV & Print Report",
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
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "dynamic-timeline-report",
      reportNumber: "02",
      title: "Transaction Mode Wise Report",
      category: "statement",
      categoryLabel: "Dynamic Visualizations",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/analysis?caseId=${encodeURIComponent(activeCaseId)}`
        : "/analysis",
      description:
        "Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.",
      features: [
        "Upload CSV, XLSX, XLS, JSON",
        "Automatic column and type detection",
        "Dynamic X and Multi-Y Axis mapping",
        "Synchronized search, filters, KPIs and table",
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
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "transaction-relationships",
      reportNumber: "03",
      title: "Transaction Flow / Relationship Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/transaction-relationships`
        : "/reports/transaction-relationships",
      description:
        "Visualize monetary flows and transaction relationships between multiple statements as an interactive node-edge graph.",
      features: [
        "Cross-statement relationship mapping",
        "Dynamic amount and mode filtering",
        "Live edge interactive drill-down",
        "Debit/Credit aggregations",
        "Visual node cluster analysis",
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
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "counterparty-intelligence",
      reportNumber: "04",
      title: "Counterparty Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/counterparty-intelligence`
        : "/reports/counterparty-intelligence",
      description:
        "Analyze counterparty activity across statements. Find common counterparties shared between different bank statements and view aggregated transaction matrices.",
      features: [
        "Single statement counterparty breakdown",
        "Common counterparties across multiple files",
        "Counterparty vs Statement activity matrix",
        "Top counterparties by value and count",
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "financial-transaction-intelligence",
      reportNumber: "05",
      title: "Financial Transaction Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/financial-transaction-intelligence`
        : "/reports/financial-transaction-intelligence",
      description:
        "Analyze financial movement, high-value transactions, distribution, and patterns within selected statements.",
      features: [
        "Data-driven KPI calculations",
        "Most frequent and round-value transaction analysis",
        "Financial concentration and balance trend",
        "File-wise statistical comparison",
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
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
  ];

  // Client Admin validation
  const isClientAdminSelectionValid = Boolean(
    selectedUserId && selectedCaseId && selectedFileId
  );

  // Super Admin validation
  const isSuperAdminSelectionValid = Boolean(
    selectedSuperAdminUserId && activeCaseId
  );

  const getReportRoute = (report) => {
    if (isClientAdmin) {
      if (report.id === "dynamic-timeline-report") {
        return `/analysis?caseId=${encodeURIComponent(
          selectedCaseId
        )}&fileId=${encodeURIComponent(selectedFileId)}`;
      }

      if (report.id === "file-statement") {
        return `/dashboard/cases/${encodeURIComponent(
          selectedCaseId
        )}/reports/file-statement?fileId=${encodeURIComponent(
          selectedFileId
        )}`;
      }

      if (report.id === "transaction-relationships") {
        return `/dashboard/cases/${encodeURIComponent(
          selectedCaseId
        )}/reports/transaction-relationships?fileId=${encodeURIComponent(
          selectedFileId
        )}`;
      }

      if (report.id === "counterparty-intelligence") {
        return `/dashboard/cases/${encodeURIComponent(
          selectedCaseId
        )}/reports/counterparty-intelligence?fileId=${encodeURIComponent(
          selectedFileId
        )}`;
      }

      if (report.id === "financial-transaction-intelligence") {
        return `/dashboard/cases/${encodeURIComponent(
          selectedCaseId
        )}/reports/financial-transaction-intelligence?fileId=${encodeURIComponent(
          selectedFileId
        )}`;
      }
    }

    if (isSuperAdmin) {
      if (report.id === "dynamic-timeline-report") {
        return `/analysis?caseId=${encodeURIComponent(activeCaseId)}`;
      }
      return `/dashboard/cases/${encodeURIComponent(activeCaseId)}/reports/${report.id}`;
    }

    return report.route;
  };

  const handleOpenReport = (report, e) => {
    if (e) {
      e.stopPropagation();
    }

    if (!report.isReady) {
      return;
    }

    // Client Admin validation check
    if (isClientAdmin && !isClientAdminSelectionValid) {
      let targetElId = "hub-select-user";
      if (selectedUserId && !selectedCaseId) {
        targetElId = "hub-select-case";
      } else if (selectedUserId && selectedCaseId && !selectedFileId) {
        targetElId = "hub-select-file";
      }
      const el = document.getElementById(targetElId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return;
    }

    // Super Admin validation check
    if (isSuperAdmin && !isSuperAdminSelectionValid) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate(getReportRoute(report));
  };

  // Filter reports by category and search query
  const filteredReports = reportsList.filter((report) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "available" && report.isReady) ||
      report.category === selectedCategory;

    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      report.title.toLowerCase().includes(query) ||
      report.description.toLowerCase().includes(query) ||
      report.features.some((feature) =>
        feature.toLowerCase().includes(query)
      );

    return matchesCategory && matchesSearch;
  });

  // Prepare Super Admin client-user options
  const superAdminUserOptions = useMemo(() => {
    return superAdminUsers.map((u) => {
      const company = u.client_name || u.company_code || "Individual";
      return {
        id: u.id,
        label: `${u.username} (${company})`,
        subtitle: `${u.email} • ${
          u.role === "client_admin" ? "Client Admin" : "User"
        }`,
        badge: company,
        avatar: u.username.charAt(0).toUpperCase(),
        searchKey: `${u.username} ${company} ${u.email}`,
      };
    });
  }, [superAdminUsers]);

  // Prepare Super Admin case options
  const superAdminCaseOptions = useMemo(() => {
    return superAdminCases.map((c) => {
      return {
        id: c.id,
        label: `${c.case_name || "Untitled Case"} — ${c.case_number}`,
        subtitle: `Status: ${c.status || "DRAFT"}${
          c.io?.officer_name ? ` • IO: ${c.io.officer_name}` : ""
        }`,
        badge: c.status || "DRAFT",
        searchKey: `${c.case_name || ""} ${c.case_number || ""} ${c.status || ""}`,
      };
    });
  }, [superAdminCases]);

  // Selected client user object for summary
  const selectedSuperAdminUser = useMemo(() => {
    return superAdminUsers.find(
      (u) => String(u.id) === String(selectedSuperAdminUserId)
    );
  }, [superAdminUsers, selectedSuperAdminUserId]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F8FC] text-[#172033]">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -right-32 top-40 h-[380px] w-[380px] rounded-full bg-emerald-100/50 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,37,84,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,37,84,0.035) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
      </div>

      <div className="relative z-10">
        <BASNavbar />

        <main className="mx-auto w-full max-w-[1700px] px-4 py-8 sm:px-6 lg:px-10">
          {/* ========================================================= */}
          {/* 1. SUPER ADMIN WORKFLOW: Tenant-Aware Cascading Selection */}
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
                    Select Client, User & Case
                  </h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Select a client and user first, then choose that user's investigation case to unlock reports.
                  </p>
                </div>

                {selectedSuperAdminUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSuperAdminUserId("");
                      setActiveCaseId("");
                      setCaseData(null);
                      setFiles([]);
                      setSuperAdminCases([]);
                    }}
                    className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#DCE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-center"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reset Selection
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Step 1: Select Client and User */}
                <SearchableDropdown
                  label="Select Client & User"
                  stepNumber={1}
                  value={selectedSuperAdminUserId}
                  options={superAdminUserOptions}
                  onSelect={handleSuperAdminUserSelect}
                  placeholder="Choose a client user..."
                  searchPlaceholder="Search by username, company, or email..."
                  loading={loadingSuperAdminUsers}
                  emptyMessage="No client users found"
                  badgeColor="emerald"
                />

                {/* Step 2: Select Case */}
                <SearchableDropdown
                  label="Select Case"
                  stepNumber={2}
                  value={activeCaseId}
                  options={superAdminCaseOptions}
                  onSelect={handleSuperAdminCaseSelect}
                  disabled={!selectedSuperAdminUserId}
                  loading={loadingSuperAdminCases}
                  placeholder={
                    !selectedSuperAdminUserId
                      ? "Select a client & user first"
                      : loadingSuperAdminCases
                      ? "Loading cases..."
                      : superAdminCases.length === 0
                      ? "No cases are available for this user"
                      : "Choose a case..."
                  }
                  searchPlaceholder="Search by case name or number..."
                  emptyMessage={
                    !selectedSuperAdminUserId
                      ? "Select a client & user first"
                      : "No cases are available for this user."
                  }
                  badgeColor="blue"
                />
              </div>

              {/* Step indicator helper text */}
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#EEF2F7] pt-4 text-xs text-[#64748B]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isSuperAdminSelectionValid
                      ? "bg-emerald-500"
                      : selectedSuperAdminUserId
                      ? "bg-amber-500"
                      : "bg-slate-300"
                  }`}
                />
                {!selectedSuperAdminUserId ? (
                  <span>Step 1: Select a client and user to view their investigation cases and reports.</span>
                ) : !activeCaseId ? (
                  <span>
                    Step 2:{" "}
                    {superAdminCases.length === 0
                      ? "No cases are available for this user."
                      : "Now choose an investigation case above to view its reports."}
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-800">
                    Selection complete: Viewing reports for {caseData?.case_name || "selected case"} ({selectedSuperAdminUser?.username} @ {selectedSuperAdminUser?.client_name || "client"}).
                  </span>
                )}
              </div>
            </section>
          ) : isClientAdmin ? (
            /* ========================================================= */
            /* 2. CLIENT ADMIN WORKFLOW: 3-step User -> Case -> File     */
            /* ========================================================= */
            <section className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white/90 p-5 shadow-[0_8px_30px_rgba(23,37,84,0.06)] backdrop-blur-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Report Scope
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#172554]">
                  Select User, Case & File
                </h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Choose the records to use when opening a report.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Select user */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="hub-select-user"
                    className="flex items-center gap-2 text-sm font-semibold text-[#334155]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#172554]">
                      1
                    </span>
                    Select User
                    {loadingUsers && (
                      <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    )}
                  </label>

                  <select
                    id="hub-select-user"
                    value={selectedUserId}
                    onChange={handleUserChange}
                    disabled={loadingUsers}
                    className="w-full rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a user</option>
                    {clientUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.email ? `(${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select case */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="hub-select-case"
                    className="flex items-center gap-2 text-sm font-semibold text-[#334155]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#172554]">
                      2
                    </span>
                    Select Case
                    {loadingCases && (
                      <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    )}
                  </label>

                  <select
                    id="hub-select-case"
                    value={selectedCaseId}
                    onChange={handleCaseChange}
                    disabled={!selectedUserId || loadingCases}
                    className="w-full rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedUserId
                        ? "Select a user first"
                        : loadingCases
                        ? "Loading cases..."
                        : userCases.length === 0
                        ? "No cases found"
                        : "Choose a case"}
                    </option>
                    {userCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_name || c.case_number || "Untitled Case"}
                        {c.case_number ? ` (${c.case_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select file */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="hub-select-file"
                    className="flex items-center gap-2 text-sm font-semibold text-[#334155]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#172554]">
                      3
                    </span>
                    Select File
                    {loadingFiles && (
                      <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    )}
                  </label>

                  <select
                    id="hub-select-file"
                    value={selectedFileId}
                    onChange={handleFileChange}
                    disabled={!selectedCaseId || loadingFiles}
                    className="w-full rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedCaseId
                        ? "Select a case first"
                        : loadingFiles
                        ? "Loading files..."
                        : caseFiles.length === 0
                        ? "No files found"
                        : "Choose a file"}
                    </option>
                    {caseFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.original_filename}
                        {f.bank_name ? ` (${f.bank_name})` : ""}
                        {f.status ? ` - ${f.status}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#EEF2F7] pt-4 text-xs text-[#64748B]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {isClientAdminSelectionValid
                  ? "Selection complete. You can open the supported reports below."
                  : "Select all three fields to enable the applicable reports."}
              </div>
            </section>
          ) : (
            /* ========================================================= */
            /* 3. NORMAL USER WORKFLOW: Case Switcher                    */
            /* ========================================================= */
            <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_8px_30px_rgba(23,37,84,0.05)] sm:flex-row sm:items-center sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <label
                  htmlFor="hub-case-select"
                  className="flex items-center gap-2 text-sm font-semibold text-[#172554]"
                >
                  <svg
                    className="h-5 w-5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  Select / Switch Case
                </label>

                <select
                  id="hub-case-select"
                  value={activeCaseId || ""}
                  onChange={(e) => handleSwitchCase(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 sm:min-w-[300px]"
                >
                  <option value="" disabled>
                    Choose a case
                  </option>
                  {allCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_name || "Untitled Case"}
                    </option>
                  ))}
                </select>

                {loadingAllCases && (
                  <span className="flex items-center gap-2 text-xs text-[#64748B]">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    Loading cases...
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-blue-50 px-3.5 py-2 text-sm text-[#172554]">
                Total Cases: <span className="font-bold">{allCases.length}</span>
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* CASE SUMMARY (Rendered when a valid case is selected)     */}
          {/* ========================================================= */}
          {activeCaseId && caseData ? (
            <section className="relative z-10 mt-6">
              {isSuperAdmin ? (
                /* Super Admin Compact Case Summary */
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#EEF2F7] pb-5 md:flex-row md:items-center">
                    <div className="flex items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <svg
                          className="h-6 w-6"
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
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-[#172554]">
                            {caseData.case_name || "Untitled Case"}
                          </h3>
                          <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#172554]">
                            {caseData.case_number}
                          </span>
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {caseData.status || "ACTIVE"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#64748B]">
                          Investigation Case Details & Intelligence Metadata
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2 text-xs font-semibold text-emerald-800 md:self-center">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Client:{" "}
                      <span className="font-bold">
                        {caseData.client_name ||
                          caseData.client?.name ||
                          caseData.owner_client_name ||
                          selectedSuperAdminUser?.client_name ||
                          "—"}
                      </span>
                    </div>
                  </div>

                  {/* Metadata metrics grid */}
                  <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {/* Client Company */}
                    <div className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                      <p className="text-xs font-medium text-[#64748B]">
                        Client Company
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-[#172554]">
                        {caseData.client_name ||
                          caseData.client?.name ||
                          caseData.owner_client_name ||
                          selectedSuperAdminUser?.client_name ||
                          "—"}
                      </p>
                    </div>

                    {/* Case Owner */}
                    <div className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                      <p className="text-xs font-medium text-[#64748B]">
                        Case Owner
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-[#172554]">
                        {caseData.owner_username ||
                          caseData.creator?.username ||
                          selectedSuperAdminUser?.username ||
                          "—"}
                      </p>
                    </div>

                    {/* Investigating Officer */}
                    <div className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                      <p className="text-xs font-medium text-[#64748B]">
                        Investigating Officer
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-[#172554]">
                        {caseData.io?.officer_name
                          ? `${caseData.io.officer_name}${
                              caseData.io.designation
                                ? ` (${caseData.io.designation})`
                                : ""
                            }`
                          : "Not Assigned"}
                      </p>
                    </div>

                    {/* Uploaded Statements & Available Reports */}
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                      <div>
                        <p className="text-xs font-medium text-[#64748B]">
                          Statements
                        </p>
                        <p className="text-lg font-extrabold text-[#172554]">
                          {files.length}
                        </p>
                      </div>
                      <div className="h-7 w-px bg-emerald-200" />
                      <div>
                        <p className="text-xs font-medium text-[#64748B]">
                          Reports
                        </p>
                        <p className="text-lg font-extrabold text-emerald-700">
                          {reportsList.filter((r) => r.isReady).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Empty statements notice if files.length === 0 */}
                  {files.length === 0 && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                      <svg
                        className="h-4 w-4 shrink-0 text-amber-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        No bank statements have been uploaded for this case yet. Upload statements in Cases to view live transaction breakdowns.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Normal / Client Admin Case Summary */
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex flex-col justify-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-start sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <svg
                          className="h-5 w-5"
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
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#64748B]">
                          Active Case
                        </p>
                        <p className="mt-1 break-words text-base font-bold text-[#172554]">
                          {caseData.case_name || "Untitled Case"}
                        </p>
                        {caseData.case_number && (
                          <p className="mt-1 text-xs text-[#64748B]">
                            Case No. {caseData.case_number}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="hidden h-12 w-px bg-[#E2E8F0] sm:block" />

                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#172554]">
                        <svg
                          className="h-5 w-5"
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
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#64748B]">
                          Investigating Officer
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-[#172033]">
                          {caseData.io?.officer_name
                            ? `${caseData.io.officer_name}${
                                caseData.io.designation
                                  ? ` (${caseData.io.designation})`
                                  : ""
                              }`
                            : "Not Assigned"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#172554]">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5M8 13h8M8 17h8"
                          />
                        </svg>
                      </div>
                      <p className="mt-3 text-xs font-medium text-[#64748B]">
                        Uploaded Statements
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-[#172554]">
                        {files.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M5 12l4 4L19 6"
                          />
                        </svg>
                      </div>
                      <p className="mt-3 text-xs font-medium text-[#64748B]">
                        Available Reports
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                        {reportsList.filter((report) => report.isReady).length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {/* Error message banner */}
          {error && (
            <div className="mt-6 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-red-800">Notice</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  if (isSuperAdmin && selectedSuperAdminUserId) {
                    handleSuperAdminUserSelect(selectedSuperAdminUserId);
                  } else {
                    loadCaseData();
                  }
                }}
                className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* INITIAL / PROMPT STATES (When no user or case selected)    */}
          {/* ========================================================= */}
          {isSuperAdmin && !activeCaseId ? (
            <div className="relative z-10 mt-8 rounded-2xl border border-dashed border-[#CBD5E1] bg-white/80 p-10 text-center shadow-sm backdrop-blur-sm sm:p-14">
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                  !selectedSuperAdminUserId
                    ? "bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/50"
                    : "bg-blue-50 text-[#172554] ring-8 ring-blue-50/50"
                }`}
              >
                {!selectedSuperAdminUserId ? (
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                ) : (
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
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )}
              </div>

              <h3 className="mt-5 text-xl font-bold text-[#172554]">
                {!selectedSuperAdminUserId
                  ? "Welcome to Super Admin Reports Hub"
                  : superAdminCases.length === 0
                  ? "No Cases Found"
                  : "Select an Investigation Case"}
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#64748B]">
                {!selectedSuperAdminUserId
                  ? "Select a client and user to view their investigation cases and reports."
                  : superAdminCases.length === 0
                  ? "No cases are available for this user."
                  : `Please select a case above for ${
                      selectedSuperAdminUser?.username || "this user"
                    } to view its summary and unlock investigation reports.`}
              </p>
            </div>
          ) : (
            <section className="relative z-10 mt-9">
              {/* Reports Catalog & Cards */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-1 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                      Intelligence & Analytics
                    </p>
                  </div>

                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl">
                    Reports Hub
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
                    Explore statement insights, transaction relationships, and
                    financial intelligence reports for your selected case.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {reportsList.filter((report) => report.isReady).length} reports
                  available
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
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
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reports by title or keyword..."
                    className="w-full rounded-xl border border-[#DCE5EF] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#172033] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "all", label: "All Reports" },
                    { id: "statement", label: "Statement Analysis" },
                    { id: "analysis", label: "Advanced Analysis" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
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

              {/* Responsive report cards grid */}
              {filteredReports.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredReports.map((report) => {
                    const isActionDisabled =
                      (isClientAdmin && !isClientAdminSelectionValid) ||
                      (isSuperAdmin && !isSuperAdminSelectionValid);

                    return (
                      <article
                        key={report.id}
                        tabIndex={report.isReady ? 0 : -1}
                        role={report.isReady ? "button" : undefined}
                        aria-label={
                          report.isReady
                            ? isActionDisabled
                              ? `${report.title} (Requires case selection)`
                              : `Open ${report.title}`
                            : `${report.title} (Coming Soon)`
                        }
                        onClick={(e) => handleOpenReport(report, e)}
                        onKeyDown={(e) => {
                          if (
                            report.isReady &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            handleOpenReport(report, e);
                          }
                        }}
                        className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_8px_28px_rgba(23,37,84,0.045)] transition-all duration-300 sm:p-6 outline-none ${
                          report.isReady
                            ? "cursor-pointer border-[#E2E8F0] hover:-translate-y-1.5 hover:border-emerald-300 hover:shadow-[0_20px_45px_rgba(23,37,84,0.12)] focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                            : "border-[#E2E8F0] opacity-80 cursor-not-allowed"
                        }`}
                      >
                        {/* Decorative top accent */}
                        <div className="absolute inset-x-0 top-0 h-1.5 origin-left scale-x-0 bg-gradient-to-r from-[#172554] via-[#059669] to-emerald-400 transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />

                        {/* Card header */}
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-105 ${
                              report.isReady
                                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                : "border-[#E2E8F0] bg-slate-50 text-[#64748B]"
                            }`}
                          >
                            {report.icon}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#172554]">
                              REPORT {report.reportNumber}
                            </span>

                            {report.isReady ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Ready
                              </span>
                            ) : (
                              <span className="rounded-full border border-[#E2E8F0] bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
                                Coming Soon
                              </span>
                            )}
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
                            {report.features.slice(0, 4).map((feature, i) => (
                              <li
                                key={`${report.id}-feature-${i}`}
                                className="flex items-start gap-2.5 text-sm leading-5 text-[#475569]"
                              >
                                <span
                                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                    report.isReady
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  <svg
                                    className="h-3 w-3"
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
                                </span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Report action button */}
                        <div className="mt-6 border-t border-[#EEF2F7] pt-5">
                          {report.isReady ? (
                            <div
                              aria-hidden="true"
                              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 select-none ${
                                !isActionDisabled
                                  ? "bg-[#172554] text-white shadow-md shadow-blue-950/10 group-hover:-translate-y-0.5 group-hover:bg-[#059669] group-hover:shadow-lg group-hover:shadow-emerald-900/20"
                                  : "cursor-not-allowed border border-[#E2E8F0] bg-slate-50 text-[#94A3B8]"
                              }`}
                            >
                              <span>
                                {isClientAdmin && !isClientAdminSelectionValid
                                  ? "Select User, Case & File"
                                  : isSuperAdmin && !isSuperAdminSelectionValid
                                  ? "Select Client & Case"
                                  : "Open Report"}
                              </span>

                              {!isActionDisabled && (
                                <svg
                                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                                  />
                                </svg>
                              )}
                            </div>
                          ) : (
                            <div
                              aria-hidden="true"
                              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-slate-50 px-4 py-3 text-sm font-semibold text-[#94A3B8] select-none"
                            >
                              Pipeline Stage
                              <span className="text-xs font-normal">
                                (Next Phase)
                              </span>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Empty state when search finds no reports */
                <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#172554]">
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
                        d="M9 13h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-[#172554]">
                    No reports found
                  </h3>

                  <p className="mt-2 text-sm text-[#64748B]">
                    No reports match your current search or category.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    className="mt-5 rounded-xl bg-[#172554] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Client Admin case report modal */}
          {isClientAdmin && (
            <ClientAdminReportModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              onCaseSelect={(newCaseId) => handleSwitchCase(newCaseId)}
            />
          )}
        </main>

        <UserFooter />
      </div>
    </div>
  );
}