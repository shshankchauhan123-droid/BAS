import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsers } from "../../services/api/user";
import { getCases } from "../../services/api/case";
import { getCaseFiles } from "../../services/api/file";

export default function ClientAdminReportModal({ isOpen, onClose, onCaseSelect }) {
  const navigate = useNavigate();

  // Selection states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [selectedReportType, setSelectedReportType] = useState("file-statement");

  // Data lists
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [files, setFiles] = useState([]);

  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Error state
  const [error, setError] = useState("");

  const REPORT_TYPES = [
    { id: "file-statement", label: "Bank Statement & Transactions Report" },
    { id: "mode-wise", label: "Transaction Mode Wise Report" },
    { id: "relationships", label: "Transaction Flow / Relationship Report" },
    { id: "hub", label: "Case Reports Hub (Overview)" },
  ];

  // 1. Fetch Users belonging to logged-in Client Admin when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        setError("");
        const res = await getUsers();
        const userList = res?.users || res?.items || (Array.isArray(res) ? res : []);
        if (isMounted) {
          setUsers(userList);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
        if (isMounted) setError("Failed to load company users.");
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. Fetch Cases when User changes (Dependency: User -> Cases)
  useEffect(() => {
    if (!selectedUserId) {
      setCases([]);
      setSelectedCaseId("");
      setFiles([]);
      setSelectedFileId("");
      return;
    }

    let isMounted = true;
    async function loadCases() {
      try {
        setLoadingCases(true);
        setError("");
        const res = await getCases(selectedUserId);
        const caseList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (isMounted) {
          setCases(caseList);
        }
      } catch (err) {
        console.error("Failed to load cases for selected user:", err);
        if (isMounted) setError("Failed to load cases for the selected user.");
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }

    loadCases();
    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  // 3. Fetch Files when Case changes (Dependency: Case -> Files)
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileId("");
      return;
    }

    let isMounted = true;
    async function loadFiles() {
      try {
        setLoadingFiles(true);
        setError("");
        const res = await getCaseFiles(selectedCaseId);
        const fileList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (isMounted) {
          setFiles(fileList);
        }
      } catch (err) {
        console.error("Failed to load files for selected case:", err);
        if (isMounted) setError("Failed to load files for the selected case.");
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }

    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // Handle User selection change: clears Case and File selections
  const handleUserChange = (e) => {
    const val = e.target.value;
    setSelectedUserId(val);
    setSelectedCaseId("");
    setCases([]);
    setSelectedFileId("");
    setFiles([]);
  };

  // Handle Case selection change: clears File selection
  const handleCaseChange = (e) => {
    const val = e.target.value;
    setSelectedCaseId(val);
    setSelectedFileId("");
    setFiles([]);
  };

  // Reset modal state on close
  const handleClose = () => {
    setSelectedUserId("");
    setSelectedCaseId("");
    setSelectedFileId("");
    setCases([]);
    setFiles([]);
    setError("");
    onClose();
  };

  // 4. VIEW REPORT: Launch the existing report with selected User -> Case -> File
  const handleViewReport = () => {
    if (!selectedUserId || !selectedCaseId || !selectedFileId) {
      setError("Please select a User, Case, and File to view the report.");
      return;
    }

    if (onCaseSelect) {
      onCaseSelect(selectedCaseId);
    }

    handleClose();

    if (selectedReportType === "mode-wise") {
      navigate(`/analysis?caseId=${encodeURIComponent(selectedCaseId)}&fileId=${encodeURIComponent(selectedFileId)}`);
    } else if (selectedReportType === "relationships") {
      navigate(`/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports/transaction-relationships?fileId=${encodeURIComponent(selectedFileId)}`);
    } else if (selectedReportType === "hub") {
      navigate(`/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports`);
    } else {
      // Default: Bank Statement & Transactions Report
      navigate(`/dashboard/cases/${encodeURIComponent(selectedCaseId)}/reports/file-statement?fileId=${encodeURIComponent(selectedFileId)}`);
    }
  };

  if (!isOpen) return null;

  const isFormValid = Boolean(
    selectedUserId &&
    selectedCaseId &&
    selectedFileId &&
    !loadingUsers &&
    !loadingCases &&
    !loadingFiles
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl border border-emerald-400/30 bg-[#061411] p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.7)] text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                VIEW CASE REPORT
              </h3>
              <p className="text-xs text-slate-400">
                Select User → Case → File to open existing analytical report
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Flow Selection Steps */}
        <div className="mt-6 space-y-5">
          {/* STEP 1: SELECT USER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="modal-select-user" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                1. Select User
              </label>
              {loadingUsers && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                  Loading users...
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="modal-select-user"
                value={selectedUserId}
                onChange={handleUserChange}
                disabled={loadingUsers}
                className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-50"
              >
                <option value="">-- Choose a User --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#061411] text-white">
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* STEP 2: SELECT CASE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="modal-select-case" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Select Case
              </label>
              {loadingCases && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                  Loading cases...
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="modal-select-case"
                value={selectedCaseId}
                onChange={handleCaseChange}
                disabled={!selectedUserId || loadingCases}
                className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!selectedUserId
                    ? "-- Select User First --"
                    : loadingCases
                    ? "-- Loading Cases... --"
                    : cases.length === 0
                    ? "No cases found for this user"
                    : "-- Choose a Case --"}
                </option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#061411] text-white">
                    {c.case_name || c.case_number || "Untitled Case"} ({c.case_number})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* STEP 3: SELECT FILE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="modal-select-file" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                3. Select File
              </label>
              {loadingFiles && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                  Loading files...
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="modal-select-file"
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
                disabled={!selectedCaseId || loadingFiles}
                className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!selectedCaseId
                    ? "-- Select Case First --"
                    : loadingFiles
                    ? "-- Loading Files... --"
                    : files.length === 0
                    ? "No files uploaded for this case"
                    : "-- Choose a File --"}
                </option>
                {files.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#061411] text-white">
                    {f.original_filename} {f.bank_name ? `(${f.bank_name})` : ""} - {f.status}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* OPTIONAL: SELECT REPORT TYPE */}
          <div>
            <label htmlFor="modal-select-report-type" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              4. Report View
            </label>
            <div className="relative">
              <select
                id="modal-select-report-type"
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="w-full appearance-none rounded-xl border border-emerald-400/25 bg-[#020b09] px-3.5 py-2.5 pr-8 text-xs font-semibold text-white shadow-inner focus:border-emerald-400 focus:outline-none transition cursor-pointer"
              >
                {REPORT_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id} className="bg-[#061411] text-white">
                    {rt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-400 hover:border-white/20 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleViewReport}
            disabled={!isFormValid}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>VIEW REPORT</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
