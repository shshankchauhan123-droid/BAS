import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { getCases } from "../../../services/api/case";
import { uploadFile } from "../../../services/api/file";

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const ALLOWED_EXTENSIONS = [
  "pdf",
  "csv",
  "xlsx",
  "xls",
  "txt",
  "doc",
  "docx",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) {
    return "-";
  }
  const size = Number(bytes);
  if (size === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(size) / Math.log(1024));
  const safeIndex = Math.min(index, units.length - 1);
  const value = size / Math.pow(1024, safeIndex);

  return `${value.toFixed(safeIndex === 0 ? 0 : 2)} ${units[safeIndex]}`;
}

function getFileExtension(filename) {
  if (!filename) return "FILE";
  const parts = String(filename).split(".");
  if (parts.length < 2) return "FILE";
  return parts.pop().toLowerCase();
}

function isSupportedFile(file) {
  if (!file?.name) return false;
  const extension = getFileExtension(file.name).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(extension);
}

function getStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active" || normalized === "open" || normalized === "in_progress") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (normalized === "completed" || normalized === "closed") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  if (normalized === "archived") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

// ============================================================
// COMPONENT
// ============================================================

export default function BankStatementUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const canViewCases =
    isSuperAdmin || isClientAdmin || user?.permissions?.can_view_cases !== false;

  // Case Selection State
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(canViewCases);
  const [caseLoadError, setCaseLoadError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);

  // Upload Mode: 'single' | 'folder'
  const [uploadMode, setUploadMode] = useState("single");

  // Single File State
  const [singleFile, setSingleFile] = useState(null);
  const singleFileInputRef = useRef(null);

  // Folder Files State
  const [folderFiles, setFolderFiles] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const folderInputRef = useRef(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload Execution State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    completed: 0,
    total: 0,
    failed: 0,
    currentFileName: "",
  });
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccessResult, setUploadSuccessResult] = useState(null);

  // ------------------------------------------------------------
  // LOAD CASES
  // ------------------------------------------------------------
  const fetchCasesList = async () => {
    setLoadingCases(true);
    setCaseLoadError("");
    try {
      const response = await getCases();
      const list = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      setCases(list);
      return list;
    } catch (err) {
      console.error("Failed to load cases:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load cases from the server.";
      setCaseLoadError(typeof msg === "string" ? msg : "Failed to load cases.");
      return [];
    } finally {
      setLoadingCases(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!canViewCases) {
      return;
    }

    getCases()
      .then((response) => {
        if (!isMounted) return;
        const list = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
        setCases(list);

        const queryCaseId = searchParams.get("caseId");
        if (queryCaseId) {
          const found = list.find((c) => String(c.id) === String(queryCaseId));
          if (found) {
            setSelectedCaseId(String(found.id));
            setSelectedCase(found);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load cases:", err);
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load cases from the server.";
        setCaseLoadError(typeof msg === "string" ? msg : "Failed to load cases.");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingCases(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canViewCases, searchParams]);

  // Handle Dropdown Change
  const handleCaseChange = (e) => {
    const val = e.target.value;
    setSelectedCaseId(val);
    setUploadError("");
    setUploadSuccessResult(null);

    if (!val) {
      setSelectedCase(null);
      return;
    }

    const found = cases.find((c) => String(c.id) === String(val));
    setSelectedCase(found || null);
  };

  // ------------------------------------------------------------
  // SINGLE FILE HANDLERS
  // ------------------------------------------------------------
  const handleSingleFileSelect = (file) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`${file.name} exceeds the 100 MB maximum size limit.`);
      return;
    }

    if (!isSupportedFile(file)) {
      setUploadError(
        `${file.name} is not a supported bank statement format. Supported formats: PDF, Excel (.xlsx, .xls), CSV, TXT, DOC, DOCX.`
      );
      return;
    }

    setUploadError("");
    setUploadSuccessResult(null);
    setSingleFile(file);
  };

  const handleSingleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSingleFileSelect(file);
    }
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (uploadMode === "single") {
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleSingleFileSelect(file);
      }
    } else {
      // Folder or multiple files dropped
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length) {
        processFolderFiles(droppedFiles);
      }
    }
  };

  // ------------------------------------------------------------
  // FOLDER FILES HANDLERS
  // ------------------------------------------------------------
  const processFolderFiles = (files) => {
    const supported = [];
    let skipped = 0;

    for (const f of files) {
      if (isSupportedFile(f)) {
        supported.push(f);
      } else {
        skipped++;
      }
    }

    setSkippedCount(skipped);

    if (supported.length === 0) {
      setUploadError(
        "No supported bank statement files were found in the selected folder. Supported formats: PDF, Excel (.xlsx, .xls), CSV, TXT, DOC, DOCX."
      );
      setFolderFiles([]);
      return;
    }

    setUploadError("");
    setUploadSuccessResult(null);
    setFolderFiles(supported);
  };

  const handleFolderChange = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (rawFiles.length) {
      processFolderFiles(rawFiles);
    }
  };

  const handleRemoveFolderFile = (indexToRemove) => {
    setFolderFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // ------------------------------------------------------------
  // UPLOAD SUBMISSION
  // ------------------------------------------------------------
  const handleUploadSubmit = async () => {
    if (!selectedCaseId || !selectedCase) {
      setUploadError("Please select a target case first.");
      return;
    }

    const filesToUpload =
      uploadMode === "single"
        ? singleFile
          ? [singleFile]
          : []
        : folderFiles;

    if (filesToUpload.length === 0) {
      setUploadError("Please select at least one bank statement to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadSuccessResult(null);

    setUploadProgress({
      completed: 0,
      total: filesToUpload.length,
      failed: 0,
      currentFileName: filesToUpload[0].name,
    });

    let completed = 0;
    let failed = 0;
    const failedNames = [];

    // Process files sequentially to prevent server starvation
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadProgress((prev) => ({
        ...prev,
        currentFileName: file.name,
      }));

      try {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} exceeds the 100 MB file limit.`);
        }

        await uploadFile(selectedCaseId, file);
        completed += 1;
      } catch (err) {
        failed += 1;
        failedNames.push(file.name);
        console.error(`Failed to upload ${file.name}:`, err);
      }

      setUploadProgress({
        completed: completed + failed,
        total: filesToUpload.length,
        failed,
        currentFileName: file.name,
      });
    }

    setIsUploading(false);

    if (failed > 0 && completed === 0) {
      setUploadError(
        `Failed to upload ${failed} file(s). Please verify file formats and try again.`
      );
    } else {
      setUploadSuccessResult({
        totalUploaded: completed,
        failedCount: failed,
        failedNames,
        caseId: selectedCaseId,
        caseNumber: selectedCase.case_number,
        caseName: selectedCase.case_name,
      });

      // Clear files after successful submission
      if (uploadMode === "single") {
        setSingleFile(null);
      } else {
        setFolderFiles([]);
      }
    }
  };

  // Reset to upload more files
  const handleResetUpload = () => {
    setSingleFile(null);
    setFolderFiles([]);
    setSkippedCount(0);
    setUploadError("");
    setUploadSuccessResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <UserNavbar />

      <main className="flex-1 pb-16">
        {/* TOP ACCENT BAR & BREADCRUMB */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {/* BREADCRUMB */}
                <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Link
                    to="/dashboard"
                    className="hover:text-emerald-700 transition"
                  >
                    Dashboard
                  </Link>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-600">Upload</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-emerald-800 font-bold">
                    Bank Statement
                  </span>
                </nav>

                <h1 className="mt-1.5 text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">
                  Upload Bank Statements
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Select an investigation case and upload bank statements for
                  automated OCR, parsing, and forensic intelligence.
                </p>
              </div>

              {/* BACK TO DASHBOARD BUTTON */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-950"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN WORKFLOW CONTAINER */}
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          {/* STEPPING PROGRESS BAR */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* STEP 1 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                selectedCase
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  selectedCase
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {selectedCase ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  "1"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Step 1
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  Select Case
                </p>
              </div>
            </div>

            {/* STEP 2 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                singleFile || folderFiles.length > 0
                  ? "border-emerald-200 bg-emerald-50/60"
                  : selectedCase
                    ? "border-slate-300 bg-white"
                    : "border-slate-200 bg-slate-50/50 opacity-60"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  singleFile || folderFiles.length > 0
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {singleFile || folderFiles.length > 0 ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  "2"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Step 2
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  Choose Statements
                </p>
              </div>
            </div>

            {/* STEP 3 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                uploadSuccessResult
                  ? "border-emerald-200 bg-emerald-50/60"
                  : isUploading
                    ? "border-emerald-300 bg-emerald-50/30 animate-pulse"
                    : "border-slate-200 bg-slate-50/50 opacity-60"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  uploadSuccessResult
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {uploadSuccessResult ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  "3"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Step 3
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  Process & Ingest
                </p>
              </div>
            </div>
          </div>

          {/* SUCCESS BANNER */}
          {uploadSuccessResult && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/30 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-blue-950">
                      Upload Completed Successfully!
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-bold text-emerald-800">
                        {uploadSuccessResult.totalUploaded} bank statement file(s)
                      </span>{" "}
                      have been uploaded to case{" "}
                      <span className="font-bold text-blue-950">
                        {uploadSuccessResult.caseNumber}
                      </span>{" "}
                      ({uploadSuccessResult.caseName}).
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Background Celery workers have begun the 9-stage extraction,
                      OCR verification, and GLiNER counterparty intelligence pipeline.
                    </p>
                    {uploadSuccessResult.failedCount > 0 && (
                      <p className="mt-2 text-xs font-semibold text-rose-700">
                        Notice: {uploadSuccessResult.failedCount} file(s) failed
                        during upload:{" "}
                        {uploadSuccessResult.failedNames.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={handleResetUpload}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  >
                    Upload More Statements
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/dashboard/cases/${uploadSuccessResult.caseId}`)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
                  >
                    <span>View Case Documents</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MAIN FORM GRID */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT / TOP COLUMN: STEP 1 (SELECT CASE) */}
            <div className="lg:col-span-5 space-y-6">
              {/* STEP 1 CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                      1
                    </span>
                    <h2 className="text-base font-bold text-blue-950">
                      Select Target Case
                    </h2>
                  </div>
                  {cases.length > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {cases.length} cases available
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="case-selector"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2"
                  >
                    Investigation Case <span className="text-rose-500">*</span>
                  </label>

                  {loadingCases ? (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      Loading cases from server...
                    </div>
                  ) : caseLoadError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs font-bold text-rose-800">
                        Error loading cases
                      </p>
                      <p className="mt-1 text-xs text-rose-600">
                        {caseLoadError}
                      </p>
                      <button
                        type="button"
                        onClick={fetchCasesList}
                        className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                      >
                        Retry
                      </button>
                    </div>
                  ) : cases.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                      <p className="text-xs font-bold text-amber-900">
                        No cases found
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        You do not have any active cases to upload statements to.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard/cases/create")}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                      >
                        + Create New Case
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        id="case-selector"
                        value={selectedCaseId}
                        onChange={handleCaseChange}
                        disabled={isUploading}
                        className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">-- Choose an Investigation Case --</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.case_number ? `[${c.case_number}] ` : ""}
                            {c.case_name || `Case #${c.id}`}
                            {c.status ? ` (${c.status.toUpperCase()})` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* SELECTED CASE OVERVIEW CARD */}
                {selectedCase && (
                  <div className="mt-5 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-800">
                          SELECTED CASE
                        </span>
                        <h3 className="mt-2 text-base font-bold text-blue-950">
                          {selectedCase.case_name}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500">
                          Case No:{" "}
                          <span className="font-mono text-slate-800">
                            {selectedCase.case_number || "N/A"}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                          selectedCase.status
                        )}`}
                      >
                        {selectedCase.status || "ACTIVE"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-100/70 pt-3 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Assigned IO
                        </span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {selectedCase.io?.name || selectedCase.io_name || "Not assigned"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Created Date
                        </span>
                        <span className="font-semibold text-slate-800 block">
                          {selectedCase.created_at
                            ? new Date(selectedCase.created_at).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Link
                        to={`/dashboard/cases/${selectedCase.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition"
                      >
                        Open Case in New Tab
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* TIPS & SUPPORTED FORMATS CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Document Requirements
                </h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>
                      <strong className="text-slate-800">Supported Formats:</strong> PDF, Excel (.xlsx, .xls), CSV, TXT, DOC, DOCX.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>
                      <strong className="text-slate-800">File Size Limit:</strong> Up to 100 MB per statement file.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>
                      <strong className="text-slate-800">Scanned PDFs:</strong> Automatically routed through Tesseract OCR and OpenCV preprocessing.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>
                      <strong className="text-slate-800">AI Intelligence:</strong> Zero-shot GLiNER extracts counterparties into Person, Org, UPI, etc.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* RIGHT / MAIN COLUMN: STEPS 2 & 3 (FILES & SUBMISSION) */}
            <div className="lg:col-span-7 space-y-6">
              {/* STEP 2 CARD */}
              <div
                className={`rounded-2xl border bg-white p-6 shadow-sm transition ${
                  !selectedCase ? "opacity-60 pointer-events-none" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                      2
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-blue-950">
                        Choose Bank Statement Files
                      </h2>
                      <p className="text-xs text-slate-500">
                        Select a single statement or an entire folder of statements.
                      </p>
                    </div>
                  </div>
                </div>

                {/* MODE TABS (Single File vs Folder Upload) */}
                <div className="mt-5 grid grid-cols-2 gap-3 p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode("single");
                      setUploadError("");
                    }}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2.5 rounded-lg py-2.5 text-xs font-bold transition ${
                      uploadMode === "single"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-blue-950"
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    Single File
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode("folder");
                      setUploadError("");
                    }}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2.5 rounded-lg py-2.5 text-xs font-bold transition ${
                      uploadMode === "folder"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-blue-950"
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    Folder Upload
                  </button>
                </div>

                {/* HIDDEN INPUTS */}
                <input
                  type="file"
                  ref={singleFileInputRef}
                  onChange={handleSingleFileChange}
                  accept=".pdf,.csv,.xlsx,.xls,.txt,.doc,.docx"
                  className="hidden"
                />

                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderChange}
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                />

                {/* OPTION A: SINGLE FILE UPLOAD VIEW */}
                {uploadMode === "single" && (
                  <div className="mt-5">
                    {!singleFile ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => singleFileInputRef.current?.click()}
                        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                          isDragOver
                            ? "border-emerald-500 bg-emerald-50/60"
                            : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/20"
                        }`}
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100/70 text-emerald-700 shadow-2xs">
                          <svg
                            className="h-7 w-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16.5v2.25A2.25 2.25 0 006.25 21h11.5A2.25 2.25 0 0020 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V16.5"
                            />
                          </svg>
                        </div>
                        <p className="mt-4 text-sm font-bold text-blue-950">
                          Click to select a statement or drag & drop here
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Supports PDF, Excel (.xlsx, .xls), CSV, TXT, DOC, DOCX up to 100 MB
                        </p>
                        <button
                          type="button"
                          className="mt-4 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                        >
                          Browse Files
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase shadow-sm">
                              {getFileExtension(singleFile.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-blue-950">
                                {singleFile.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(singleFile.size)} • Ready for processing
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => singleFileInputRef.current?.click()}
                              disabled={isUploading}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => setSingleFile(null)}
                              disabled={isUploading}
                              aria-label="Remove selected file"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OPTION B: FOLDER UPLOAD VIEW */}
                {uploadMode === "folder" && (
                  <div className="mt-5">
                    {folderFiles.length === 0 ? (
                      <div
                        onClick={() => folderInputRef.current?.click()}
                        className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/20"
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100/70 text-emerald-700 shadow-2xs">
                          <svg
                            className="h-7 w-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                        </div>
                        <p className="mt-4 text-sm font-bold text-blue-950">
                          Click to select a statement folder
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Scans the folder and all nested subfolders for supported statements (.pdf, .xlsx, .csv, .txt)
                        </p>
                        <button
                          type="button"
                          className="mt-4 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                        >
                          Choose Folder
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-sm font-bold text-blue-950">
                              {folderFiles.length} Supported File(s) Detected
                            </span>
                            {skippedCount > 0 && (
                              <p className="text-xs text-amber-600 font-medium">
                                ({skippedCount} unsupported file(s) automatically excluded)
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => folderInputRef.current?.click()}
                              disabled={isUploading}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Choose Different Folder
                            </button>
                            <button
                              type="button"
                              onClick={() => setFolderFiles([])}
                              disabled={isUploading}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        {/* SCROLLABLE LIST OF FOLDER FILES */}
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {folderFiles.map((f, idx) => (
                            <div
                              key={`${f.name}-${idx}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-[10px] text-emerald-800 uppercase">
                                  {getFileExtension(f.name)}
                                </span>
                                <span className="truncate font-semibold text-slate-800">
                                  {f.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-slate-500 font-mono">
                                  {formatFileSize(f.size)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFolderFile(idx)}
                                  disabled={isUploading}
                                  aria-label={`Remove ${f.name}`}
                                  className="text-slate-400 hover:text-rose-600 transition"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 3: UPLOAD CONFIRMATION & EXECUTION CARD */}
              <div
                className={`rounded-2xl border bg-white p-6 shadow-sm transition ${
                  !selectedCase ||
                  (uploadMode === "single" && !singleFile) ||
                  (uploadMode === "folder" && folderFiles.length === 0)
                    ? "opacity-60 pointer-events-none"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                      3
                    </span>
                    <h2 className="text-base font-bold text-blue-950">
                      Submit and Process Statements
                    </h2>
                  </div>
                </div>

                {/* UPLOAD ERROR ALERT */}
                {uploadError && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-start gap-3">
                    <svg
                      className="h-5 w-5 shrink-0 text-rose-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>{uploadError}</div>
                  </div>
                )}

                {/* UPLOADING PROGRESS INDICATOR */}
                {isUploading && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2 text-emerald-900">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                        Uploading statement files to server...
                      </span>
                      <span className="font-mono text-emerald-800">
                        {uploadProgress.completed} / {uploadProgress.total}
                      </span>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{
                          width: `${
                            uploadProgress.total > 0
                              ? Math.min(
                                  100,
                                  (uploadProgress.completed /
                                    uploadProgress.total) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <p className="mt-2.5 truncate text-[11px] text-slate-600">
                      Processing: <span className="font-semibold">{uploadProgress.currentFileName}</span>
                    </p>
                  </div>
                )}

                {/* SUBMIT BUTTON */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">
                    {uploadMode === "single"
                      ? singleFile
                        ? `1 file selected (${formatFileSize(singleFile.size)})`
                        : "No file selected"
                      : `${folderFiles.length} file(s) selected`}
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={
                      !selectedCaseId ||
                      (uploadMode === "single" && !singleFile) ||
                      (uploadMode === "folder" && folderFiles.length === 0) ||
                      isUploading
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Uploading Files...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16.5v2.25A2.25 2.25 0 006.25 21h11.5A2.25 2.25 0 0020 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V16.5"
                          />
                        </svg>
                        <span>
                          {uploadMode === "single"
                            ? "Upload & Process Bank Statement"
                            : `Upload & Process ${folderFiles.length} Statements`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
