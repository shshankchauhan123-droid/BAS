import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import { useAuth } from "../../context/AuthContext";
import CreateCaseModal from "../../components/cases/CreateCaseModal";
import { getCases, createCase } from "../../services/api/case";
import { getDashboardStatistics } from "../../services/api/dashboard";
import { getIOMasters } from "../../services/api/ioMaster";

function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const isNormalUser = userRole === "user";

  const canViewCases = !isNormalUser || user?.permissions?.can_view_cases !== false;
  const canCreateCase = !isNormalUser || user?.permissions?.can_create_case !== false;
  const canViewIO = !isNormalUser || user?.permissions?.can_view_io !== false;
  const canViewReports = !isNormalUser || user?.permissions?.can_view_reports !== false;

  const [cases, setCases] = useState([]);
  const [ioList, setIoList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [casesRes, ioRes, statsRes] = await Promise.allSettled([
          canViewCases ? getCases() : Promise.resolve(null),
          canViewIO ? getIOMasters() : Promise.resolve(null),
          getDashboardStatistics(),
        ]);

        if (isMounted) {
          if (casesRes.status === "fulfilled" && Array.isArray(casesRes.value?.data)) {
            setCases(casesRes.value.data);
          }
          if (ioRes.status === "fulfilled" && Array.isArray(ioRes.value?.data)) {
            setIoList(ioRes.value.data);
          }
          if (statsRes.status === "fulfilled" && statsRes.value) {
            setStats(statsRes.value);
            setStatsError(false);
          } else {
            setStatsError(true);
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [canViewCases, canViewIO]);

  // Safe data extraction for dashboard statistics (supports direct or nested .data response)
  const statsData =
    stats && typeof stats === "object"
      ? stats.data && typeof stats.data === "object"
        ? stats.data
        : stats
      : null;

  /**
   * Safely formats KPI statistics:
   * - Shows "..." when loading
   * - Shows "ERR" when an error occurred, stats is missing, or the property is missing/invalid
   * - Valid 0 formatted as "00"
   * - 1 to 99 zero-padded as "01", "02", ..., "99"
   * - > 99 displayed in full without truncation (e.g. "150", "2850")
   */
  const formatStatValue = (val) => {
    if (loading) return "...";
    if (statsError || !statsData) return "ERR";
    if (val === undefined || val === null || val === "") return "ERR";
    const num = Number(val);
    if (isNaN(num)) return "ERR";
    if (num < 0) return "00";
    if (num === 0) return "00";
    return num > 99 ? String(num) : String(num).padStart(2, "0");
  };

  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  const handleCreateCase = () => {
    setIsCaseModalOpen(true);
  };

  const handleCaseSubmit = async (data) => {
    try {
      setIsCreatingCase(true);
      const response = await createCase(data);
      const createdCase = response?.data;

      await Swal.fire({
        icon: "success",
        title: "Case Created",
        text: createdCase?.case_number
          ? `${createdCase.case_number} has been created successfully.`
          : "The case has been created successfully.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#059669",
        confirmButtonColor: "#059669",
        confirmButtonText: "Open Case",
        customClass: {
          popup: "border border-slate-200 rounded-2xl shadow-xl",
        },
      });

      setIsCaseModalOpen(false);

      if (createdCase?.id) {
        navigate(`/dashboard/cases/${createdCase.id}`);
      } else {
        const casesRes = await getCases();
        if (Array.isArray(casesRes?.data)) setCases(casesRes.data);
      }
    } catch (error) {
      console.error("Failed to create case:", error);
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        "Unable to create the case.";

      await Swal.fire({
        icon: "error",
        title: "Case Creation Failed",
        text: message,
        background: "#ffffff",
        color: "#172033",
        iconColor: "#dc2626",
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Try Again",
        customClass: {
          popup: "border border-slate-200 rounded-2xl shadow-xl",
        },
      });
      throw error;
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleViewCases = () => {
    navigate("/dashboard/cases");
  };

  const handleIOMaster = () => {
    navigate("/dashboard/io-master");
  };

  const handleReports = () => {
    navigate("/reports");
  };

  const handleAnalysis = () => {
    navigate("/analysis");
  };

  return (
    <div className="arthbodh-user-dashboard min-h-screen bg-[#F5F8FC] text-[#172033] flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
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
          animation: arthbodhFadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .arthbodh-stagger-1 { animation-delay: 50ms; }
        .arthbodh-stagger-2 { animation-delay: 100ms; }
        .arthbodh-stagger-3 { animation-delay: 150ms; }
        .arthbodh-stagger-4 { animation-delay: 200ms; }
        .arthbodh-stagger-5 { animation-delay: 250ms; }

        .arthbodh-card-elevate {
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease;
        }

        .arthbodh-card-elevate:hover {
          transform: translateY(-3px);
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
      `}</style>

      {/* =========================================================
          NAVBAR (SHARED LIGHT SIDEBAR COMPONENT)
      ========================================================== */}
      <UserNavbar />

      {/* =========================================================
          MAIN WORKSPACE
      ========================================================== */}
      <main className="relative flex-1 overflow-x-hidden">
        {/* Subtle Ambient Light Grid Background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Gentle ambient sapphire-emerald gradient */}
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="absolute right-0 top-20 h-[450px] w-[450px] rounded-full bg-blue-200/20 blur-3xl" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(226, 232, 240, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.8) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        {/* =======================================================
            CONTENT CONTAINER
        ======================================================== */}
        <div className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-9">
          {/* =====================================================
              DASHBOARD HEADER
          ====================================================== */}
          <section className="arthbodh-animate-entrance mb-8">
            <div className="flex flex-col justify-between gap-5 sm:gap-6 lg:flex-row lg:items-end">
              <div>
                {/* Brand / Subtitle Tag */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#059669]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                    Banking Analytical System
                  </span>
                  <span className="h-3 w-px bg-slate-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Enterprise Platform
                  </span>
                </div>

                {/* Main Heading: Banking Analysis (Navy) Dashboard (Emerald) */}
                <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                  Banking Analysis{" "}
                  <span className="text-[#059669]">
                    Dashboard
                  </span>
                </h1>

                {/* Description in muted slate blue-gray */}
                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-[#64748B]">
                  Analyze bank statements, transactions, accounts and financial
                  relationships through a centralized analytical workspace.
                </p>
              </div>

              {/* Create Case Button */}
              {canCreateCase && (
                <button
                  type="button"
                  onClick={handleCreateCase}
                  className="group inline-flex shrink-0 items-center justify-center gap-2.5 rounded-xl bg-[#059669] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm shadow-emerald-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#047857] hover:shadow-md hover:shadow-emerald-900/20 active:translate-y-0"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    className="transition-transform duration-200 group-hover:scale-110"
                  >
                    <path d="M12 5V19" />
                    <path d="M5 12H19" />
                  </svg>
                  <span>Create Analysis Case</span>
                </button>
              )}
            </div>
          </section>

          {/* =====================================================
              ANALYSIS OVERVIEW — 4 DYNAMIC KPI CARDS
          ====================================================== */}
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-4 w-1 rounded-full bg-[#059669]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#172554]">
                  Analysis Overview
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#64748B]">
                {loading ? "Refreshing..." : "Live System Metrics"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. ANALYSIS CASES */}
              <div className="h-full arthbodh-animate-entrance arthbodh-stagger-1">
                <AnalysisStat
                  title="Analysis Cases"
                  value={formatStatValue(
                    statsData?.analysis_cases ?? statsData?.cases_count ?? statsData?.cases
                  )}
                  description="Total banking cases"
                  theme="emerald"
                  onClick={handleViewCases}
                  clickable={canViewCases}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6C4 4.9 4.9 4 6 4H18C19.1 4 20 4.9 20 6V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6Z" />
                      <path d="M8 8H16" />
                      <path d="M8 12H16" />
                      <path d="M8 16H13" />
                    </svg>
                  }
                />
              </div>

              {/* 2. INVESTIGATING OFFICERS */}
              <div className="h-full arthbodh-animate-entrance arthbodh-stagger-2">
                <AnalysisStat
                  title="Investigating Officers"
                  value={formatStatValue(
                    statsData?.investigating_officers ??
                      statsData?.investigating_officers_count ??
                      statsData?.io_count
                  )}
                  description="Master IO records"
                  theme="blue"
                  onClick={handleIOMaster}
                  clickable={canViewIO}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                />
              </div>

              {/* 3. BANK STATEMENTS */}
              <div className="h-full arthbodh-animate-entrance arthbodh-stagger-3">
                <AnalysisStat
                  title="Bank Statements"
                  value={formatStatValue(
                    statsData?.bank_statements ??
                      statsData?.statements_count ??
                      statsData?.files_count
                  )}
                  description="Statements processed"
                  theme="teal"
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 3.5H14L18 7.5V20.5H6V3.5Z" />
                      <path d="M14 3.5V7.5H18" />
                      <path d="M9 12H15" />
                      <path d="M9 15.5H14" />
                    </svg>
                  }
                />
              </div>

              {/* 4. TRANSACTIONS */}
              <div className="h-full arthbodh-animate-entrance arthbodh-stagger-4">
                <AnalysisStat
                  title="Transactions"
                  value={formatStatValue(
                    statsData?.transactions ?? statsData?.transactions_count
                  )}
                  description="Transactions analyzed"
                  theme="sapphire"
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 8H18" />
                      <path d="M15 5L18 8L15 11" />
                      <path d="M20 16H6" />
                      <path d="M9 13L6 16L9 19" />
                    </svg>
                  }
                />
              </div>
            </div>
          </section>

          {/* =====================================================
              ANALYTICAL WORKSPACE: RECENT CASES & QUICK ACTIONS
          ====================================================== */}
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* ===================================================
                RECENT ANALYSIS CASES
            ==================================================== */}
            <div className="arthbodh-card-elevate flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-7">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#059669]">
                      Case Management
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-[#172554] sm:text-xl">
                      Recent Analysis Cases
                    </h2>
                  </div>

                  {canViewCases && (
                    <button
                      type="button"
                      onClick={handleViewCases}
                      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#172554] transition-colors duration-150 hover:border-emerald-300 hover:bg-[#ECFDF5] hover:text-[#059669] sm:self-auto"
                    >
                      <span>View All Cases</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Content: Loading / Empty / Rows */}
                {loading ? (
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 py-14">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
                    <p className="text-xs font-medium text-[#64748B]">
                      Loading analysis cases...
                    </p>
                  </div>
                ) : cases.length === 0 ? (
                  /* Empty State */
                  <div className="mt-6 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-[#ECFDF5] text-[#059669]">
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7C4 5.9 4.9 5 6 5H10L12 7.5H18C19.1 7.5 20 8.4 20 9.5V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V7Z" />
                        <path d="M8 12H16" />
                        <path d="M8 15H13" />
                      </svg>
                    </div>

                    <h3 className="mt-4 text-sm font-bold text-[#172554]">
                      No Analysis Cases Available
                    </h3>

                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#64748B]">
                      Create a banking analysis case to upload bank statements,
                      process transactions, analyze accounts, and discover
                      financial relationships.
                    </p>

                    {canCreateCase && (
                      <button
                        type="button"
                        onClick={handleCreateCase}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-[#ECFDF5] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#059669] transition hover:bg-emerald-600 hover:text-white"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span>Create First Analysis Case</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-2.5">
                    {cases.slice(0, 4).map((caseItem) => (
                      <div
                        key={caseItem.id}
                        onClick={() => navigate(`/dashboard/cases/${caseItem.id}`)}
                        className="group flex flex-col justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 transition-all duration-150 hover:border-emerald-300 hover:bg-[#F0FDF4] cursor-pointer sm:flex-row sm:items-center shadow-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-[#059669] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md border border-emerald-200 bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-bold text-[#059669]">
                                {caseItem.case_number}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(
                                  caseItem.status
                                )}`}
                              >
                                {caseItem.status || "ACTIVE"}
                              </span>
                            </div>
                            <h4 className="mt-1 truncate text-sm font-bold text-[#172554] group-hover:text-[#059669] transition-colors">
                              {caseItem.case_name}
                            </h4>
                            {caseItem.io ? (
                              <p className="mt-1 text-xs text-[#64748B] flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-[#059669]">
                                  IO:
                                </span>
                                <strong className="text-[#172033]">
                                  {caseItem.io.officer_name}
                                </strong>
                                <span className="text-[11px] text-[#64748B]">
                                  ({caseItem.io.designation})
                                </span>
                              </p>
                            ) : (
                              <p className="mt-1 text-xs italic text-slate-400">
                                No IO Assigned
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <span className="font-mono text-[11px] text-[#64748B]">
                            {caseItem.created_at
                              ? new Date(caseItem.created_at).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )
                              : "-"}
                          </span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-hover:border-emerald-300 group-hover:bg-[#ECFDF5] group-hover:text-[#059669]">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              className="transition-transform group-hover:translate-x-0.5"
                            >
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ===================================================
                QUICK ACTIONS
            ==================================================== */}
            <div className="arthbodh-card-elevate flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-7">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#059669]">
                  Banking Operations
                </div>
                <h2 className="mt-1 text-lg font-bold text-[#172554] sm:text-xl">
                  Quick Actions
                </h2>

                <div className="mt-5 space-y-3">
                  {/* Create Case */}
                  {canCreateCase && (
                    <QuickAction
                      title="Create Analysis Case"
                      description="Create a workspace for a new banking analysis"
                      theme="emerald"
                      onClick={handleCreateCase}
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M12 5V19" />
                          <path d="M5 12H19" />
                        </svg>
                      }
                    />
                  )}

                  {/* Cases */}
                  {canViewCases && (
                    <QuickAction
                      title="Bank Analysis Cases"
                      description="View and manage your banking investigations"
                      theme="blue"
                      onClick={handleViewCases}
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        >
                          <path d="M4 7C4 5.9 4.9 5 6 5H10L12 7.5H18C19.1 7.5 20 8.4 20 9.5V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V7Z" />
                        </svg>
                      }
                    />
                  )}

                  {/* Investigating Officers (IO Master) */}
                  {canViewIO && (
                    <QuickAction
                      title="Investigating Officers (IO)"
                      description="Manage IO master records linked with cases"
                      theme="teal"
                      onClick={handleIOMaster}
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      }
                    />
                  )}

                  {/* Reports */}
                  {canViewReports && (
                    <QuickAction
                      title="Analytical Reports"
                      description="View generated banking analysis reports"
                      theme="gold"
                      onClick={handleReports}
                      icon={
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        >
                          <path d="M6 3.5H14L18 7.5V20.5H6V3.5Z" />
                          <path d="M14 3.5V7.5H18" />
                          <path d="M9 12H15" />
                          <path d="M9 15.5H13" />
                        </svg>
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              BANKING ANALYSIS TOOLS / MODULES
          ====================================================== */}
          <section className="mb-8">
            <div className="mb-4">
              <div className="flex items-center gap-2.5">
                <span className="h-4 w-1 rounded-full bg-[#059669]" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#059669]">
                    Analytical Modules
                  </div>
                  <h2 className="mt-0.5 text-base font-bold text-[#172554] sm:text-lg">
                    Banking Analysis Tools
                  </h2>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Specialized analytical capabilities within ARTHBODH for
                statements, transactions, accounts, and financial intelligence.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* STATEMENT ANALYSIS */}
              <ModuleCard
                title="Bank Statement Analysis"
                description="Parse, clean, and analyze multi-bank statements from supported formats."
                label="STATEMENT"
                theme="emerald"
                onClick={handleViewCases}
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  >
                    <path d="M6 3.5H14L18 7.5V20.5H6V3.5Z" />
                    <path d="M14 3.5V7.5H18" />
                    <path d="M9 11H15" />
                    <path d="M9 14.5H15" />
                    <path d="M9 18H12" />
                  </svg>
                }
              />

              {/* TRANSACTION ANALYSIS */}
              <ModuleCard
                title="Transaction Analysis"
                description="Audit credits, debits, counterparty flows, and chronological movements."
                label="TRANSACTIONS"
                theme="blue"
                onClick={handleReports}
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 8H18" />
                    <path d="M15 5L18 8L15 11" />
                    <path d="M20 16H6" />
                    <path d="M9 13L6 16L9 19" />
                  </svg>
                }
              />

              {/* ACCOUNT ANALYSIS */}
              <ModuleCard
                title="Account Analysis"
                description="Examine account balances, monthly trends, cash velocity, and ratios."
                label="ACCOUNTS"
                theme="teal"
                onClick={handleViewCases}
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 10L12 4L21 10" />
                    <path d="M5 10V19" />
                    <path d="M9 10V19" />
                    <path d="M15 10V19" />
                    <path d="M19 10V19" />
                    <path d="M3 19H21" />
                  </svg>
                }
              />

              {/* RELATIONSHIP ANALYSIS */}
              <ModuleCard
                title="Relationship Analysis"
                description="Detect multi-party networks, fund circularity, and layered counterparties."
                label="RELATIONSHIPS"
                theme="gold"
                onClick={handleReports}
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="6" cy="12" r="2.5" />
                    <circle cx="18" cy="6" r="2.5" />
                    <circle cx="18" cy="18" r="2.5" />
                    <path d="M8.3 10.9L15.7 7.1" />
                    <path d="M8.3 13.1L15.7 16.9" />
                  </svg>
                }
              />
            </div>
          </section>

          {/* =====================================================
              ANALYSIS PIPELINE STEPPER
          ====================================================== */}
          <section className="arthbodh-card-elevate rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#059669]">
                  Processing Pipeline
                </div>
                <h2 className="mt-1 text-base font-bold text-[#172554] sm:text-lg">
                  Bank Data Analysis Flow
                </h2>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[#ECFDF5] px-3.5 py-1.5 self-start sm:self-auto">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#059669]">
                  Ready for Analysis
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <PipelineStep
                number="01"
                title="Upload"
                description="Bank Statements"
                active
              />
              <PipelineStep
                number="02"
                title="Process"
                description="Extract & Normalize"
              />
              <PipelineStep
                number="03"
                title="Analyze"
                description="Transactions & Modes"
              />
              <PipelineStep
                number="04"
                title="Connect"
                description="Relationships & Flows"
              />
              <PipelineStep
                number="05"
                title="Report"
                description="Executive Intelligence"
              />
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================
          FOOTER (SHARED LIGHT FOOTER COMPONENT)
      ========================================================== */}
      <UserFooter />

      {/* =========================================================
          CREATE CASE MODAL
      ========================================================== */}
      <CreateCaseModal
        isOpen={isCaseModalOpen}
        onClose={() => {
          if (!isCreatingCase) {
            setIsCaseModalOpen(false);
          }
        }}
        onSubmit={handleCaseSubmit}
        isSubmitting={isCreatingCase}
      />
    </div>
  );
}

