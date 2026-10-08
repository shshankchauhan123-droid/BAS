import { useCallback, useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";

import { getCase, getCases } from "../../../services/api/case";

import { getCaseFiles } from "../../../services/api/file";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
import ClientAdminReportModal from "../../../components/admin/ClientAdminReportModal";

export default function CaseReportsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClientAdmin = String(user?.role || "").toLowerCase() === "client_admin";
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const { caseId: paramCaseId } = useParams();

  const [activeCaseId, setActiveCaseId] = useState(paramCaseId || "");

  const [allCases, setAllCases] = useState([]);

  const [loadingAllCases, setLoadingAllCases] = useState(false);

  const [caseData, setCaseData] = useState(null);

  const [files, setFiles] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("all");

  // ============================================================
  // Client Admin: 3-Dependent Dropdowns (User -> Case -> File)
  // ============================================================
  const [clientUsers, setClientUsers] = useState([]);
  const [userCases, setUserCases] = useState([]);
  const [caseFiles, setCaseFiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (!isClientAdmin) return;
    let isMounted = true;
    async function loadClientUsers() {
      try {
        setLoadingUsers(true);
        const res = await getUsers();
        const list = res?.users || res?.items || (Array.isArray(res) ? res : []);
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

  const handleCaseChange = async (e) => {
    const newCaseId = e.target.value;
    setSelectedCaseId(newCaseId);
    setSelectedFileId("");
    setCaseFiles([]);

    if (!newCaseId) return;

    setActiveCaseId(newCaseId);

    try {
      setLoadingFiles(true);
      const res = await getCaseFiles(newCaseId);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setCaseFiles(list);
    } catch (err) {
      console.error("Failed to load files for case:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFileId(e.target.value);
  };

  // ============================================================
  // Sync activeCaseId if paramCaseId changes
  // ============================================================

  useEffect(() => {
    if (paramCaseId && paramCaseId !== activeCaseId) {
      setActiveCaseId(paramCaseId);
    }
  }, [paramCaseId, activeCaseId]);

  // ============================================================
  // Fetch all cases for case switcher (Normal User only)
  // ============================================================

  useEffect(() => {
    if (isClientAdmin) return;
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
  }, []);

  // ============================================================
  // Switch Case
  // ============================================================

  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) {
      return;
    }

    setActiveCaseId(newCaseId);
  };

  // ============================================================
  // Load Case Data
  // ============================================================

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
        getCaseFiles(activeCaseId),
      ]);

      setCaseData(caseRes?.data || caseRes);

      const fileList = Array.isArray(filesRes?.data)
        ? filesRes.data
        : Array.isArray(filesRes)
        ? filesRes
        : [];

      setFiles(fileList);
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
  }, [activeCaseId]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // ============================================================
  // Reports Catalog
  // ============================================================

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
        "Comprehensive file-wise statement audit with fully filtered transactions, live narration & reference search with validation, debit/credit breakdown, balances, and CSV/Print export.",
      features: [
        "File-wise statement switching",
        "Live search with input validation",
        "Instant calendar date range pickers",
        "Debit & Credit type filters",
        "Opening & Closing balance checks",
        "Export CSV & Print Report",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
      route: "/analysis",
      description:
        "Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.",
      features: [
        "Upload CSV, XLSX, XLS, JSON",
        "Automatic column & type detection",
        "Dynamic X & Multi-Y Axis mapping",
        "Synchronized search, filters, KPIs & table",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
        "Dynamic amount & mode filtering",
        "Live Edge interactive drill-down",
        "Debit/Credit aggregations",
        "Visual node cluster analysis",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
        "Most frequent & round-value transaction analysis",
        "Financial concentration & balance trend",
        "File-wise statistical comparison",
      ],
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badgeColor: "emerald",
    }
  ];


  // ============================================================
  // Filter Reports & Route Builder
  // ============================================================

  const isClientAdminSelectionValid = Boolean(
    selectedUserId && selectedCaseId && selectedFileId
  );

  const getReportRoute = (report) => {
    if (isClientAdmin) {
      if (report.id === "dynamic-timeline-report") {
        return `/analysis?caseId=${encodeURIComponent(selectedCaseId)}&fileId=${encodeURIComponent(selectedFileId)}`;
      }
      if (report.id === "file-statement") {
        return `/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports/file-statement?fileId=${encodeURIComponent(selectedFileId)}`;
      }
      if (report.id === "transaction-relationships") {
        return `/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports/transaction-relationships?fileId=${encodeURIComponent(selectedFileId)}`;
      }
    }
    return report.route;
  };

  const filteredReports = reportsList.filter((report) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "available" && report.isReady) ||
      report.category === selectedCategory;

    const matchesSearch =
      !searchQuery.trim() ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="relative min-h-screen bg-[#020b09] text-white overflow-x-hidden">
      {/* Background Glow */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="pointer-events-none absolute -top-48 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-400/[0.03] blur-3xl" />

        <div className="pointer-events-none absolute right-[-150px] top-[400px] h-[400px] w-[400px] rounded-full bg-emerald-400/[0.02] blur-3xl" />
      </div>

      <div className="relative z-10">
        <BASNavbar />

        <main className="mx-auto w-full max-w-[1700px] px-4 py-8 sm:px-8 lg:px-10">
          {/* ============================================================
              Breadcrumbs & Back
          ============================================================ */}

          <div className="flex flex-wrap items-center justify-between gap-4">
            {isClientAdmin ? (
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-400/50 bg-[#06201a] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-300 shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-400 hover:text-[#020b09] active:scale-95 cursor-pointer"
              >
                <svg
                  className="h-4 w-4 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                VIEW CASE REPORT
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/dashboard/cases")}
                className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-400/40 bg-[#06201a] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-300 shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-400 hover:text-[#020b09] active:scale-95 cursor-pointer"
              >
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Cases
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                onClick={() => navigate("/dashboard/cases")}
                className="cursor-pointer hover:text-white transition"
              >
                Cases
              </span>

              <span>/</span>

              <span className="font-semibold text-emerald-400">
                Reports
              </span>
            </div>
          </div>

          {/* ============================================================
              Top Section: Client Admin (3 Dependent Dropdowns) vs User (Quick Case Switcher + Info Badges)
          ============================================================ */}
          {isClientAdmin ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-[#061411]/90 p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. SELECT USER */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hub-select-user"
                      className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/10 text-[10px] text-emerald-400 border border-emerald-400/30">
                        1
                      </span>
                      Select User
                    </label>
                    {loadingUsers && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                        Loading...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="hub-select-user"
                      value={selectedUserId}
                      onChange={handleUserChange}
                      disabled={loadingUsers}
                      className="w-full appearance-none rounded-xl border border-emerald-400/30 bg-[#020b09] px-3.5 py-2.5 pr-9 text-xs font-semibold text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition cursor-pointer disabled:opacity-50"
                    >
                      <option value="">-- Choose a User --</option>
                      {clientUsers.map((u) => (
                        <option
                          key={u.id}
                          value={u.id}
                          className="bg-[#061411] text-white"
                        >
                          {u.username} {u.email ? `(${u.email})` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 2. SELECT CASE */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hub-select-case"
                      className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/10 text-[10px] text-emerald-400 border border-emerald-400/30">
                        2
                      </span>
                      Select Case
                    </label>
                    {loadingCases && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                        Loading...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="hub-select-case"
                      value={selectedCaseId}
                      onChange={handleCaseChange}
                      disabled={!selectedUserId || loadingCases}
                      className="w-full appearance-none rounded-xl border border-emerald-400/30 bg-[#020b09] px-3.5 py-2.5 pr-9 text-xs font-semibold text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedUserId
                          ? "-- Select User First --"
                          : loadingCases
                          ? "-- Loading Cases... --"
                          : userCases.length === 0
                          ? "No cases found for this user"
                          : "-- Choose a Case --"}
                      </option>
                      {userCases.map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                          className="bg-[#061411] text-white"
                        >
                          {c.case_name || c.case_number || "Untitled Case"} (
                          {c.case_number})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 3. SELECT FILE */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hub-select-file"
                      className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/10 text-[10px] text-emerald-400 border border-emerald-400/30">
                        3
                      </span>
                      Select File
                    </label>
                    {loadingFiles && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                        Loading...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="hub-select-file"
                      value={selectedFileId}
                      onChange={handleFileChange}
                      disabled={!selectedCaseId || loadingFiles}
                      className="w-full appearance-none rounded-xl border border-emerald-400/30 bg-[#020b09] px-3.5 py-2.5 pr-9 text-xs font-semibold text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedCaseId
                          ? "-- Select Case First --"
                          : loadingFiles
                          ? "-- Loading Files... --"
                          : caseFiles.length === 0
                          ? "No files found for this case"
                          : "-- Choose a File --"}
                      </option>
                      {caseFiles.map((f) => (
                        <option
                          key={f.id}
                          value={f.id}
                          className="bg-[#061411] text-white"
                        >
                          {f.original_filename}{" "}
                          {f.bank_name ? `(${f.bank_name})` : ""} - {f.status}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================
                  Quick Case Switcher
              ============================================================ */}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-[#061411]/90 px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="hub-case-select"
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300"
                  >
                    <svg
                      className="h-4 w-4 text-emerald-400"
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

                    Select / Switch Case:
                  </label>

                  <div className="relative min-w-[260px] sm:min-w-[340px]">
                    <select
                      id="hub-case-select"
                      value={activeCaseId || ""}
                      onChange={(e) => handleSwitchCase(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-emerald-400/30 bg-[#020b09] px-3.5 py-2 pr-9 text-xs font-semibold text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition cursor-pointer"
                    >
                      <option value="" disabled>
                        -- Choose a Case --
                      </option>

                      {allCases.map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                          className="bg-[#061411] text-white"
                        >
                          {c.case_name || "Untitled Case"}
                        </option>
                      ))}
                    </select>

                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {loadingAllCases && (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />

                      Loading cases...
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  Total Cases:{" "}
                  <span className="font-bold text-slate-200">
                    {allCases.length}
                  </span>
                </div>
              </div>

              {/* ============================================================
                  Case Info Badges & Quick Metrics
              ============================================================ */}

              <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Case Name & IO Name */}

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-bold text-emerald-300 shadow-sm">
                    <svg
                      className="h-4 w-4 text-emerald-400 shrink-0"
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

                    <span className="text-slate-400 font-semibold text-xs">
                      Case:
                    </span>

                    <span>
                      {caseData?.case_name
                        ? caseData.case_name
                        : activeCaseId
                        ? "Loading..."
                        : "Please Select a Case"}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm font-bold text-sky-200 shadow-sm">
                    <svg
                      className="h-4 w-4 text-sky-400 shrink-0"
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

                    <span className="text-slate-400 font-semibold text-xs">
                      IO:
                    </span>

                    <span>
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

                {/* Quick Metrics */}

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#061411] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Uploaded Statements
                    </p>

                    <p className="mt-0.5 text-base font-bold text-white">
                      {files.length}{" "}
                      {files.length === 1 ? "File" : "Files"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                      Active Reports
                    </p>

                    <p className="mt-0.5 text-base font-bold text-emerald-300">
                      {reportsList.filter((report) => report.isReady).length}{" "}
                      Available
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================================
              Error Message
          ============================================================ */}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ============================================================
              Search & Filter Bar
          ============================================================ */}

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#061411] p-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Category tabs */}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  selectedCategory === "all"
                    ? "bg-emerald-400 text-black shadow-md shadow-emerald-400/20"
                    : "border border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:border-emerald-400/30"
                }`}
              >
                All Reports
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("available")}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  selectedCategory === "available"
                    ? "bg-emerald-400 text-black shadow-md shadow-emerald-400/20"
                    : "border border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:border-emerald-400/30"
                }`}
              >
                Available
              </button>

              <span className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-slate-400">
                Active Reports ({filteredReports.length})
              </span>
            </div>

            {/* Search Input */}

            <div className="relative min-w-[240px] sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report by name or feature..."
                className="w-full rounded-xl border border-white/[0.08] bg-[#020b09] pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
              />

              <svg
                className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500"
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

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* ============================================================
              REPORTS GRID
              
              3 reports in one row on large screens
              
              Mobile:
              1 column
              
              Tablet:
              2 columns
              
              Desktop:
              3 columns
          ============================================================ */}

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-none">
            {filteredReports.map((report, index) => {
              return (
                <div
                  key={report.id}
                  className={`group relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 ${
                    report.isReady
                      ? "border-emerald-400/30 bg-[#061411] shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-emerald-400/60 hover:shadow-[0_16px_50px_rgba(52,211,153,0.1)]"
                      : "border-white/[0.06] bg-[#040e0c]/70 opacity-85 hover:border-white/[0.12] hover:opacity-100"
                  }`}
                >
                  {/* Top Bar inside card */}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] text-emerald-400 group-hover:scale-105 transition-transform duration-200">
                        {report.icon}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Report #{index + 1}
                        </span>

                        {report.isReady ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-300 shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-slate-400">
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col">
  {report.reportNumber && (
    <span className="text-4xl font-extrabold text-white/[0.04] absolute top-4 right-6 group-hover:text-emerald-500/10 transition-colors pointer-events-none select-none">
      {report.reportNumber}
    </span>
  )}
  <div className="flex items-center gap-3">
    {report.reportNumber && (
      <span className="text-emerald-500 font-mono text-sm tracking-widest font-bold">
        {report.reportNumber}
      </span>
    )}
    <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
      {report.title}
    </h3>
  </div>
</div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {report.description}
                    </p>

                    {/* Features */}

                    <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Included Features:
                      </p>

                      <ul className="space-y-1.5">
                        {report.features.slice(0, 4).map((feat, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-xs text-slate-300"
                          >
                            <svg
                              className={`h-3.5 w-3.5 shrink-0 ${
                                report.isReady
                                  ? "text-emerald-400"
                                  : "text-slate-500"
                              }`}
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

                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Action Button */}

                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    {report.isReady ? (
                      <button
                        type="button"
                        disabled={isClientAdmin && !isClientAdminSelectionValid}
                        onClick={() => navigate(getReportRoute(report))}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                          !isClientAdmin || isClientAdminSelectionValid
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300 cursor-pointer"
                            : "border border-white/[0.08] bg-white/[0.03] text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <span>
                          {isClientAdmin && !isClientAdminSelectionValid
                            ? "Select User, Case & File"
                            : "Open Report"}
                        </span>

                        {(!isClientAdmin || isClientAdminSelectionValid) && (
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
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                      >
                        <span>Pipeline Stage</span>

                        <span className="text-[10px] text-slate-600">
                          (Next Phase)
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================
              Empty State
          ============================================================ */}

          {filteredReports.length === 0 && (
            <div className="mt-12 rounded-3xl border border-white/[0.06] bg-[#061411] p-12 text-center">
              <p className="text-sm font-semibold text-slate-300">
                No reports match your search criteria.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-3 text-xs text-emerald-400 hover:underline"
              >
                Clear search & show all reports
              </button>
            </div>
          )}

          {/* Client Admin View Case Report Modal */}
          {isClientAdmin && (
            <ClientAdminReportModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              onCaseSelect={(newCaseId) => handleSwitchCase(newCaseId)}
            />
          )}
        </main>
      </div>
    </div>
  );
}