import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";
import { getCase } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";

export default function CaseReportsHub() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  const [caseData, setCaseData] = useState(null);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const loadCaseData = useCallback(async () => {
    if (!caseId) return;
    try {
      setIsLoading(true);
      setError("");
      const [caseRes, filesRes] = await Promise.all([
        getCase(caseId),
        getCaseFiles(caseId),
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
  }, [caseId]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Catalog of Available & Upcoming Reports for this Case
  const reportsList = [
    {
      id: "file-statement",
      title: "Bank Statement & Transactions Report",
      category: "statement",
      categoryLabel: "Statement Analysis",
      status: "available",
      isReady: true,
      route: `/dashboard/cases/${caseId}/reports/file-statement`,
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
  ];

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

  return (
    <div className="relative min-h-screen bg-[#020b09] text-white">
      {/* Background Glow */}
      <div className="pointer-events-none absolute -top-48 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-400/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute right-[-150px] top-[400px] h-[400px] w-[400px] rounded-full bg-emerald-400/[0.02] blur-3xl" />

      <div className="relative z-10">
        <BASNavbar />

        <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
          {/* Breadcrumbs & Back */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/cases/${caseId}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-300"
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
              Back to Case Details
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                onClick={() => navigate("/dashboard/cases")}
                className="cursor-pointer hover:text-white transition"
              >
                Cases
              </span>
              <span>/</span>
              <span
                onClick={() => navigate(`/dashboard/cases/${caseId}`)}
                className="cursor-pointer hover:text-white transition"
              >
                {caseData?.case_number || `Case #${caseId}`}
              </span>
              <span>/</span>
              <span className="font-semibold text-emerald-400">Reports Center</span>
            </div>
          </div>

          {/* Page Header */}
          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <span className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">
                  CASE INVESTIGATION REPORTS
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Reports &amp; Analytics Center
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {caseData ? (
                  <>
                    Case:{" "}
                    <span className="font-semibold text-white">
                      {caseData.case_name}
                    </span>{" "}
                    ({caseData.case_number}) &bull; Select a report below to inspect
                    in-depth statements, transactional flows, and forensic insights.
                  </>
                ) : (
                  "Select a report to analyze bank statements and investigation data."
                )}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#061411] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Uploaded Statements
                </p>
                <p className="mt-0.5 text-base font-bold text-white">
                  {files.length} {files.length === 1 ? "File" : "Files"}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                  Active Report
                </p>
                <p className="mt-0.5 text-base font-bold text-emerald-300">
                  1 Available
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/[0.08] bg-[#061411] p-4">
            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-black shadow-md shadow-emerald-400/20">
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
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
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

          {/* Reports Grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 max-w-4xl">
            {filteredReports.map((report, index) => {
              const isFirstReport = report.id === "file-statement";

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
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-5 text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {report.title}
                    </h3>

                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {report.description}
                    </p>

                    {/* Features pill list */}
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
                                report.isReady ? "text-emerald-400" : "text-slate-500"
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
                        onClick={() => navigate(report.route)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300 transition"
                      >
                        <span>Open Report</span>
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
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                      >
                        <span>Pipeline Stage</span>
                        <span className="text-[10px] text-slate-600">(Next Phase)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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
                Clear search &amp; show all reports
              </button>
            </div>
          )}
        </main>

        <BASFooter />
      </div>
    </div>
  );
}
