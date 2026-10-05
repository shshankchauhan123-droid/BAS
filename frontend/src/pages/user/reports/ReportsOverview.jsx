import React from "react";
import { useNavigate } from "react-router-dom";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

function ReportsOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const canViewReports =
    isSuperAdmin ||
    isClientAdmin ||
    user?.permissions?.can_view_reports !== false;

  return (
    <div className="min-h-screen bg-[#06100e] text-white flex flex-col justify-between">
      {/* Navbar */}
      <UserNavbar />

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden px-6 py-12 lg:px-12">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-10 h-72 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                BANK ANALYTICAL SYSTEM
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              Reports
            </h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Central analytical reports and case intelligence repository.
            </p>
          </div>

          {/* Clean Placeholder Card / Access Denied */}
          {!canViewReports ? (
            <div className="rounded-3xl border border-rose-500/20 bg-[#03100d]/90 p-12 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <line x1="15" y1="9" x2="9" y2="15" strokeWidth="1.5" />
                  <line x1="9" y1="9" x2="15" y2="15" strokeWidth="1.5" />
                </svg>
              </div>
              <h2 className="mt-6 text-xl font-bold text-white sm:text-2xl">
                Access Denied
              </h2>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed">
                You do not have permission to view analytical reports. Please contact your administrator.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/[0.08] bg-[#03100d]/90 p-12 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.12)]">
                <svg
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              <h2 className="mt-6 text-xl font-bold text-white sm:text-2xl">
                No Global Reports Available
              </h2>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed">
                Global and cross-case reports are currently under development. To view and filter file-wise transactions, please open a specific case and click <span className="text-emerald-400 font-semibold">&quot;View Case Report&quot;</span>.
              </p>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/cases")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-bold text-black transition hover:bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                >
                  <span>Go to Cases</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <UserFooter />
    </div>
  );
}

export default ReportsOverview;
