import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import { createCase, getCases } from "../../services/api/case";
import { getClients } from "../../services/api/clients";
import CaseTable from "../../components/cases/CaseTable";
import CaseCard from "../../components/cases/CaseCard";
import CreateCaseModal from "../../components/cases/CreateCaseModal";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";

const Icon = ({ name, size = 20, className = "" }) => {
  const paths = {
    cases: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h3M8 17h7" />
      </>
    ),
    draft: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    progress: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    complete: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.6 9A7 7 0 0 1 18 6l2 6M18.4 15A7 7 0 0 1 6 18l-2-6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    table: (
      <>
        <path d="M4 5h16M4 12h16M4 19h16M8 5v14" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
      </>
    ),
    filter: (
      <>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] || paths.cases}
    </svg>
  );
};

function StatCard({ label, value, note, icon, tone, percentage, loading, delay }) {
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-700 ring-blue-100",
      number: "text-[#172554]",
      bar: "bg-blue-500",
      track: "bg-blue-50",
      top: "bg-blue-500",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600 ring-amber-100",
      number: "text-amber-600",
      bar: "bg-amber-400",
      track: "bg-amber-50",
      top: "bg-amber-400",
    },
    indigo: {
      icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
      number: "text-indigo-600",
      bar: "bg-indigo-500",
      track: "bg-indigo-50",
      top: "bg-indigo-500",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      number: "text-emerald-600",
      bar: "bg-emerald-500",
      track: "bg-emerald-50",
      top: "bg-emerald-500",
    },
  };
  const t = tones[tone] || tones.blue;

  return (
    <article
      className={`arth-case-enter arth-case-card relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6 ${delay}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${t.top}`} />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#64748B]">{label}</p>
          <p className={`mt-3 text-3xl font-extrabold tracking-tight ${t.number}`}>
            {loading ? (
              <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              Number(value || 0).toLocaleString("en-IN")
            )}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">{note}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${t.icon}`}>
          <Icon name={icon} size={23} />
        </div>
      </div>
      <div className={`mt-5 h-1.5 overflow-hidden rounded-full ${t.track}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${t.bar}`}
          style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
        />
      </div>
    </article>
  );
}

