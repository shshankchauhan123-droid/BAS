import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import { getCases } from "../../services/api/case";
import { getIOMasters } from "../../services/api/ioMaster";

function UserDashboard() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [ioList, setIoList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [casesRes, ioRes] = await Promise.allSettled([
          getCases(),
          getIOMasters(),
        ]);

        if (isMounted) {
          if (casesRes.status === "fulfilled" && Array.isArray(casesRes.value?.data)) {
            setCases(casesRes.value.data);
          }
          if (ioRes.status === "fulfilled" && Array.isArray(ioRes.value?.data)) {
            setIoList(ioRes.value.data);
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
  }, []);

  const handleCreateCase = () => {
    navigate("/dashboard/cases/create");
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
    <div className="min-h-screen bg-[#06100e] text-white">

      {/* =========================================================
          NAVBAR
      ========================================================== */}
      <UserNavbar />

      {/* =========================================================
          MAIN
      ========================================================== */}
      <main className="relative overflow-hidden">

        {/* =======================================================
            BACKGROUND
        ======================================================== */}
        <div className="pointer-events-none absolute inset-0">

          {/* Emerald glow */}
          <div className="absolute left-[-180px] top-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-500/[0.035] blur-3xl" />

          {/* Cyan glow */}
          <div className="absolute right-[-220px] top-[160px] h-[480px] w-[480px] rounded-full bg-cyan-500/[0.025] blur-3xl" />

          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.022]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />

        </div>

        {/* =======================================================
            CONTENT CONTAINER
        ======================================================== */}
        <div className="relative mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">

          {/* =====================================================
              HEADER
          ====================================================== */}
          <section className="mb-8">

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">

              <div>

                {/* Section Label */}
                <div className="mb-4 flex items-center gap-2">

                  <span className="h-px w-8 bg-emerald-400" />

                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
                    Bank Analytical System
                  </span>

                </div>

                {/* Main Heading */}
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[42px]">
                  Banking Analysis{" "}
                  <span className="text-emerald-400">
                    Dashboard
                  </span>
                </h1>

                {/* Description */}
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Analyze bank statements, transactions, accounts and
                  financial relationships through a centralized analytical
                  workspace.
                </p>

              </div>

              {/* Create Case */}
              <button
                type="button"
                onClick={handleCreateCase}
                className="group flex items-center justify-center gap-3 rounded-xl bg-emerald-400 px-5 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-[#04100d] shadow-lg shadow-emerald-950/40 transition duration-200 hover:bg-emerald-300 hover:shadow-emerald-900/50"
              >

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 5V19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  <path
                    d="M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                Create Analysis Case

              </button>

            </div>

          </section>

          {/* =====================================================
              SYSTEM OVERVIEW
          ====================================================== */}
          <section className="mb-6">

            <div className="mb-4 flex items-center gap-3">

              <div className="h-5 w-1 rounded-full bg-emerald-400" />

              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
                Analysis Overview
              </h2>

            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

              {/* =================================================
                  TOTAL CASES
              ================================================== */}
              <AnalysisStat
                title="Analysis Cases"
                value={loading ? "..." : String(cases.length).padStart(2, "0")}
                description="Total banking cases"
                color="emerald"
                onClick={handleViewCases}
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 6C4 4.9 4.9 4 6 4H18C19.1 4 20 4.9 20 6V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M8 8H16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M8 12H16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M8 16H13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  INVESTIGATING OFFICERS (IO)
              ================================================== */}
              <AnalysisStat
                title="Investigating Officers"
                value={loading ? "..." : String(ioList.length).padStart(2, "0")}
                description="Master IO records"
                color="teal"
                onClick={handleIOMaster}
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
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

              {/* =================================================
                  STATEMENTS
              ================================================== */}
              <AnalysisStat
                title="Bank Statements"
                value="00"
                description="Statements processed"
                color="cyan"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 3.5H14L18 7.5V20.5H6V3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M14 3.5V7.5H18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M9 12H15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 15.5H14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  TRANSACTIONS
              ================================================== */}
              <AnalysisStat
                title="Transactions"
                value="00"
                description="Transactions analyzed"
                color="violet"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 8H18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M15 5L18 8L15 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M20 16H6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 13L6 16L9 19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  REPORTS
              ================================================== */}
              <AnalysisStat
                title="Analytical Reports"
                value="00"
                description="Reports generated"
                color="amber"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 19V5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M5 19H20"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M8 15L11 11L14 13L19 7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />

            </div>

          </section>

          {/* =====================================================
              ANALYTICAL WORKSPACE
          ====================================================== */}
          <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">

            {/* ===================================================
                RECENT CASES
            ==================================================== */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a1714]/80 p-6 shadow-2xl backdrop-blur-xl">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Case Management
                  </div>

                  <h2 className="mt-2 text-lg font-semibold text-white">
                    Recent Analysis Cases
                  </h2>

                </div>

                <button
                  type="button"
                  onClick={handleViewCases}
                  className="rounded-lg border border-white/[0.06] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:border-emerald-400/20 hover:text-emerald-400"
                >
                  View All Cases
                </button>

              </div>

              {/* Recent Cases Content */}
              {loading ? (
                <div className="mt-8 flex flex-col items-center justify-center gap-3 py-10">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <p className="text-xs text-slate-500">Loading analysis cases...</p>
                </div>
              ) : cases.length === 0 ? (
                /* Empty State */
                <div className="mt-6 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05]">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-emerald-400"
                    >
                      <path
                        d="M4 7C4 5.9 4.9 5 6 5H10L12 7.5H18C19.1 7.5 20 8.4 20 9.5V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V7Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M8 12H16"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />

                      <path
                        d="M8 15H13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <h3 className="mt-5 text-sm font-semibold text-slate-200">
                    No Analysis Cases Available
                  </h3>

                  <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">
                    Create a banking analysis case to upload bank statements,
                    process transactions, analyze accounts and discover
                    financial relationships.
                  </p>

                  <button
                    type="button"
                    onClick={handleCreateCase}
                    className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.1]"
                  >
                    Create First Analysis Case
                  </button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-white/[0.05]">
                  {cases.slice(0, 4).map((caseItem) => (
                    <div
                      key={caseItem.id}
                      onClick={() => navigate(`/dashboard/cases/${caseItem.id}`)}
                      className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5 px-3 rounded-xl transition hover:bg-white/[0.03] cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-300 font-mono">
                              {caseItem.case_number}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                              {caseItem.status}
                            </span>
                          </div>
                          <h4 className="mt-0.5 text-sm font-semibold text-white group-hover:text-emerald-300 transition">
                            {caseItem.case_name}
                          </h4>
                          {caseItem.io ? (
                            <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-semibold text-emerald-400/80">IO:</span>
                              <strong className="text-slate-200">{caseItem.io.officer_name}</strong>
                              <span className="text-[11px] text-slate-400">({caseItem.io.designation})</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-600 italic">No IO Assigned</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {caseItem.created_at
                            ? new Date(caseItem.created_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-slate-500 group-hover:text-emerald-300 transition"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ===================================================
                QUICK OPERATIONS
            ==================================================== */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a1714]/80 p-6 shadow-2xl backdrop-blur-xl">

              <div>

                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Banking Operations
                </div>

                <h2 className="mt-2 text-lg font-semibold text-white">
                  Quick Actions
                </h2>

              </div>

              <div className="mt-6 space-y-3">

                {/* Create Case */}
                <QuickAction
                  title="Create Analysis Case"
                  description="Create a workspace for a new banking analysis"
                  color="emerald"
                  onClick={handleCreateCase}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 5V19"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M5 12H19"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />

                {/* Cases */}
                <QuickAction
                  title="Bank Analysis Cases"
                  description="View and manage your banking investigations"
                  color="cyan"
                  onClick={handleViewCases}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M4 7C4 5.9 4.9 5 6 5H10L12 7.5H18C19.1 7.5 20 8.4 20 9.5V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V7Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />

                {/* Investigating Officers (IO Master) */}
                <QuickAction
                  title="Investigating Officers (IO)"
                  description="Manage IO master records linked with cases"
                  color="teal"
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

                {/* Analysis */}
                <QuickAction
                  title="Transaction Analysis"
                  description="Analyze transactions and financial movements"
                  color="violet"
                  onClick={handleAnalysis}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M4 8H18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />

                      <path
                        d="M15 5L18 8L15 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M20 16H6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />

                      <path
                        d="M9 13L6 16L9 19"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />

                {/* Reports */}
                <QuickAction
                  title="Analytical Reports"
                  description="View generated banking analysis reports"
                  color="amber"
                  onClick={handleReports}
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M6 3.5H14L18 7.5V20.5H6V3.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M14 3.5V7.5H18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M9 12H15"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />

                      <path
                        d="M9 15.5H13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />

              </div>

            </div>

          </section>

          {/* =====================================================
              BANKING ANALYSIS MODULES
          ====================================================== */}
          <section className="mt-8">

            <div className="mb-5">

              <div className="flex items-center gap-3">

                <div className="h-5 w-1 rounded-full bg-emerald-400" />

                <div>

                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Analytical Modules
                  </div>

                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Banking Analysis Tools
                  </h2>

                </div>

              </div>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                Tools available within the Bank Analytical System for
                analyzing statements, transactions, accounts and financial
                relationships.
              </p>

            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              {/* =================================================
                  STATEMENT ANALYSIS
              ================================================== */}
              <ModuleCard
                title="Bank Statement Analysis"
                description="Process and analyze bank statements from supported file formats."
                label="STATEMENT"
                color="emerald"
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 3.5H14L18 7.5V20.5H6V3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M14 3.5V7.5H18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M9 11H15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 14.5H15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 18H12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  TRANSACTION ANALYSIS
              ================================================== */}
              <ModuleCard
                title="Transaction Analysis"
                description="Analyze transaction values, dates, parties and financial movements."
                label="TRANSACTIONS"
                color="cyan"
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 8H18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M15 5L18 8L15 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M20 16H6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 13L6 16L9 19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  ACCOUNT ANALYSIS
              ================================================== */}
              <ModuleCard
                title="Account Analysis"
                description="Examine account activity, balances, credits, debits and trends."
                label="ACCOUNTS"
                color="violet"
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M3 10L12 4L21 10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M5 10V19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M9 10V19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M15 10V19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M19 10V19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M3 19H21"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />

              {/* =================================================
                  RELATIONSHIP ANALYSIS
              ================================================== */}
              <ModuleCard
                title="Relationship Analysis"
                description="Identify relationships between accounts, entities and transactions."
                label="RELATIONSHIPS"
                color="amber"
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="6"
                      cy="12"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <circle
                      cx="18"
                      cy="6"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <circle
                      cx="18"
                      cy="18"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M8.3 10.9L15.7 7.1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M8.3 13.1L15.7 16.9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                }
              />

            </div>

          </section>

          {/* =====================================================
              ANALYSIS PIPELINE
          ====================================================== */}
          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0a1714]/70 p-6 backdrop-blur-xl">

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>

                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Processing Pipeline
                </div>

                <h2 className="mt-2 text-lg font-semibold text-white">
                  Bank Data Analysis Flow
                </h2>

              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-1.5">

                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-emerald-400">
                  Ready for Analysis
                </span>

              </div>

            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-5">

              <PipelineStep
                number="01"
                title="Upload"
                description="Bank Statements"
                active
              />

              <PipelineStep
                number="02"
                title="Process"
                description="Extract Data"
              />

              <PipelineStep
                number="03"
                title="Analyze"
                description="Transactions"
              />

              <PipelineStep
                number="04"
                title="Connect"
                description="Relationships"
              />

              <PipelineStep
                number="05"
                title="Report"
                description="Insights"
              />

            </div>

          </section>

        </div>
      </main>

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <UserFooter />

    </div>
  );
}

