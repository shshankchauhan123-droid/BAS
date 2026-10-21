
import { useCallback, useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";

import { getCase, getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getUsers } from "../../../services/api/user";
import { useAuth } from "../../../context/AuthContext";
import ClientAdminReportModal from "../../../components/admin/ClientAdminReportModal";

export default function CaseReportsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isClientAdmin =
    String(user?.role || "").toLowerCase() === "client_admin";

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

  // Load users for Client Admin
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

  // Load cases when a Client Admin selects a user
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

  // Load files when a Client Admin selects a case
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
      const rawList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setCaseFiles(rawList.filter((file) => !file.is_superseded));
    } catch (err) {
      console.error("Failed to load files for case:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFileId(e.target.value);
  };

  // Keep the selected case synchronized with the URL
  useEffect(() => {
    if (paramCaseId && paramCaseId !== activeCaseId) {
      setActiveCaseId(paramCaseId);
    }
  }, [paramCaseId, activeCaseId]);

  // Fetch all cases for the normal user case switcher
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

  // Switch the active case
  const handleSwitchCase = (newCaseId) => {
    if (!newCaseId || String(newCaseId) === String(activeCaseId)) {
      return;
    }

    setActiveCaseId(newCaseId);
  };

  // Load case details and associated files
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
      route: "/analysis",
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

  // Part 2 continues below this line.

  
  // Report routing and Client Admin validation
  const isClientAdminSelectionValid = Boolean(
    selectedUserId && selectedCaseId && selectedFileId
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

    return report.route;
  };

  const handleOpenReport = (report, e) => {
    if (e) {
      e.stopPropagation();
    }

    if (!report.isReady) {
      return;
    }

    // Client Admin validation
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

  // Dashboard UI
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
          {/* Breadcrumbs and back action */}
          {/* <div className="flex flex-wrap items-center justify-between gap-4">
            {isClientAdmin ? (
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D8E5F2] bg-white px-4 py-2.5 text-sm font-semibold text-[#172554] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
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
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a2 2 0 01.707.293l5.414 5.414a2 2 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                View Case Report
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/dashboard/cases")}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D8E5F2] bg-white px-4 py-2.5 text-sm font-semibold text-[#172554] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
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
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Cases
              </button>
            )}

            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <button
                type="button"
                onClick={() => navigate("/dashboard/cases")}
                className="transition hover:text-[#172554]"
              >
                Cases
              </button>
              <span>/</span>
              <span className="font-semibold text-emerald-700">
                Reports
              </span>
            </div>
          </div> */}

          {/* Client Admin: dependent user, case and file selectors */}
          {isClientAdmin ? (
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
            <>
              {/* Normal user: case switcher */}
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
                  Total Cases:{" "}
                  <span className="font-bold">{allCases.length}</span>
                </div>
              </section>

              {/* Case information and metrics */}
              <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
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
                        {caseData?.case_name ||
                          (activeCaseId ? "Loading case..." : "No case selected")}
                      </p>
                      {caseData?.case_number && (
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
                        {caseData?.io?.officer_name
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
              </section>
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0"
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
              <span>{error}</span>
            </div>
          )}

          {/* Part 3 continues here */}

          {/* Search and filter bar */}
          
          {/* Reports section heading */}
          <section className="mt-9">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

            {/* Responsive report cards: 1 mobile, 2 tablet, 3 desktop */}
            {filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredReports.map((report) => {
                  const isActionDisabled = isClientAdmin && !isClientAdminSelectionValid;

                  return (
                    <article
                      key={report.id}
                      tabIndex={report.isReady ? 0 : -1}
                      role={report.isReady ? "button" : undefined}
                      aria-label={
                        report.isReady
                          ? isActionDisabled
                            ? `${report.title} (Requires user, case, and file selection)`
                            : `Open ${report.title}`
                          : `${report.title} (Coming Soon)`
                      }
                      onClick={(e) => handleOpenReport(report, e)}
                      onKeyDown={(e) => {
                        if (report.isReady && (e.key === "Enter" || e.key === " ")) {
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

                    {/* Report action */}
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
                            {isActionDisabled
                              ? "Select User, Case & File"
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
              /* Empty state */
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