/* =============================================================
   HELPER: CASE STATUS BADGE STYLING
============================================================= */

function getStatusBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED" || s === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (s === "IN_PROGRESS" || s === "PROCESSING") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  if (s === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (s === "FAILED" || s === "ERROR") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

/* =============================================================
   SUB-COMPONENT: ANALYSIS STAT (KPI CARD)
============================================================= */

function AnalysisStat({
  title,
  value,
  description,
  icon,
  theme = "emerald",
  onClick,
  clickable = false,
}) {
  const themes = {
    emerald: {
      bar: "bg-[#059669]",
      badge: "border-emerald-200 bg-[#ECFDF5] text-[#059669]",
      hoverBorder: "hover:border-emerald-300",
    },
    blue: {
      bar: "bg-[#2563EB]",
      badge: "border-blue-200 bg-blue-50 text-[#2563EB]",
      hoverBorder: "hover:border-blue-300",
    },
    teal: {
      bar: "bg-teal-600",
      badge: "border-teal-200 bg-teal-50 text-teal-700",
      hoverBorder: "hover:border-teal-300",
    },
    sapphire: {
      bar: "bg-indigo-600",
      badge: "border-indigo-200 bg-indigo-50 text-indigo-600",
      hoverBorder: "hover:border-indigo-300",
    },
    gold: {
      bar: "bg-[#D6B36A]",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      hoverBorder: "hover:border-amber-300",
    },
  };

  const selectedTheme = themes[theme] || themes.emerald;

  return (
    <div
      onClick={clickable && onClick ? onClick : undefined}
      className={`arthbodh-card-elevate group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 ${
        selectedTheme.hoverBorder
      } ${clickable && onClick ? "cursor-pointer" : ""}`}
    >
      {/* Top Brand Color Accent Indicator */}
      <div
        className={`absolute inset-x-0 top-0 h-1 ${selectedTheme.bar} opacity-90 transition-opacity group-hover:opacity-100`}
      />

      {/* Top Section: Title (Reserved Height) + Upper-Right Anchored Icon */}
      <div className="flex items-start justify-between gap-2.5 pt-0.5">
        <div className="flex min-h-[34px] flex-1 items-start">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B] leading-[1.3] break-words">
            {title}
          </span>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${selectedTheme.badge} shadow-xs transition-transform duration-200 group-hover:scale-105`}
        >
          {icon}
        </div>
      </div>

      {/* Bottom Section: Metric Value + Description with Uniform Baselines */}
      <div className="mt-3.5 flex flex-col justify-end">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554] leading-none">
          {value}
        </div>
        <div className="mt-2 text-xs text-[#64748B] leading-tight truncate">
          {description}
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   SUB-COMPONENT: QUICK ACTION
============================================================= */

function QuickAction({
  title,
  description,
  theme = "emerald",
  onClick,
  icon,
}) {
  const themes = {
    emerald: "border-emerald-200 bg-[#ECFDF5] text-[#059669]",
    blue: "border-blue-200 bg-blue-50 text-[#2563EB]",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    gold: "border-amber-200 bg-amber-50 text-amber-800",
  };

  const badgeClass = themes[theme] || themes.emerald;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-xl border border-[#E2E8F0] bg-white p-3.5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-[#F0FDF4] hover:shadow-md"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${badgeClass} shadow-xs transition-transform duration-200 group-hover:scale-105`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-[#172554] transition-colors group-hover:text-[#059669]">
          {title}
        </div>
        <div className="mt-0.5 text-[11px] leading-4 text-[#64748B]">
          {description}
        </div>
      </div>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-all duration-200 group-hover:border-emerald-300 group-hover:bg-white group-hover:text-[#059669] group-hover:translate-x-0.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}

/* =============================================================
   SUB-COMPONENT: BANKING MODULE CARD
============================================================= */

function ModuleCard({
  title,
  description,
  label,
  theme = "emerald",
  icon,
  onClick,
}) {
  const themes = {
    emerald: {
      bar: "bg-[#059669]",
      badge: "border-emerald-200 bg-[#ECFDF5] text-[#059669]",
      label: "text-[#059669] bg-[#ECFDF5] border-emerald-200",
      hoverBorder: "hover:border-emerald-300",
    },
    blue: {
      bar: "bg-[#2563EB]",
      badge: "border-blue-200 bg-blue-50 text-[#2563EB]",
      label: "text-[#2563EB] bg-blue-50 border-blue-200",
      hoverBorder: "hover:border-blue-300",
    },
    teal: {
      bar: "bg-teal-600",
      badge: "border-teal-200 bg-teal-50 text-teal-700",
      label: "text-teal-700 bg-teal-50 border-teal-200",
      hoverBorder: "hover:border-teal-300",
    },
    gold: {
      bar: "bg-[#D6B36A]",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      label: "text-amber-800 bg-amber-50 border-amber-200",
      hoverBorder: "hover:border-amber-300",
    },
  };

  const selectedTheme = themes[theme] || themes.emerald;

  return (
    <div
      onClick={onClick}
      className={`arthbodh-card-elevate group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all duration-200 ${
        selectedTheme.hoverBorder
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${selectedTheme.bar} opacity-90`}
      />

      <div>
        <div className="flex items-start justify-between gap-3 pt-1">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl border ${selectedTheme.badge} shadow-xs transition-transform duration-200 group-hover:scale-105`}
          >
            {icon}
          </div>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedTheme.label}`}
          >
            {label}
          </span>
        </div>

        <h3 className="mt-4 text-sm font-bold text-[#172554] transition-colors group-hover:text-[#059669]">
          {title}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
          {description}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#059669]">
        <span>Explore Module</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="transition-transform group-hover:translate-x-1"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}

/* =============================================================
   SUB-COMPONENT: PIPELINE STEP
============================================================= */

function PipelineStep({
  number,
  title,
  description,
  active = false,
}) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-200 ${
        active
          ? "border-emerald-300 bg-[#ECFDF5] shadow-sm ring-1 ring-emerald-500/10"
          : "border-[#E2E8F0] bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-extrabold ${
            active
              ? "bg-[#059669] text-white shadow-xs"
              : "border border-slate-200 bg-slate-100 text-slate-500"
          }`}
        >
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-xs font-bold ${
              active ? "text-[#059669]" : "text-[#172554]"
            }`}
          >
            {title}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-[#64748B]">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;