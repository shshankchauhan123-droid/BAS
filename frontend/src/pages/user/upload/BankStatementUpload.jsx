import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { getCases, getCase } from "../../../services/api/case";
import {
  uploadFile,
  getCaseFiles,
  getFileView,
  deleteFile,
} from "../../../services/api/file";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";

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

  // Client Selection State (SuperAdmin only)
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(isSuperAdmin);
  const [clientLoadError, setClientLoadError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  // User Selection State (SuperAdmin & ClientAdmin)
  const [clientUsers, setClientUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userLoadError, setUserLoadError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // Case Selection State
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(!isSuperAdmin && canViewCases);
  const [caseLoadError, setCaseLoadError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);

  // Scoped Document List State (Files for selectedCase)
  const [caseFiles, setCaseFiles] = useState([]);
  const [loadingCaseFiles, setLoadingCaseFiles] = useState(false);
  const [caseFilesError, setCaseFilesError] = useState("");
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [viewingFileId, setViewingFileId] = useState(null);

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
  // API LOADERS
  // ------------------------------------------------------------
  const fetchClientsList = async () => {
    setLoadingClients(true);
    setClientLoadError("");
    try {
      const response = await getClients();
      const list = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.clients)
          ? response.clients
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
      setClients(list);
      return list;
    } catch (err) {
      console.error("Failed to load clients:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load clients from the server.";
      setClientLoadError(typeof msg === "string" ? msg : "Failed to load clients.");
      return [];
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchUsersForClient = async (clientId) => {
    if (!clientId) {
      setClientUsers([]);
      return [];
    }
    setLoadingUsers(true);
    setUserLoadError("");
    try {
      const response = await getUsers(clientId);
      const list = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.users)
          ? response.users
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
      setClientUsers(list);
      return list;
    } catch (err) {
      console.error("Failed to load users for client:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load users for this client.";
      setUserLoadError(typeof msg === "string" ? msg : "Failed to load users.");
      return [];
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCasesForScope = async (userId = null, clientId = null) => {
    setLoadingCases(true);
    setCaseLoadError("");
    try {
      const response = await getCases(userId, clientId);
      const list = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.cases)
          ? response.cases
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

  const fetchCaseFiles = async (caseId) => {
    if (!caseId) {
      setCaseFiles([]);
      return [];
    }
    setLoadingCaseFiles(true);
    setCaseFilesError("");
    try {
      const response = await getCaseFiles(caseId, false, "BANK_STATEMENT");
      const list = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.files)
          ? response.files
          : Array.isArray(response)
            ? response
            : [];
      setCaseFiles(list);
      return list;
    } catch (err) {
      console.error("Failed to load case files:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load bank statement documents for this case.";
      setCaseFilesError(typeof msg === "string" ? msg : "Failed to load files.");
      return [];
    } finally {
      setLoadingCaseFiles(false);
    }
  };

  // ------------------------------------------------------------
  // INITIALIZATION EFFECT
  // ------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const queryCaseId = searchParams.get("caseId");

    const initialize = async () => {
      if (isSuperAdmin) {
        const clientList = await fetchClientsList();
        if (!isMounted) return;

        if (queryCaseId) {
          try {
            const caseRes = await getCase(queryCaseId);
            const targetCase = caseRes?.data || caseRes;
            if (targetCase && targetCase.id) {
              const matchedClientId = targetCase.client_id
                ? String(targetCase.client_id)
                : "";
              const matchedUserId = targetCase.assigned_to
                ? String(targetCase.assigned_to)
                : targetCase.created_by
                  ? String(targetCase.created_by)
                  : "";

              if (matchedClientId) {
                setSelectedClientId(matchedClientId);
                const foundClient = clientList.find(
                  (c) => String(c.id) === matchedClientId
                );
                setSelectedClient(foundClient || null);

                const uList = await fetchUsersForClient(matchedClientId);
                if (matchedUserId) {
                  setSelectedUserId(matchedUserId);
                  const foundUser = uList.find(
                    (u) => String(u.id) === matchedUserId
                  );
                  setSelectedUser(foundUser || null);

                  const cList = await fetchCasesForScope(
                    matchedUserId,
                    matchedClientId
                  );
                  const foundCase = cList.find(
                    (c) => String(c.id) === String(targetCase.id)
                  );
                  setSelectedCaseId(String(targetCase.id));
                  setSelectedCase(foundCase || targetCase);
                  fetchCaseFiles(targetCase.id);
                }
              }
            }
          } catch (e) {
            console.warn("Could not pre-populate from caseId parameter:", e);
          }
        }
      } else if (isClientAdmin) {
        // Client Admin: client is scoped to user.client_id
        const userClientId = user?.client_id ? String(user.client_id) : "";
        setSelectedClientId(userClientId);
        setSelectedClient({
          id: user?.client_id,
          name: user?.client_name || user?.company_code || "Your Organization",
          company_code: user?.company_code || "",
        });

        if (userClientId) {
          fetchUsersForClient(userClientId);
        }

        const caseList = await fetchCasesForScope(null, userClientId || null);
        if (!isMounted) return;

        if (queryCaseId) {
          const found = caseList.find((c) => String(c.id) === String(queryCaseId));
          if (found) {
            setSelectedCaseId(String(found.id));
            setSelectedCase(found);
            fetchCaseFiles(found.id);
          }
        }
      } else {
        // Regular User
        if (!canViewCases) return;
        const caseList = await fetchCasesForScope();
        if (!isMounted) return;

        if (queryCaseId) {
          const found = caseList.find((c) => String(c.id) === String(queryCaseId));
          if (found) {
            setSelectedCaseId(String(found.id));
            setSelectedCase(found);
            fetchCaseFiles(found.id);
          }
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, isClientAdmin, canViewCases, searchParams]);

  // ------------------------------------------------------------
  // DROPDOWN CHANGE HANDLERS
  // ------------------------------------------------------------
  const handleClientChange = (e) => {
    const val = e.target.value;
    setSelectedClientId(val);
    const clientObj = clients.find((c) => String(c.id) === String(val)) || null;
    setSelectedClient(clientObj);

    // Cascading reset
    setSelectedUserId("");
    setSelectedUser(null);
    setClientUsers([]);
    setUserLoadError("");

    setSelectedCaseId("");
    setSelectedCase(null);
    setCases([]);
    setCaseLoadError("");

    setCaseFiles([]);
    setCaseFilesError("");
    setUploadError("");
    setUploadSuccessResult(null);

    if (val) {
      fetchUsersForClient(val);
    }
  };

  const handleUserChange = (e) => {
    const val = e.target.value;
    setSelectedUserId(val);
    const userObj = clientUsers.find((u) => String(u.id) === String(val)) || null;
    setSelectedUser(userObj);

    // Cascading reset
    setSelectedCaseId("");
    setSelectedCase(null);
    setCases([]);
    setCaseLoadError("");

    setCaseFiles([]);
    setCaseFilesError("");
    setUploadError("");
    setUploadSuccessResult(null);

    const activeClientId =
      selectedClientId || (user?.client_id ? String(user.client_id) : null);
    if (val) {
      fetchCasesForScope(val, activeClientId);
    } else if (isClientAdmin) {
      // Client admin cleared user filter -> show all company cases
      fetchCasesForScope(null, activeClientId);
    }
  };

  const handleCaseChange = (e) => {
    const val = e.target.value;
    setSelectedCaseId(val);
    setUploadError("");
    setUploadSuccessResult(null);

    if (!val) {
      setSelectedCase(null);
      setCaseFiles([]);
      return;
    }

    const found = cases.find((c) => String(c.id) === String(val));
    setSelectedCase(found || null);
    fetchCaseFiles(val);
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

    const uploadOptions = {};
    if (selectedClientId) uploadOptions.clientId = selectedClientId;
    if (selectedUserId) uploadOptions.userId = selectedUserId;

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

        await uploadFile(selectedCaseId, file, "BANK_STATEMENT", uploadOptions);
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

    // Refresh scoped document list after upload
    if (selectedCaseId) {
      fetchCaseFiles(selectedCaseId);
    }

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

  // ------------------------------------------------------------
  // CASE FILE ACTIONS (VIEW, DOWNLOAD, DELETE)
  // ------------------------------------------------------------
  const handleViewOrDownloadFile = async (file, action = "download") => {
    setViewingFileId(file.id);
    try {
      const blob = await getFileView(file.id);
      const url = window.URL.createObjectURL(blob);
      if (action === "view") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.original_filename || `statement-${file.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error("Failed to access file:", err);
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to access the statement file."
      );
    } finally {
      setViewingFileId(null);
    }
  };

  const handleDeleteCaseFile = async (fileId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this bank statement? This will remove all associated transactions and analytics."
      )
    ) {
      return;
    }

    setDeletingFileId(fileId);
    try {
      await deleteFile(fileId);
      setCaseFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to delete the bank statement."
      );
    } finally {
      setDeletingFileId(null);
    }
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
                    <div>
                      <h2 className="text-base font-bold text-blue-950">
                        {isSuperAdmin
                          ? "Target Client, User & Case"
                          : isClientAdmin
                            ? "Organization Case Selection"
                            : "Select Target Case"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isSuperAdmin
                          ? "Cascading: Select Client → User → Investigation Case."
                          : isClientAdmin
                            ? "Select an investigator or case within your organization."
                            : "Choose an active investigation case for statement upload."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {/* ---------------- SUPER ADMIN CASCADING WORKFLOW ---------------- */}
                  {isSuperAdmin && (
                    <>
                      {/* STEP 1A: SELECT CLIENT */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="client-selector"
                            className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                          >
                            Step 1: Select Client <span className="text-rose-500">*</span>
                          </label>
                          {clients.length > 0 && (
                            <span className="text-[11px] font-semibold text-slate-400">
                              {clients.length} client{clients.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {loadingClients ? (
                          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                            Loading client companies...
                          </div>
                        ) : clientLoadError ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                            <p className="font-bold text-rose-800">Error loading clients</p>
                            <p className="mt-0.5 text-rose-600">{clientLoadError}</p>
                            <button
                              type="button"
                              onClick={fetchClientsList}
                              className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700"
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              id="client-selector"
                              value={selectedClientId}
                              onChange={handleClientChange}
                              disabled={isUploading}
                              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                              <option value="">-- Choose a Client Company --</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.company_code ? `(${c.company_code})` : ""}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* STEP 1B: SELECT USER */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="user-selector"
                            className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                          >
                            Step 2: Select User <span className="text-rose-500">*</span>
                          </label>
                          {selectedClientId && clientUsers.length > 0 && (
                            <span className="text-[11px] font-semibold text-slate-400">
                              {clientUsers.length} user{clientUsers.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {loadingUsers ? (
                          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                            Loading users for selected client...
                          </div>
                        ) : userLoadError ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                            <p className="font-bold text-rose-800">Error loading users</p>
                            <p className="mt-0.5 text-rose-600">{userLoadError}</p>
                            <button
                              type="button"
                              onClick={() => fetchUsersForClient(selectedClientId)}
                              className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700"
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              id="user-selector"
                              value={selectedUserId}
                              onChange={handleUserChange}
                              disabled={!selectedClientId || isUploading || loadingUsers}
                              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {!selectedClientId
                                  ? "-- Step 1: Select a Client First --"
                                  : clientUsers.length === 0
                                    ? "-- No Users Found for this Client --"
                                    : "-- Choose a User / Investigator --"}
                              </option>
                              {clientUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.username} ({u.email || "no email"}) — {String(u.role || "user").toUpperCase()}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ---------------- CLIENT ADMIN VIEW ---------------- */}
                  {isClientAdmin && (
                    <div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                            Client Organization
                          </span>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900">
                            {user?.company_code || "COMPANY"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-blue-950">
                          {user?.client_name || user?.company_code || "Your Organization"}
                        </p>
                      </div>

                      {/* Optional User Filter for Client Admin */}
                      <div className="mt-3">
                        <label
                          htmlFor="client-admin-user-filter"
                          className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                        >
                          Filter by User (Optional)
                        </label>
                        <div className="relative">
                          <select
                            id="client-admin-user-filter"
                            value={selectedUserId}
                            onChange={handleUserChange}
                            disabled={isUploading || loadingUsers}
                            className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <option value="">-- All Users in Organization --</option>
                            {clientUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.username} ({u.email || "no email"}) — {String(u.role || "user").toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------- CASE SELECTION (ALL ROLES) ---------------- */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="case-selector"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                      >
                        {isSuperAdmin
                          ? "Step 3: Select Investigation Case"
                          : "Select Investigation Case"}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      {cases.length > 0 && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          {cases.length} case{cases.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {loadingCases ? (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        Loading cases...
                      </div>
                    ) : caseLoadError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                        <p className="font-bold text-rose-800">Error loading cases</p>
                        <p className="mt-0.5 text-rose-600">{caseLoadError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            if (isSuperAdmin) {
                              fetchCasesForScope(selectedUserId, selectedClientId);
                            } else if (isClientAdmin) {
                              fetchCasesForScope(selectedUserId || null, user?.client_id);
                            } else {
                              fetchCasesForScope();
                            }
                          }}
                          className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700"
                        >
                          Retry
                        </button>
                      </div>
                    ) : isSuperAdmin && !selectedUserId ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 text-center">
                        Select a Client (Step 1) and User (Step 2) above to display available cases.
                      </div>
                    ) : cases.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                        <p className="text-xs font-bold text-amber-900">No cases found</p>
                        <p className="mt-1 text-xs text-amber-700">
                          {isSuperAdmin
                            ? "The selected user does not have any cases created or assigned."
                            : "No active cases found for this selection."}
                        </p>
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => navigate("/dashboard/cases/create")}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                          >
                            + Create New Case
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="case-selector"
                          value={selectedCaseId}
                          onChange={handleCaseChange}
                          disabled={isUploading}
                          className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
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

                    {/* CONTEXTUAL SCOPING BADGES FOR SUPERADMIN / CLIENT ADMIN */}
                    {(isSuperAdmin || isClientAdmin) && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-emerald-100/70">
                        {(selectedClient || selectedCase.client?.name) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            <strong className="text-slate-900">Client:</strong>{" "}
                            {selectedClient?.name || selectedCase.client?.name || selectedCase.client_name}
                          </span>
                        )}
                        {(selectedUser || selectedCase.creator?.username || selectedCase.assignee?.username) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            <strong className="text-slate-900">User:</strong>{" "}
                            {selectedUser?.username || selectedCase.assignee?.username || selectedCase.creator?.username}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {caseFiles.length} bank statement{caseFiles.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-emerald-100/70 pt-3 text-xs text-slate-600">
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

          {/* SCOPED DOCUMENTS TABLE (BANK STATEMENTS FOR THIS CASE) */}
          {selectedCaseId && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-blue-950">
                      Bank Statements for this Case
                    </h3>
                    <p className="text-xs text-slate-500">
                      Previously uploaded statements for case{" "}
                      <span className="font-semibold text-slate-800 font-mono">
                        {selectedCase?.case_number || `#${selectedCaseId}`}
                      </span>{" "}
                      ({selectedCase?.case_name || "Case"})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {caseFiles.length} Statement{caseFiles.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchCaseFiles(selectedCaseId)}
                    disabled={loadingCaseFiles}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-950 disabled:opacity-50"
                  >
                    <svg className={`h-3.5 w-3.5 ${loadingCaseFiles ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>

              {/* CONTENT */}
              <div className="mt-4">
                {loadingCaseFiles ? (
                  <div className="py-12 flex items-center justify-center gap-3 text-sm text-slate-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    Loading bank statements...
                  </div>
                ) : caseFilesError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs">
                    <p className="font-bold text-rose-800">Error loading case bank statements</p>
                    <p className="mt-1 text-rose-600">{caseFilesError}</p>
                    <button
                      type="button"
                      onClick={() => fetchCaseFiles(selectedCaseId)}
                      className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : caseFiles.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-8 text-center">
                    <svg className="mx-auto h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-bold text-slate-700">No bank statements uploaded yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Use Step 2 & 3 above to upload bank statements for this case.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">Document Name</th>
                          <th className="px-4 py-3">Size</th>
                          <th className="px-4 py-3">Upload Date</th>
                          <th className="px-4 py-3">Account Details</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                        {caseFiles.map((file) => {
                          const statusNorm = String(file.status || "QUEUED").toUpperCase();
                          const isCompleted = statusNorm === "COMPLETED";
                          const isProcessing = statusNorm === "PROCESSING" || statusNorm === "QUEUED";
                          const isFailed = statusNorm === "FAILED" || statusNorm === "ERROR";

                          return (
                            <tr key={file.id} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-[10px] text-emerald-800 uppercase">
                                    {getFileExtension(file.original_filename)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-bold text-blue-950 max-w-xs sm:max-w-md">
                                      {file.original_filename}
                                    </p>
                                    {file.is_merged && (
                                      <span className="inline-flex rounded-sm bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-700">
                                        MERGED
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                                {formatFileSize(file.file_size)}
                              </td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                {file.created_at ? new Date(file.created_at).toLocaleString() : "-"}
                              </td>
                              <td className="px-4 py-3">
                                {file.bank_name || file.account_number ? (
                                  <div>
                                    <p className="font-bold text-blue-950 truncate max-w-[200px]">
                                      {file.bank_name || "Bank Statement"}
                                    </p>
                                    <p className="font-mono text-[11px] text-slate-500">
                                      {file.account_number ? `A/C: ${file.account_number}` : "A/C: -"}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Processing details...</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    isCompleted
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isProcessing
                                        ? "bg-blue-100 text-blue-800 animate-pulse"
                                        : isFailed
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {isProcessing && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                                  )}
                                  {file.status || "QUEUED"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* View in new tab */}
                                  <button
                                    type="button"
                                    onClick={() => handleViewOrDownloadFile(file, "view")}
                                    disabled={viewingFileId === file.id}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-950 transition"
                                    title="View statement file"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>

                                  {/* Download */}
                                  <button
                                    type="button"
                                    onClick={() => handleViewOrDownloadFile(file, "download")}
                                    disabled={viewingFileId === file.id}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition"
                                    title="Download statement"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCaseFile(file.id)}
                                    disabled={deletingFileId === file.id}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                    title="Delete bank statement"
                                  >
                                    {deletingFileId === file.id ? (
                                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-rose-600 border-t-transparent" />
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
