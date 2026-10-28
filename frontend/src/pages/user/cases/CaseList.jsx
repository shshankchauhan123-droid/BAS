
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import { createCase, getCases } from "../../../services/api/case";
import CaseTable from "../../../components/cases/CaseTable";
import CaseCard from "../../../components/cases/CaseCard";
import CreateCaseModal from "../../../components/cases/CreateCaseModal";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

const Icon = ({ name, size = 20, className = "" }) => {
  const paths = {
    cases: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M8 14h3M8 17h7" /></>,
    draft: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    progress: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    complete: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M18.4 15A7 7 0 0 1 6 18l-2-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    table: <><path d="M4 5h16M4 12h16M4 19h16M8 5v14" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    arrow: <><path d="m15 18-6-6 6-6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] || paths.cases}</svg>;
};

function StatCard({ label, value, note, icon, tone, percentage, loading, delay }) {
  const tones = {
    blue: { icon: "bg-blue-50 text-blue-700 ring-blue-100", number: "text-[#172554]", bar: "bg-blue-500", track: "bg-blue-50", top: "bg-blue-500" },
    amber: { icon: "bg-amber-50 text-amber-600 ring-amber-100", number: "text-amber-600", bar: "bg-amber-400", track: "bg-amber-50", top: "bg-amber-400" },
    indigo: { icon: "bg-indigo-50 text-indigo-600 ring-indigo-100", number: "text-indigo-600", bar: "bg-indigo-500", track: "bg-indigo-50", top: "bg-indigo-500" },
    emerald: { icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", number: "text-emerald-600", bar: "bg-emerald-500", track: "bg-emerald-50", top: "bg-emerald-500" },
  };
  const t = tones[tone] || tones.blue;

  return (
    <article className={`arth-case-enter arth-case-card relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6 ${delay}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${t.top}`} />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#64748B]">{label}</p>
          <p className={`mt-3 text-3xl font-extrabold tracking-tight ${t.number}`}>
            {loading ? <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-slate-100" /> : value.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">{note}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${t.icon}`}>
          <Icon name={icon} size={23} />
        </div>
      </div>
      <div className={`mt-5 h-1.5 overflow-hidden rounded-full ${t.track}`}>
        <div className={`h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }} />
      </div>
    </article>
  );
}

function CaseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const canViewCases = isSuperAdmin || isClientAdmin || user?.permissions?.can_view_cases !== false;
  const canCreateCase = isSuperAdmin || isClientAdmin || user?.permissions?.can_create_case !== false;

  const [cases, setCases] = useState([]);
  const [kpiStats, setKpiStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
    if (!canViewCases) {
      setCases([]);
      setKpiStats(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await getCases();
      setCases(Array.isArray(response?.data) ? response.data : []);
      if (response?.kpis) {
        setKpiStats(response.kpis);
      }
    } catch (requestError) {
      console.error("Failed to load cases:", requestError);
      const message = requestError?.response?.data?.detail || requestError?.message || "Unable to load investigation cases.";
      setError(typeof message === "string" ? message : "Unable to load investigation cases.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewCases]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const filteredCases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return cases;
    return cases.filter((caseData) =>
      [
        caseData?.case_number,
        caseData?.case_name,
        caseData?.description,
        caseData?.status,
        caseData?.io?.officer_name,
        caseData?.io?.designation,
        caseData?.io?.police_station,
        caseData?.creator?.username,
        caseData?.creator?.email,
        caseData?.owner_username,
        caseData?.owner_email,
      ].some((field) => String(field || "").toLowerCase().includes(search))
    );
  }, [cases, searchTerm]);

  const totalCases = kpiStats?.total_cases ?? cases.length;
  const draftCases = kpiStats?.draft_cases ?? cases.filter((item) => String(item.status || "").toUpperCase() === "DRAFT").length;
  const inProgressCases = kpiStats?.in_progress_cases ?? cases.filter((item) => String(item.status || "").toUpperCase() === "IN_PROGRESS").length;
  const completedCases = kpiStats?.completed_cases ?? cases.filter((item) => String(item.status || "").toUpperCase() === "COMPLETED").length;

  const totalBankStatements = kpiStats?.total_bank_statements ?? cases.reduce((acc, c) => acc + (c?.bank_statement_count || 0), 0);
  const totalNcrpWorkbooks = kpiStats?.total_ncrp_workbooks ?? cases.reduce((acc, c) => acc + (c?.ncrp_count || 0), 0);
  const totalDocuments = kpiStats?.total_documents ?? (totalBankStatements + totalNcrpWorkbooks);

  function handleOpenCase(caseData) {
    const caseId = caseData?.id;
    if (caseId === null || caseId === undefined || typeof caseId === "object" || typeof caseId === "function") {
      console.error("Invalid case ID:", caseId);
      return;
    }
    navigate(`/dashboard/cases/${String(caseId)}`);
  }

  async function handleCreateCase(data) {
    try {
      setIsCreating(true);
      const response = await createCase(data);
      const createdCase = response?.data;
      setIsModalOpen(false);
      await Swal.fire({
        icon: "success",
        title: "Case Created",
        text: createdCase?.case_number ? `${createdCase.case_number} has been created successfully.` : "The case has been created successfully.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#059669",
        confirmButtonColor: "#059669",
        confirmButtonText: "Continue",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });
      await loadCases();
      if (createdCase?.id !== null && createdCase?.id !== undefined) {
        navigate(`/dashboard/cases/${createdCase.id}`);
      }
    } catch (requestError) {
      console.error("Failed to create case:", requestError);
      const message = requestError?.response?.data?.detail || requestError?.message || "Unable to create the case.";
      await Swal.fire({
        icon: "error",
        title: "Case Creation Failed",
        text: typeof message === "string" ? message : "Unable to create the case.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#dc2626",
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Try Again",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });
    } finally {
      setIsCreating(false);
    }
  }

  
  return (
    <div className="arthbodh-case-page min-h-screen overflow-x-hidden bg-[#F5F8FC] text-[#172033] selection:bg-emerald-100 selection:text-emerald-900">
      <style>{`
        @keyframes arthCaseFade {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes arthCaseFloat {
          0%,100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(12px,-10px,0); }
        }
        .arth-case-enter {
          animation: arthCaseFade 520ms cubic-bezier(.16,1,.3,1) both;
        }
        .arth-case-stagger-1 { animation-delay: 70ms; }
        .arth-case-stagger-2 { animation-delay: 140ms; }
        .arth-case-stagger-3 { animation-delay: 210ms; }
        .arth-case-stagger-4 { animation-delay: 280ms; }
        .arth-case-card {
          transition: transform 220ms cubic-bezier(.16,1,.3,1),
            box-shadow 220ms ease, border-color 220ms ease;
        }
        .arth-case-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 14px 28px -12px rgba(23,37,84,.16);
        }
        .arth-case-grid {
          background-image:
            linear-gradient(rgba(148,163,184,.07) 1px,transparent 1px),
            linear-gradient(90deg,rgba(148,163,184,.07) 1px,transparent 1px);
          background-size: 36px 36px;
        }
        .arth-case-orb {
          animation: arthCaseFloat 11s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .arth-case-enter,.arth-case-orb { animation: none !important; }
          .arth-case-card,.arth-case-card:hover {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <UserNavbar />

      <main className="relative isolate min-h-[calc(100vh-80px)] overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="arth-case-grid absolute inset-0 opacity-70" />
          <div className="arth-case-orb absolute -right-32 -top-28 h-96 w-96 rounded-full bg-emerald-200/25 blur-3xl" />
          <div className="arth-case-orb absolute -left-32 top-80 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl [animation-delay:-4s]" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan-100/30 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          {!canViewCases ? (
            <section className="arth-case-enter mx-auto mt-12 max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Icon name="lock" size={30} />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#172554]">
                Access Restricted
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                You do not have permission to view investigation cases. Please
                contact your administrator if you believe this is a mistake.
              </p>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#059669] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#047857] focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <Icon name="arrow" size={16} />
                Back to Dashboard
              </button>
            </section>
          ) : (
            <>
              <section className="arth-case-enter flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3.5 py-1.5 shadow-sm backdrop-blur">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-700">
                      ARTHBODH · Investigation Workspace
                    </span>
                  </div>

                  <h1 className="text-3xl font-extrabold tracking-tight text-[#172554] sm:text-4xl lg:text-[42px]">
                    Case <span className="text-[#059669]">Management</span>
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                    Create, organize, and review investigation cases from one
                    centralized workspace. Track case progress and quickly
                    access the details you need.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 sm:text-sm">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                      <Icon name="cases" size={16} className="text-emerald-600" />
                      Investigation records
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                      <Icon name="progress" size={16} className="text-blue-600" />
                      Status and progress tracking
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={loadCases}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="refresh" size={16} className={isLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>

                  {canCreateCase && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      disabled={isCreating}
                      className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#059669] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#047857] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 transition group-hover:bg-white/20">
                        <Icon name="plus" size={16} />
                      </span>
                      Create New Case
                    </button>
                  )}
                </div>
              </section>

              <section className="arth-case-enter arth-case-stagger-1 mt-8">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-[#172554] sm:text-xl">
                      Case Overview
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      A quick summary of your investigation workload.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live case data
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total Cases" value={totalCases} note="All accessible investigations" icon="cases" tone="blue" percentage={totalCases ? 100 : 0} loading={isLoading} delay="arth-case-stagger-1" />
                  <StatCard label="Draft Cases" value={draftCases} note="Cases awaiting further action" icon="draft" tone="amber" percentage={totalCases ? draftCases / totalCases * 100 : 0} loading={isLoading} delay="arth-case-stagger-2" />
                  <StatCard label="In Progress" value={inProgressCases} note="Investigations in progress" icon="progress" tone="indigo" percentage={totalCases ? inProgressCases / totalCases * 100 : 0} loading={isLoading} delay="arth-case-stagger-3" />
                  <StatCard label="Completed Cases" value={completedCases} note="Investigations marked completed" icon="complete" tone="emerald" percentage={totalCases ? completedCases / totalCases * 100 : 0} loading={isLoading} delay="arth-case-stagger-4" />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 px-5 shadow-xs sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Case Documents & Workbooks Overview</span>
                      <p className="text-[11px] text-slate-500">Live document counts imported across accessible cases</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Bank Statements:</span>
                      <strong className="font-extrabold">{isLoading ? "..." : totalBankStatements.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-1.5 text-xs font-semibold text-purple-800">
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      <span>NCRP Workbooks:</span>
                      <strong className="font-extrabold">{isLoading ? "..." : totalNcrpWorkbooks.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-800">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Total Documents:</span>
                      <strong className="font-extrabold">{isLoading ? "..." : totalDocuments.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>
                </div>
              </section>


              <section className="arth-case-enter arth-case-stagger-2 mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-6 sm:px-7">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold tracking-tight text-[#172554] sm:text-2xl">
                          Investigation Cases
                        </h2>
                        <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {filteredCases.length} {filteredCases.length === 1 ? "case" : "cases"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Search your records and open a case to review its details,
                        documents, and investigation progress.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-80">
                        <Icon name="search" size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search cases..."
                          aria-label="Search investigation cases"
                          className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3 pl-11 pr-10 text-sm text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            aria-label="Clear search"
                            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-[#F8FAFC] p-1" aria-label="Choose case display">
                        <button
                          type="button"
                          onClick={() => setViewMode("table")}
                          aria-pressed={viewMode === "table"}
                          title="Table view"
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${viewMode === "table" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/70" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          <Icon name="table" size={16} />
                          <span className="hidden sm:inline">Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("grid")}
                          aria-pressed={viewMode === "grid"}
                          title="Card view"
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${viewMode === "grid" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/70" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          <Icon name="grid" size={16} />
                          <span className="hidden sm:inline">Cards</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {searchTerm.trim() && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <p className="text-sm text-blue-800">
                        Showing <span className="font-bold">{filteredCases.length}</span> matching{" "}
                        {filteredCases.length === 1 ? "case" : "cases"} for{" "}
                        <span className="font-bold">“{searchTerm.trim()}”</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-xs font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-900"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {isLoading ? (
                    <div className="space-y-4 py-3" aria-live="polite">
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 animate-pulse rounded-xl bg-emerald-50" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
                        </div>
                      </div>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-4">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="mx-auto max-w-xl py-10 text-center sm:py-14" role="alert">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                        <span className="text-2xl">!</span>
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-[#172033]">
                        Unable to Load Cases
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
                      <button
                        type="button"
                        onClick={loadCases}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] focus:outline-none focus:ring-4 focus:ring-emerald-100"
                      >
                        <Icon name="refresh" size={16} />
                        Try Again
                      </button>
                    </div>
                  ) : filteredCases.length === 0 ? (
                    <div className="mx-auto max-w-xl py-12 text-center sm:py-16">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                        <Icon name={searchTerm.trim() ? "search" : "cases"} size={28} />
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-[#172033]">
                        {searchTerm.trim() ? "No Matching Cases" : "No Investigation Cases Yet"}
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                        {searchTerm.trim()
                          ? "Try a different case number, case name, status, or investigating officer."
                          : "Create your first investigation case to start organizing statements, documents, and transaction analysis."}
                      </p>
                      {searchTerm.trim() ? (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          Clear Search
                        </button>
                      ) : canCreateCase ? (
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(true)}
                          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#059669] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#047857]"
                        >
                          <Icon name="plus" size={16} />
                          Create Your First Case
                        </button>
                      ) : null}
                    </div>
                  ) : viewMode === "table" ? (
                    <div className="overflow-x-auto">
                      <CaseTable
                        cases={filteredCases}
                        onOpenCase={handleOpenCase}
                        isClientAdmin={isClientAdmin || isSuperAdmin}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {filteredCases.map((caseData) => (
                        <CaseCard
                          key={caseData.id}
                          caseData={caseData}
                          onOpen={handleOpenCase}
                          isClientAdmin={isClientAdmin || isSuperAdmin}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {!isLoading && !error && filteredCases.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <p>
                      Displaying{" "}
                      <span className="font-semibold text-slate-700">{filteredCases.length}</span> of{" "}
                      <span className="font-semibold text-slate-700">{totalCases}</span> cases
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Select a case to open its investigation workspace
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <UserFooter />

      {canViewCases && canCreateCase && (
        <CreateCaseModal
          isOpen={isModalOpen}
          onClose={() => {
            if (!isCreating) setIsModalOpen(false);
          }}
          onSubmit={handleCreateCase}
          isSubmitting={isCreating}
          isClientAdmin={isClientAdmin}
        />
      )}
    </div>
  );
}

export default CaseList;