export default function SuperAdminCaseList() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState("table");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [casesRes, clientsRes] = await Promise.allSettled([
        getCases(),
        getClients(),
      ]);

      if (casesRes.status === "fulfilled") {
        const caseList = Array.isArray(casesRes.value?.data)
          ? casesRes.value.data
          : Array.isArray(casesRes.value)
            ? casesRes.value
            : [];
        setCases(caseList);
      } else {
        console.error("Failed to load cases:", casesRes.reason);
        const message =
          casesRes.reason?.response?.data?.detail ||
          casesRes.reason?.message ||
          "Unable to load global cases.";
        setError(typeof message === "string" ? message : "Unable to load global cases.");
      }

      if (clientsRes.status === "fulfilled") {
        const clientList = Array.isArray(clientsRes.value?.data)
          ? clientsRes.value.data
          : Array.isArray(clientsRes.value)
            ? clientsRes.value
            : [];
        setClients(clientList);
      } else {
        console.warn("Failed to load client companies for filter:", clientsRes.reason);
      }
    } catch (requestError) {
      console.error("Failed to load data:", requestError);
      setError("Unable to load investigation cases.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive unique companies from cases and clients
  const companyOptions = useMemo(() => {
    const map = new Map();

    // From loaded clients
    clients.forEach((c) => {
      if (c && c.id) {
        map.set(String(c.id), {
          id: String(c.id),
          name: c.name || `Company #${c.id}`,
          code: c.company_code || "",
        });
      }
    });

    // From cases (in case of legacy/extra clients)
    cases.forEach((c) => {
      const cid = c.client_id || c.client?.id;
      if (cid && !map.has(String(cid))) {
        map.set(String(cid), {
          id: String(cid),
          name: c.client?.name || c.client_name || `Company #${cid}`,
          code: c.client?.company_code || c.company_code || "",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [clients, cases]);

  // Filter cases by search, company, and status
  const filteredCases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return cases.filter((caseData) => {
      // 1. Company filter
      if (selectedCompany !== "ALL") {
        const caseClientId = String(caseData?.client_id || caseData?.client?.id || "");
        if (caseClientId !== selectedCompany) {
          return false;
        }
      }

      // 2. Status filter
      if (selectedStatus !== "ALL") {
        const caseStatus = String(caseData?.status || "").toUpperCase();
        if (caseStatus !== selectedStatus) {
          return false;
        }
      }

      // 3. Search query
      if (!search) return true;

      const caseCompanyName = caseData?.client?.name || caseData?.client_name || "";
      const caseCompanyCode = caseData?.client?.company_code || caseData?.company_code || "";
      const ownerCompanyName =
        caseData?.owner_client?.name ||
        caseData?.owner_client_name ||
        caseData?.creator?.client?.name ||
        "";
      const ownerCompanyCode =
        caseData?.owner_client?.company_code ||
        caseData?.owner_company_code ||
        caseData?.creator?.client?.company_code ||
        "";

      return [
        caseData?.case_number,
        caseData?.case_name,
        caseData?.description,
        caseData?.status,
        caseCompanyName,
        caseCompanyCode,
        ownerCompanyName,
        ownerCompanyCode,
        caseData?.creator?.username,
        caseData?.creator?.email,
        caseData?.owner_username,
        caseData?.owner_email,
        caseData?.io?.officer_name,
        caseData?.io?.designation,
        caseData?.io?.police_station,
      ].some((field) =>
        String(field || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [cases, searchTerm, selectedCompany, selectedStatus]);

  // KPIs
  const totalCases = cases.length;
  const draftCases = cases.filter(
    (item) => String(item.status || "").toUpperCase() === "DRAFT"
  ).length;
  const inProgressCases = cases.filter(
    (item) =>
      String(item.status || "").toUpperCase() === "IN_PROGRESS" ||
      String(item.status || "").toUpperCase() === "ACTIVE"
  ).length;
  const completedCases = cases.filter(
    (item) => String(item.status || "").toUpperCase() === "COMPLETED"
  ).length;

  function handleOpenCase(caseData) {
    const caseId = caseData?.id;
    if (caseId === null || caseId === undefined) {
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
        title: "Case Created Successfully",
        text: createdCase?.case_number
          ? `${createdCase.case_number} has been created and assigned.`
          : "The case has been created successfully.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#059669",
        confirmButtonColor: "#059669",
        confirmButtonText: "Continue to Case",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });

      await loadData();

      if (createdCase?.id !== null && createdCase?.id !== undefined) {
        navigate(`/dashboard/cases/${createdCase.id}`);
      }
    } catch (requestError) {
      console.error("Failed to create case:", requestError);
      const message =
        requestError?.response?.data?.detail ||
        requestError?.message ||
        "Unable to create the case.";
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
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(12px, -10px, 0); }
        }
        .arth-case-enter {
          animation: arthCaseFade 520ms cubic-bezier(.16, 1, .3, 1) both;
        }
        .arth-case-stagger-1 { animation-delay: 70ms; }
        .arth-case-stagger-2 { animation-delay: 140ms; }
        .arth-case-stagger-3 { animation-delay: 210ms; }
        .arth-case-stagger-4 { animation-delay: 280ms; }
        .arth-case-card {
          transition: transform 220ms cubic-bezier(.16, 1, .3, 1),
            box-shadow 220ms ease, border-color 220ms ease;
        }
        .arth-case-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 14px 28px -12px rgba(23, 37, 84, .16);
        }
        .arth-case-grid {
          background-image:
            linear-gradient(rgba(148, 163, 184, .07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, .07) 1px, transparent 1px);
          background-size: 36px 36px;
        }
        .arth-case-orb {
          animation: arthCaseFloat 11s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .arth-case-enter, .arth-case-orb { animation: none !important; }
          .arth-case-card, .arth-case-card:hover {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <UserNavbar />

      <main className="relative isolate min-h-[calc(100vh-80px)] overflow-hidden">
        {/* Soft background accents */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="arth-case-grid absolute inset-0 opacity-70" />
          <div className="arth-case-orb absolute -right-32 -top-28 h-96 w-96 rounded-full bg-emerald-200/25 blur-3xl" />
          <div className="arth-case-orb absolute -left-32 top-80 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl [animation-delay:-4s]" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan-100/30 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          {/* Header Section */}
          <section className="arth-case-enter flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3.5 py-1.5 shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-700">
                  COMPANY ADMINISTRATION · GLOBAL CASES REPOSITORY
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-[#172554] sm:text-4xl lg:text-[42px]">
                Cases <span className="text-[#059669]">Management</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Monitor and manage investigation cases across all client companies.
                Filter by organization, trace case ownership, and initiate new client investigations from one central control deck.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                  <Icon name="building" size={16} className="text-blue-600" />
                  Cross-company visibility
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                  <Icon name="progress" size={16} className="text-emerald-600" />
                  Multi-tenant lifecycle oversight
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="refresh" size={16} className={isLoading ? "animate-spin" : ""} />
                Refresh
              </button>

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
            </div>
          </section>

          {/* Error Banner */}
          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-800">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-bold">
                !
              </span>
              <div className="flex-1 text-sm">{error}</div>
              <button
                type="button"
                onClick={loadData}
                className="text-xs font-bold underline hover:text-rose-950"
              >
                Retry
              </button>
            </div>
          )}

          {/* KPI Stat Cards Section */}
          <section className="arth-case-enter arth-case-stagger-1 mt-8">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#172554] sm:text-xl">
                  System-Wide Cases Overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Aggregate workload across all registered client companies.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live aggregate data
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Cases"
                value={totalCases}
                note="Across all client tenants"
                icon="cases"
                tone="blue"
                percentage={totalCases ? 100 : 0}
                loading={isLoading}
                delay="arth-case-stagger-1"
              />
              <StatCard
                label="Draft Cases"
                value={draftCases}
                note="Cases awaiting statement upload"
                icon="draft"
                tone="amber"
                percentage={totalCases ? (draftCases / totalCases) * 100 : 0}
                loading={isLoading}
                delay="arth-case-stagger-2"
              />
              <StatCard
                label="In Progress"
                value={inProgressCases}
                note="Active & processing investigations"
                icon="progress"
                tone="indigo"
                percentage={totalCases ? (inProgressCases / totalCases) * 100 : 0}
                loading={isLoading}
                delay="arth-case-stagger-3"
              />
              <StatCard
                label="Completed Cases"
                value={completedCases}
                note="Fully audited & generated reports"
                icon="complete"
                tone="emerald"
                percentage={totalCases ? (completedCases / totalCases) * 100 : 0}
                loading={isLoading}
                delay="arth-case-stagger-4"
              />
            </div>
          </section>

          {/* Main Cases Container */}
          <section className="arth-case-enter arth-case-stagger-2 mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            {/* Header & Filter Controls Bar */}
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
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Global view of all client investigations and assigned investigators.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative min-w-[240px] flex-1 sm:w-64 sm:flex-none">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Icon name="search" size={17} />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search cases, companies, owners…"
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2.5 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                    />
                  </div>

                  {/* Client Company Filter Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      aria-label="Filter by Client Company"
                      className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                    >
                      <option value="ALL">All Companies ({companyOptions.length})</option>
                      {companyOptions.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name} {comp.code ? `(${comp.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      aria-label="Filter by Status"
                      className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ARCHIVED">Archived</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>

                  {/* View Switcher: Table vs Cards */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-[#F8FAFC] p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      aria-label="Table view"
                      title="Table view"
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                        viewMode === "table"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      <Icon name="table" size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-label="Cards view"
                      title="Cards view"
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                        viewMode === "grid"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      <Icon name="grid" size={17} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active filter pills */}
              {(searchTerm || selectedCompany !== "ALL" || selectedStatus !== "ALL") && (
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Active filters:
                  </span>

                  {searchTerm && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Query: &ldquo;{searchTerm}&rdquo;
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {selectedCompany !== "ALL" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      Company: {companyOptions.find((c) => c.id === selectedCompany)?.name || selectedCompany}
                      <button
                        type="button"
                        onClick={() => setSelectedCompany("ALL")}
                        className="text-blue-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {selectedStatus !== "ALL" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Status: {selectedStatus}
                      <button
                        type="button"
                        onClick={() => setSelectedStatus("ALL")}
                        className="text-emerald-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCompany("ALL");
                      setSelectedStatus("ALL");
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline ml-1"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {/* Cases Table or Grid View */}
            <div className="p-4 sm:p-6 lg:p-7">
              {isLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
                  <p className="mt-4 text-sm font-semibold text-slate-600">
                    Loading global investigation cases…
                  </p>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Icon name="cases" size={26} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#172554]">
                    No cases match the selected criteria
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    {cases.length === 0
                      ? "No cases exist in the system yet. Click 'Create New Case' to register an investigation."
                      : "Try clearing your search query or adjusting your company and status filters."}
                  </p>
                  {(searchTerm || selectedCompany !== "ALL" || selectedStatus !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCompany("ALL");
                        setSelectedStatus("ALL");
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              ) : viewMode === "table" ? (
                <CaseTable
                  cases={filteredCases}
                  isSuperAdmin={true}
                  onOpenCase={handleOpenCase}
                />
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredCases.map((caseData) => (
                    <CaseCard
                      key={caseData.id}
                      caseData={caseData}
                      isSuperAdmin={true}
                      onOpen={handleOpenCase}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <UserFooter />

      {/* Super Admin Create Case Modal */}
      <CreateCaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCase}
        isSubmitting={isCreating}
        isSuperAdmin={true}
      />
    </div>
  );
}
