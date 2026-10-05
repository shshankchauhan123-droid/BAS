import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsers } from "../../services/api/user";
import { getCases } from "../../services/api/case";
import { getCaseFiles } from "../../services/api/file";

export default function AdminCaseReportSelector() {
  const navigate = useNavigate();

  // Data states
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [files, setFiles] = useState([]);

  // Selection states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("file-statement");

  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Error & Status
  const [error, setError] = useState("");

  const REPORT_OPTIONS = [
    {
      id: "dynamic-timeline-report",
      title: "Transaction Mode Wise Report",
      category: "Dynamic Visualizations",
      description:
        "Analyze transaction activity by payment mode/channel with interactive vertical bar charts, breakdown counts, and multi-axis metrics.",
      icon: (
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      buildRoute: (caseId, fileId) =>
        `/analysis?caseId=${encodeURIComponent(caseId)}${fileId ? `&fileId=${encodeURIComponent(fileId)}` : ""}`,
    },
    {
      id: "file-statement",
      title: "Bank Statement & Transactions Report",
      category: "Statement Analysis",
      description:
        "Comprehensive file-wise statement audit with debit/credit breakdown, balances, narration & reference search, and CSV/Print export.",
      icon: (
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      buildRoute: (caseId, fileId) =>
        `/dashboard/cases/${encodeURIComponent(caseId)}/reports/file-statement${fileId ? `?fileId=${encodeURIComponent(fileId)}` : ""}`,
    },
    {
      id: "transaction-relationships",
      title: "Transaction Flow / Relationship Report",
      category: "Advanced Analysis",
      description:
        "Interactive node-edge graph mapping financial transactions and monetary flows between statements and counterparties.",
      icon: (
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      buildRoute: (caseId, fileId) =>
        `/dashboard/cases/${encodeURIComponent(caseId)}/reports/transaction-relationships${fileId ? `?fileId=${encodeURIComponent(fileId)}` : ""}`,
    },
  ];

  // 1. Load users authorized for this Admin
  useEffect(() => {
    let isMounted = true;
    async function fetchUsers() {
      try {
        setLoadingUsers(true);
        setError("");
        const res = await getUsers();
        const list = res?.users || res?.items || (Array.isArray(res) ? res : []);
        if (isMounted) {
          setUsers(list);
          if (list.length > 0) {
            setSelectedUserId(list[0].id.toString());
          }
        }
      } catch (err) {
        console.error("Failed to load users:", err);
        if (isMounted) setError("Failed to load company users.");
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load cases when selected user changes
  useEffect(() => {
    if (!selectedUserId) {
      setCases([]);
      setSelectedCaseId("");
      setFiles([]);
      setSelectedFileId("");
      return;
    }

    let isMounted = true;
    async function fetchUserCases() {
      try {
        setLoadingCases(true);
        setError("");
        const res = await getCases(selectedUserId);
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (isMounted) {
          setCases(list);
          if (list.length > 0) {
            setSelectedCaseId(list[0].id.toString());
          } else {
            setSelectedCaseId("");
            setFiles([]);
            setSelectedFileId("");
          }
        }
      } catch (err) {
        console.error("Failed to load cases for user:", err);
        if (isMounted) setError("Failed to load cases for selected user.");
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }

    fetchUserCases();
    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  // 3. Load files when selected case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileId("");
      return;
    }

    let isMounted = true;
    async function fetchCaseFiles() {
      try {
        setLoadingFiles(true);
        setError("");
        const res = await getCaseFiles(selectedCaseId);
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (isMounted) {
          setFiles(list);
          if (list.length > 0) {
            setSelectedFileId(list[0].id.toString());
          } else {
            setSelectedFileId("");
          }
        }
      } catch (err) {
        console.error("Failed to load case files:", err);
        if (isMounted) setError("Failed to load files for selected case.");
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }

    fetchCaseFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // Selected entities for display
  const selectedUser = users.find((u) => u.id.toString() === selectedUserId.toString());
  const selectedCase = cases.find((c) => c.id.toString() === selectedCaseId.toString());
  const selectedFile = files.find((f) => f.id.toString() === selectedFileId.toString());
  const selectedReport = REPORT_OPTIONS.find((r) => r.id === selectedReportId) || REPORT_OPTIONS[0];

  // Navigate to existing report
  const handleLaunchReport = () => {
    if (!selectedCaseId) {
      setError("Please select a case before viewing the report.");
      return;
    }
    const targetRoute = selectedReport.buildRoute(selectedCaseId, selectedFileId);
    navigate(targetRoute);
  };

  // Open Full Case Reports Hub
  const handleOpenHub = () => {
    if (!selectedCaseId) {
      setError("Please select a case to view all reports.");
      return;
    }
    navigate(`/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports`);
  };

  const isFileReady = selectedFile?.status?.toUpperCase() === "COMPLETED";

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-emerald-400/20 bg-[#061411] p-6 shadow-xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Admin Reporting Control
            </div>
            <h2 className="mt-1 text-2xl font-bold text-white">
              View Case Report
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a User, Case, and File to view or generate existing banking analytical reports.
            </p>
          </div>

          {selectedCaseId && (
            <button
              type="button"
              onClick={handleOpenHub}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-400 hover:text-black cursor-pointer shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Open Case Reports Hub
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Cascading Selector Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* STEP 1: Select User */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#071512] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <label
              htmlFor="admin-select-user"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
            >
              1. Select User
            </label>
            {loadingUsers && (
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
            )}
          </div>

          <div className="relative mt-2.5">
            <select
              id="admin-select-user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loadingUsers || users.length === 0}
              className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-50"
            >
              {users.length === 0 ? (
                <option value="">No users found</option>
              ) : (
                users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#061411] text-white">
                    {u.username} ({u.email})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-400 truncate">
            {selectedUser ? (
              <span>Role: <strong className="text-emerald-300 uppercase">{selectedUser.role}</strong></span>
            ) : (
              "Choose an authorized user"
            )}
          </div>
        </div>

        {/* STEP 2: Select Case */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#071512] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <label
              htmlFor="admin-select-case"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
            >
              2. Select Case
            </label>
            {loadingCases && (
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
            )}
          </div>

          <div className="relative mt-2.5">
            <select
              id="admin-select-case"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={loadingCases || cases.length === 0}
              className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-50"
            >
              {cases.length === 0 ? (
                <option value="">No cases for this user</option>
              ) : (
                cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#061411] text-white">
                    {c.case_name || c.case_number || "Untitled Case"}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-400 truncate">
            {selectedCase ? (
              <span>Case #: <strong className="text-emerald-300">{selectedCase.case_number}</strong></span>
            ) : (
              "No active case selected"
            )}
          </div>
        </div>

        {/* STEP 3: Select File */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#071512] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <label
              htmlFor="admin-select-file"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
            >
              3. Select File
            </label>
            {loadingFiles && (
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
            )}
          </div>

          <div className="relative mt-2.5">
            <select
              id="admin-select-file"
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              disabled={loadingFiles || files.length === 0}
              className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-50"
            >
              {files.length === 0 ? (
                <option value="">No files uploaded in case</option>
              ) : (
                files.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#061411] text-white">
                    {f.original_filename} ({f.bank_name || "Statement"})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Status:</span>
            {selectedFile ? (
              <span
                className={`font-semibold uppercase tracking-wider ${
                  isFileReady ? "text-emerald-300" : "text-amber-400"
                }`}
              >
                {selectedFile.status || "UPLOADING"}
              </span>
            ) : (
              <span className="text-slate-500">None</span>
            )}
          </div>
        </div>

        {/* STEP 4: Select Report */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#071512] p-5 shadow-lg">
          <label
            htmlFor="admin-select-report"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
          >
            4. Select Report
          </label>

          <div className="relative mt-2.5">
            <select
              id="admin-select-report"
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer"
            >
              {REPORT_OPTIONS.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#061411] text-white">
                  {r.title}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-400 truncate">
            Category: <strong className="text-emerald-300">{selectedReport.category}</strong>
          </div>
        </div>
      </div>

      {/* Selected Action Card & Report Preview Details */}
      <div className="rounded-2xl border border-emerald-400/25 bg-[#061411] p-6 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-md">
              {selectedReport.icon}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Ready to View
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {selectedReport.category}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white">
                {selectedReport.title}
              </h3>

              <p className="max-w-2xl text-xs text-slate-400 leading-relaxed">
                {selectedReport.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLaunchReport}
              disabled={!selectedCaseId}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Generate / View Report</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selected target summary badges */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
            Report Target:
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-slate-300">
            <span className="text-slate-500">User:</span>
            <strong>{selectedUser?.username || "None"}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-slate-300">
            <span className="text-slate-500">Case:</span>
            <strong>{selectedCase?.case_name || selectedCase?.case_number || "None"}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-slate-300">
            <span className="text-slate-500">File:</span>
            <strong>{selectedFile?.original_filename || "All / None"}</strong>
          </span>

          {selectedFile?.status && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              File Status: {selectedFile.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