/* =============================================================
   ANALYSIS STAT
============================================================= */

function AnalysisStat({
  title,
  value,
  description,
  icon,
  color,
  onClick,
}) {
  const colors = {
    emerald:
      "border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-400",

    teal:
      "border-teal-400/10 bg-teal-400/[0.06] text-teal-400",

    cyan:
      "border-cyan-400/10 bg-cyan-400/[0.06] text-cyan-400",

    violet:
      "border-violet-400/10 bg-violet-400/[0.06] text-violet-400",

    amber:
      "border-amber-400/10 bg-amber-400/[0.06] text-amber-400",
  };

  return (
    <div
      onClick={onClick}
      className={`group rounded-2xl border border-white/[0.06] bg-[#0a1714]/80 p-5 shadow-xl backdrop-blur-xl transition duration-200 hover:border-white/[0.12] hover:bg-[#0b1916] ${
        onClick ? "cursor-pointer hover:border-emerald-400/30" : ""
      }`}
    >

      <div className="flex items-start justify-between">

        <div>

          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {title}
          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {value}
          </div>

          <div className="mt-2 text-[10px] text-slate-500">
            {description}
          </div>

        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${colors[color]}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =============================================================
   QUICK ACTION
============================================================= */

function QuickAction({
  title,
  description,
  color,
  onClick,
  icon,
}) {
  const colors = {
    emerald:
      "border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-400",

    teal:
      "border-teal-400/10 bg-teal-400/[0.05] text-teal-400",

    cyan:
      "border-cyan-400/10 bg-cyan-400/[0.05] text-cyan-400",

    violet:
      "border-violet-400/10 bg-violet-400/[0.05] text-violet-400",

    amber:
      "border-amber-400/10 bg-amber-400/[0.05] text-amber-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition duration-200 hover:border-emerald-400/20 hover:bg-emerald-400/[0.025]"
    >

      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[color]}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">

        <div className="text-xs font-semibold text-slate-200">
          {title}
        </div>

        <div className="mt-1 text-[10px] leading-4 text-slate-500">
          {description}
        </div>

      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 text-slate-600 transition group-hover:text-emerald-400"
      >
        <path
          d="M9 18L15 12L9 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

    </button>
  );
}

/* =============================================================
   BANKING MODULE CARD
============================================================= */

function ModuleCard({
  title,
  description,
  label,
  color,
  icon,
}) {
  const colors = {
    emerald: {
      icon: "bg-emerald-400/[0.06] text-emerald-400",
      label: "text-emerald-400",
      hover: "hover:border-emerald-400/20",
    },

    cyan: {
      icon: "bg-cyan-400/[0.06] text-cyan-400",
      label: "text-cyan-400",
      hover: "hover:border-cyan-400/20",
    },

    violet: {
      icon: "bg-violet-400/[0.06] text-violet-400",
      label: "text-violet-400",
      hover: "hover:border-violet-400/20",
    },

    amber: {
      icon: "bg-amber-400/[0.06] text-amber-400",
      label: "text-amber-400",
      hover: "hover:border-amber-400/20",
    },
  };

  return (
    <div
      className={`group rounded-2xl border border-white/[0.06] bg-[#0a1714]/70 p-5 transition duration-200 ${colors[color].hover}`}
    >

      <div className="flex items-start justify-between">

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color].icon}`}
        >
          {icon}
        </div>

        <span
          className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${colors[color].label}`}
        >
          {label}
        </span>

      </div>

      <h3 className="mt-6 text-sm font-semibold text-slate-200">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition group-hover:text-slate-400">

        <span>Open Module</span>

        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M9 18L15 12L9 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

      </div>

    </div>
  );
}

/* =============================================================
   PIPELINE STEP
============================================================= */

function PipelineStep({
  number,
  title,
  description,
  active = false,
}) {
  return (
    <div className="relative">

      <div
        className={`rounded-xl border p-4 ${
          active
            ? "border-emerald-400/20 bg-emerald-400/[0.045]"
            : "border-white/[0.06] bg-white/[0.015]"
        }`}
      >

        <div className="flex items-center gap-3">

          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold ${
              active
                ? "bg-emerald-400 text-[#04100d]"
                : "bg-white/[0.04] text-slate-500"
            }`}
          >
            {number}
          </div>

          <div>

            <div
              className={`text-xs font-semibold ${
                active ? "text-emerald-300" : "text-slate-300"
              }`}
            >
              {title}
            </div>

            <div className="mt-1 text-[9px] text-slate-600">
              {description}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default UserDashboard;