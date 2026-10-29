import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { getCases, getCase } from "../../../services/api/case";
import {
  deleteNcrpFile,
  getCaseNcrpFiles,
  uploadNcrpFile,
} from "../../../services/api/ncrp";
import { getClients } from "../../../services/api/clients";
import { getUsers } from "../../../services/api/user";

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const ALLOWED_EXTENSIONS = ["xlsx", "xls"];
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
  if (!filename) return "";
  const parts = String(filename).split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase();
}

function isNcrpExcelFile(file) {
  if (!file?.name) return false;
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
}

function formatDate(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(isoStr);
  }
}

function formatCaseOption(c) {
  if (!c) return "";
  const name = c.case_name || `Case #${c.id}`;
  const num = c.case_number ? ` — ${c.case_number}` : "";
  const status = c.status ? ` (${String(c.status).toUpperCase()})` : "";
  return `${name}${num}${status}`;
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
// MAIN COMPONENT
// ============================================================

export default function NcrpStatementUpload() {
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

  // Step 2: Excel File Selection & Modes
  const [uploadMode, setUploadMode] = useState("files"); // 'files' | 'folder'
  const isFolderUploadSupported =
    typeof HTMLInputElement !== "undefined" &&
    "webkitdirectory" in HTMLInputElement.prototype;

  // Selected Files Queue: Array of { id, file, name, relativePath, size, status, error, result }
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileValidationError, setFileValidationError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Step 3: Upload & Import Execution State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    currentFileName: "",
  });
  const [batchSummary, setBatchSummary] = useState(null);
  const [activeResultFileId, setActiveResultFileId] = useState(null);

  // Historical NCRP files for the case
  const [caseNcrpFiles, setCaseNcrpFiles] = useState([]);
  const [loadingNcrpFiles, setLoadingNcrpFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);

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

  const fetchCaseNcrpFiles = useCallback(async (caseId) => {
    if (!caseId) {
      setCaseNcrpFiles([]);
      return [];
    }
    setLoadingNcrpFiles(true);
    try {
      const res = await getCaseNcrpFiles(caseId);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setCaseNcrpFiles(list);
      return list;
    } catch (err) {
      console.error("Failed to load case NCRP files:", err);
      return [];
    } finally {
      setLoadingNcrpFiles(false);
    }
  }, []);

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
                  fetchCaseNcrpFiles(targetCase.id);
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
            fetchCaseNcrpFiles(found.id);
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
            fetchCaseNcrpFiles(found.id);
          }
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, isClientAdmin, canViewCases, searchParams, fetchCaseNcrpFiles]);

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

    setCaseNcrpFiles([]);
    setSelectedFiles([]);
    setBatchSummary(null);
    setActiveResultFileId(null);
    setUploadError("");
    setFileValidationError("");
    setSelectionNotice("");
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";

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

    setCaseNcrpFiles([]);
    setSelectedFiles([]);
    setBatchSummary(null);
    setActiveResultFileId(null);
    setUploadError("");
    setFileValidationError("");
    setSelectionNotice("");
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";

    const activeClientId =
      selectedClientId || (user?.client_id ? String(user.client_id) : null);
    if (val) {
      fetchCasesForScope(val, activeClientId);
    } else if (isClientAdmin) {
      fetchCasesForScope(null, activeClientId);
    }
  };

  const handleCaseChange = (e) => {
    const newCaseId = e.target.value;
    setUploadError("");
    setFileValidationError("");
    setSelectionNotice("");
    setSelectedFiles([]);
    setBatchSummary(null);
    setActiveResultFileId(null);
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";

    if (!newCaseId) {
      setSelectedCaseId("");
      setSelectedCase(null);
      setCaseNcrpFiles([]);
      return;
    }

    const matched = cases.find((c) => String(c.id) === String(newCaseId));
    if (matched) {
      setSelectedCaseId(String(matched.id));
      setSelectedCase(matched);
      fetchCaseNcrpFiles(matched.id);
    } else {
      setSelectedCaseId("");
      setSelectedCase(null);
      setCaseNcrpFiles([]);
    }
  };

  const handleClearCase = () => {
    setSelectedCaseId("");
    setSelectedCase(null);
    setSelectedFiles([]);
    setBatchSummary(null);
    setActiveResultFileId(null);
    setUploadError("");
    setFileValidationError("");
    setSelectionNotice("");
    setCaseNcrpFiles([]);
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  // ------------------------------------------------------------
  // FILE BATCH PROCESSING & VALIDATION
  // ------------------------------------------------------------
  const processIncomingFiles = useCallback((rawFiles) => {
    setFileValidationError("");
    setSelectionNotice("");
    setUploadError("");

    if (!rawFiles || rawFiles.length === 0) {
      return;
    }

    const filesArray = Array.from(rawFiles);
    let nonExcelCount = 0;
    let oversizedCount = 0;
    let duplicateCount = 0;
    let newlyAddedCount = 0;

    setSelectedFiles((prevFiles) => {
      const existingKeys = new Set(
        prevFiles.map(
          (item) => `${item.relativePath || item.name}::${item.size}`
        )
      );
      const batchKeys = new Set();
      const validItems = [];

      for (const file of filesArray) {
        const ext = getFileExtension(file.name);
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          nonExcelCount++;
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          oversizedCount++;
          continue;
        }

        const relPath = file.webkitRelativePath || file.name;
        const key = `${relPath}::${file.size}`;

        if (existingKeys.has(key) || batchKeys.has(key)) {
          duplicateCount++;
          continue;
        }

        batchKeys.add(key);
        validItems.push({
          id: `${relPath}_${file.size}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          file,
          name: file.name,
          relativePath: relPath,
          size: file.size,
          status: "pending",
          error: null,
          result: null,
        });
      }

      newlyAddedCount = validItems.length;

      // Construct notification messages
      const notices = [];
      if (nonExcelCount > 0) {
        notices.push(
          `${nonExcelCount} non-Excel file${
            nonExcelCount > 1 ? "s were" : " was"
          } skipped (only .xlsx and .xls allowed).`
        );
      }
      if (oversizedCount > 0) {
        notices.push(
          `${oversizedCount} file${
            oversizedCount > 1 ? "s" : ""
          } exceeded the 100 MB limit and ${
            oversizedCount > 1 ? "were" : "was"
          } skipped.`
        );
      }
      if (duplicateCount > 0) {
        notices.push(
          `${duplicateCount} duplicate file${
            duplicateCount > 1 ? "s were" : " was"
          } ignored.`
        );
      }

      if (notices.length > 0) {
        setSelectionNotice(notices.join(" "));
      }

      if (validItems.length === 0 && prevFiles.length === 0) {
        if (nonExcelCount > 0 && oversizedCount === 0 && duplicateCount === 0) {
          setFileValidationError(
            `No valid Excel workbooks found in selection. Only .xlsx and .xls files are supported.`
          );
        } else if (oversizedCount > 0) {
          setFileValidationError(
            `Selected file(s) exceeded the 100 MB maximum size limit.`
          );
        } else if (duplicateCount > 0) {
          setFileValidationError(`Selected file(s) are already in your queue.`);
        } else {
          setFileValidationError(`No supported Excel files found.`);
        }
        return prevFiles;
      }

      return [...prevFiles, ...validItems];
    });
  }, []);

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
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processIncomingFiles(files);
    }
  };

  const handleRemoveFile = (fileId) => {
    if (isUploading) return;
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setFileValidationError("");
  };

  const handleClearAllFiles = () => {
    if (isUploading) return;
    setSelectedFiles([]);
    setFileValidationError("");
    setSelectionNotice("");
    setUploadError("");
    setBatchSummary(null);
    setActiveResultFileId(null);
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  // ------------------------------------------------------------
  // UPLOAD & IMPORT BATCH EXECUTION
  // ------------------------------------------------------------
  const executeUploadBatch = async (filesToProcess) => {
    if (!selectedCaseId || !selectedCase) {
      setUploadError("Please select an investigation case first.");
      return;
    }

    if (!filesToProcess || filesToProcess.length === 0) {
      setUploadError("Please choose one or more NCRP Excel workbooks (.xlsx or .xls).");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setSelectionNotice("");

    const total = filesToProcess.length;
    let completed = 0;
    let failed = 0;
    let totalImportedRows = 0;

    setUploadProgress({
      total,
      completed: 0,
      failed: 0,
      currentIndex: 0,
      currentFileName: filesToProcess[0]?.name || "",
    });

    // Process files sequentially to maintain transaction integrity and avoid overwhelming the server
    for (let i = 0; i < filesToProcess.length; i++) {
      const currentItem = filesToProcess[i];

      // Update item status to 'uploading'
      setSelectedFiles((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, status: "uploading", error: null }
            : item
        )
      );

      setUploadProgress({
        total,
        completed,
        failed,
        currentIndex: i,
        currentFileName: currentItem.name,
      });

      try {
        // Mark as processing while backend parses worksheets & inserts rows
        setSelectedFiles((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, status: "processing" }
              : item
          )
        );

        const response = await uploadNcrpFile(selectedCaseId, currentItem.file, {
          clientId: selectedClientId || selectedCase?.client_id,
          userId: selectedUserId || selectedCase?.assigned_to || selectedCase?.created_by,
        });
        const data = response?.data || response;

        completed += 1;
        totalImportedRows += Number(data?.imported_rows || 0);

        setSelectedFiles((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, status: "completed", result: data, error: null }
              : item
          )
        );

        setActiveResultFileId(currentItem.id);
      } catch (err) {
        failed += 1;
        console.error(`Failed to upload ${currentItem.name}:`, err);
        const detail =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to import NCRP workbook. Please verify the file and try again.";

        setSelectedFiles((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, status: "failed", error: detail }
              : item
          )
        );
      }

      setUploadProgress({
        total,
        completed,
        failed,
        currentIndex: i + 1,
        currentFileName:
          i + 1 < filesToProcess.length
            ? filesToProcess[i + 1].name
            : currentItem.name,
      });
    }

    setIsUploading(false);

    // Refresh historical NCRP files for this case
    if (selectedCaseId) {
      fetchCaseNcrpFiles(selectedCaseId);
    }

    // Set batch summary
    setBatchSummary({
      total,
      succeeded: completed,
      failed,
      totalRows: totalImportedRows,
    });

    if (failed > 0 && completed === 0) {
      setUploadError(
        `Failed to import ${failed} file${
          failed > 1 ? "s" : ""
        }. Please review the errors below and retry.`
      );
    }
  };

  const handleUploadSubmit = () => {
    const pendingItems = selectedFiles.filter(
      (f) => f.status === "pending" || f.status === "failed"
    );
    if (pendingItems.length === 0) {
      setUploadError("Please choose one or more NCRP Excel workbooks (.xlsx or .xls).");
      return;
    }
    executeUploadBatch(pendingItems);
  };

  const handleRetryFailedFiles = () => {
    const failedItems = selectedFiles.filter((f) => f.status === "failed");
    if (failedItems.length === 0) return;
    executeUploadBatch(failedItems);
  };

  // ------------------------------------------------------------
  // DELETE FILE HANDLER
  // ------------------------------------------------------------
  const handleDeleteNcrpFile = async (fileId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this NCRP file and all its imported transaction records?"
      )
    ) {
      return;
    }

    setDeletingFileId(fileId);
    try {
      await deleteNcrpFile(fileId);
      setCaseNcrpFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error("Failed to delete NCRP file:", err);
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to delete NCRP file."
      );
    } finally {
      setDeletingFileId(null);
    }
  };

  const totalSelectedBytes = selectedFiles.reduce(
    (acc, f) => acc + (f.size || 0),
    0
  );
  const pendingCount = selectedFiles.filter((f) => f.status === "pending").length;
  const failedCount = selectedFiles.filter((f) => f.status === "failed").length;
  const completedCount = selectedFiles.filter((f) => f.status === "completed").length;
  const activeCompletedFile =
    selectedFiles.find((f) => f.id === activeResultFileId && f.result) ||
    selectedFiles.find((f) => f.status === "completed" && f.result) ||
    null;

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
                    NCRP Statement
                  </span>
                </nav>

                <h1 className="mt-1.5 text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">
                  Upload NCRP Statement
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Select an investigation case and upload National Cybercrime
                  Reporting Portal (NCRP) Excel workbooks (.xlsx, .xls) for
                  automated multi-sheet transaction ingestion.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/upload/bank-statement")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-950"
                >
                  Bank Statement Upload
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-950"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* WORKFLOW CONTAINER */}
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          {/* STEPPING PROGRESS BAR */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* STEP 1 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                selectedCase
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  selectedCase
                    ? "bg-emerald-600 text-white shadow-xs"
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
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Step 1
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  {selectedCase ? selectedCase.case_name : "Select Case"}
                </p>
              </div>
            </div>

            {/* STEP 2 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                selectedFiles.length > 0
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  selectedFiles.length > 0
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {selectedFiles.length > 0 ? (
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
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Step 2
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} Workbook${
                        selectedFiles.length > 1 ? "s" : ""
                      } Selected`
                    : "Choose NCRP Workbook(s)"}
                </p>
              </div>
            </div>

            {/* STEP 3 PILL */}
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition ${
                batchSummary
                  ? batchSummary.failed > 0
                    ? "border-amber-200 bg-amber-50/70"
                    : "border-emerald-200 bg-emerald-50/70"
                  : isUploading
                  ? "border-blue-200 bg-blue-50/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  batchSummary
                    ? batchSummary.failed > 0
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-emerald-600 text-white shadow-xs"
                    : isUploading
                    ? "bg-blue-600 text-white animate-pulse"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {batchSummary ? (
                  batchSummary.failed > 0 ? (
                    <span className="font-black text-xs">!</span>
                  ) : (
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
                  )
                ) : (
                  "3"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Step 3
                </p>
                <p className="truncate text-sm font-bold text-blue-950">
                  {batchSummary
                    ? `${batchSummary.succeeded} Ingested${
                        batchSummary.failed > 0
                          ? ` (${batchSummary.failed} Failed)`
                          : ""
                      }`
                    : isUploading
                    ? `Ingesting (${uploadProgress.completed + uploadProgress.failed}/${uploadProgress.total})...`
                    : "Upload & Ingest"}
                </p>
              </div>
            </div>
          </div>

          {/* MAIN UPLOAD GRID */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT COLUMN: STEP 1 & STEP 2 */}
            <div className="space-y-6 lg:col-span-7">
              {/* STEP 1: CASE SELECTION CARD */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  {cases.length > 0 && !loadingCases && (
                    <span className="text-xs font-semibold text-slate-400">
                      {cases.length} case{cases.length > 1 ? "s" : ""} available
                    </span>
                  )}
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
                              className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700 cursor-pointer"
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
                              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 cursor-pointer"
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
                              className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700 cursor-pointer"
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
                              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
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
                            className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 cursor-pointer"
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
                        Loading investigation cases...
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
                          className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-rose-700 cursor-pointer"
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
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800 cursor-pointer"
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
                          className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-blue-950 shadow-2xs transition focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 cursor-pointer"
                        >
                          <option value="">-- Choose an Investigation Case --</option>
                          {cases.map((c) => (
                            <option key={c.id} value={c.id}>
                              {formatCaseOption(c)}
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                            selectedCase.status
                          )}`}
                        >
                          {selectedCase.status || "ACTIVE"}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearCase}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-rose-600 transition cursor-pointer"
                          title="Clear selection"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* CONTEXTUAL SCOPING BADGES FOR SUPERADMIN / CLIENT ADMIN */}
                    {(isSuperAdmin || isClientAdmin) && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-emerald-100/70">
                        {(selectedClient || selectedCase.client?.name || selectedCase.client_name) && (
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
                          {caseNcrpFiles.length} NCRP statement{caseNcrpFiles.length === 1 ? "" : "s"}
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
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
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
              </section>

              {/* STEP 2: CHOOSE NCRP EXCEL FILE(S) OR FOLDER CARD */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Step 2
                  </span>
                  <h2 className="text-lg font-bold text-blue-950">
                    Choose NCRP Excel Workbook(s)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Upload single or multiple NCRP Excel workbooks (.xlsx, .xls) or select an entire folder for batch ingestion.
                  </p>
                </div>

                {/* MODE SELECTION TABS */}
                <div className="mt-4 grid grid-cols-2 gap-3 p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode("files");
                      setFileValidationError("");
                    }}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition cursor-pointer ${
                      uploadMode === "files"
                        ? "bg-white text-emerald-800 shadow-2xs"
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
                    Select Excel Files
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode("folder");
                      setFileValidationError("");
                    }}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition cursor-pointer ${
                      uploadMode === "folder"
                        ? "bg-white text-emerald-800 shadow-2xs"
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
                    Upload Folder
                  </button>
                </div>

                {/* HIDDEN INPUTS */}
                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processIncomingFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processIncomingFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                {/* BROWSER COMPATIBILITY NOTICE FOR FOLDER UPLOAD */}
                {uploadMode === "folder" && !isFolderUploadSupported && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-bold">Folder upload not supported by browser</p>
                    <p className="mt-0.5">
                      Your current browser does not support directory selection via <code>webkitdirectory</code>.
                      Please use the <strong>Select Excel Files</strong> tab to pick multiple files at once.
                    </p>
                  </div>
                )}

                {/* VALIDATION ERROR ALERT */}
                {fileValidationError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                    {fileValidationError}
                  </div>
                )}

                {/* SELECTION NOTICE (SKIPPED FILES, OVERSIZED, DUPLICATES) */}
                {selectionNotice && (
                  <div className="mt-4 flex items-start justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                        <line x1="12" y1="16" x2="12" y2="12" strokeWidth="2" />
                        <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2" />
                      </svg>
                      <span>{selectionNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectionNotice("")}
                      className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* DROP ZONE OR FILE QUEUE */}
                <div className="mt-4">
                  {!selectedCaseId ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-slate-400">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        Please select an investigation case in Step 1 to enable workbook upload.
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Workbooks must be associated with an active case.
                      </p>
                    </div>
                  ) : selectedFiles.length === 0 ? (
                    /* EMPTY DROP ZONE */
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => {
                        if (uploadMode === "folder" && isFolderUploadSupported) {
                          folderInputRef.current?.click();
                        } else {
                          filesInputRef.current?.click();
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
                        isDragOver
                          ? "border-emerald-500 bg-emerald-50/60"
                          : "border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-white"
                      }`}
                    >
                      {uploadMode === "folder" ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-xs">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-xs">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m2 5H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                          </svg>
                        </div>
                      )}

                      <p className="mt-3 text-sm font-bold text-blue-950">
                        {uploadMode === "folder"
                          ? "Drop NCRP folder here, or click to browse"
                          : "Drop NCRP Excel file(s) here, or click to browse"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm">
                        {uploadMode === "folder"
                          ? "Scans folder and nested subdirectories for supported .xlsx and .xls workbooks."
                          : "Select one or multiple .xlsx and .xls workbooks up to 100 MB each."}
                      </p>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            filesInputRef.current?.click();
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          Select Excel Files
                        </button>
                        {isFolderUploadSupported && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              folderInputRef.current?.click();
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            Upload Folder
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* POPULATED FILE QUEUE */
                    <div className="space-y-3">
                      {/* QUEUE HEADER BAR */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div>
                          <span className="text-xs font-bold text-blue-950">
                            {selectedFiles.length} Workbook{selectedFiles.length > 1 ? "s" : ""} Selected
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            • Combined size: {formatFileSize(totalSelectedBytes)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => filesInputRef.current?.click()}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                          >
                            + Add Files
                          </button>
                          {isFolderUploadSupported && (
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => folderInputRef.current?.click()}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                            >
                              + Add Folder
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={handleClearAllFiles}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* SCROLLABLE FILE LIST */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`max-h-72 overflow-y-auto space-y-2 rounded-xl border p-2 ${
                          isDragOver
                            ? "border-emerald-500 bg-emerald-50/30"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {selectedFiles.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (item.status === "completed") {
                                setActiveResultFileId(item.id);
                              }
                            }}
                            className={`flex flex-col gap-1 rounded-xl border p-2.5 text-xs transition ${
                              item.status === "completed"
                                ? activeResultFileId === item.id
                                  ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-500/20 cursor-pointer"
                                  : "border-emerald-200 bg-emerald-50/30 cursor-pointer hover:bg-emerald-50/50"
                                : item.status === "failed"
                                ? "border-rose-200 bg-rose-50/30"
                                : item.status === "uploading" || item.status === "processing"
                                ? "border-blue-200 bg-blue-50/30"
                                : "border-slate-200/80 bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-[10px] text-emerald-800 uppercase">
                                  {getFileExtension(item.name) || "XLS"}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-blue-950">
                                    {item.name}
                                  </p>
                                  {item.relativePath && item.relativePath !== item.name && (
                                    <p className="truncate font-mono text-[10px] text-slate-500">
                                      {item.relativePath}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-slate-500 font-mono text-[11px]">
                                  {formatFileSize(item.size)}
                                </span>

                                {/* STATUS PILL */}
                                {item.status === "pending" && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    Pending
                                  </span>
                                )}
                                {item.status === "uploading" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                    <span className="h-2 w-2 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                                    Uploading
                                  </span>
                                )}
                                {item.status === "processing" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 animate-pulse">
                                    <span className="h-2 w-2 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                                    Ingesting...
                                  </span>
                                )}
                                {item.status === "completed" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                    ✓ {item.result?.imported_rows ?? 0} rows
                                  </span>
                                )}
                                {item.status === "failed" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                    ✕ Failed
                                  </span>
                                )}

                                {/* REMOVE BUTTON */}
                                {!isUploading && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveFile(item.id);
                                    }}
                                    className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                    title="Remove this workbook"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* ERROR MESSAGE IF FAILED */}
                            {item.status === "failed" && item.error && (
                              <div className="mt-1 rounded-lg border border-rose-200 bg-rose-50/80 p-2 text-[11px] text-rose-700">
                                <span className="font-bold">Error:</span> {item.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBMIT & RETRY ACTION BUTTONS */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {failedCount > 0 && !isUploading && (
                      <button
                        type="button"
                        onClick={handleRetryFailedFiles}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Failed Files ({failedCount})
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selectedCaseId ||
                      selectedFiles.length === 0 ||
                      isUploading ||
                      (pendingCount === 0 && failedCount === 0)
                    }
                    onClick={handleUploadSubmit}
                    className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-sm transition cursor-pointer ${
                      !selectedCaseId ||
                      selectedFiles.length === 0 ||
                      isUploading ||
                      (pendingCount === 0 && failedCount === 0)
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-700 text-white hover:bg-emerald-800"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Ingesting ({uploadProgress.completed + uploadProgress.failed}/{uploadProgress.total})...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16.5v2.25A2.25 2.25 0 006.25 21h11.5A2.25 2.25 0 0020 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        Upload and Import NCRP ({pendingCount + failedCount > 0 ? pendingCount + failedCount : selectedFiles.length})
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: STEP 3 RESULTS & STATUS */}
            <div className="space-y-6 lg:col-span-5">
              {/* STATUS OR RESULTS CARD */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Step 3
                    </span>
                    <h2 className="text-lg font-bold text-blue-950">
                      Import Status & Worksheet Analysis
                    </h2>
                  </div>
                  {batchSummary && (
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                    >
                      Upload More Workbooks
                    </button>
                  )}
                </div>

                {uploadError && !isUploading && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 font-medium space-y-1">
                    <p className="font-bold text-red-900">Import Alert</p>
                    <p>{uploadError}</p>
                  </div>
                )}

                {/* UPLOADING & INGESTION IN-PROGRESS VIEW */}
                {isUploading && (
                  <div className="mt-6 py-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-blue-950">
                          Ingesting Workbooks ({uploadProgress.currentIndex} of {uploadProgress.total})
                        </h4>
                        <p className="truncate text-xs text-slate-500">
                          Current: {uploadProgress.currentFileName || "Processing workbook..."}
                        </p>
                      </div>
                    </div>

                    {/* OVERALL PROGRESS BAR */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>Overall Batch Progress</span>
                        <span>
                          {uploadProgress.total > 0
                            ? Math.round(
                                ((uploadProgress.completed + uploadProgress.failed) /
                                  uploadProgress.total) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-emerald-600 transition-all duration-300"
                          style={{
                            width: `${
                              uploadProgress.total > 0
                                ? Math.round(
                                    ((uploadProgress.completed + uploadProgress.failed) /
                                      uploadProgress.total) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-center text-xs text-slate-400">
                      Scanning worksheets, normalizing Indian bank headers, converting currencies, and inserting transactions atomically.
                    </p>
                  </div>
                )}

                {/* BATCH SUMMARY & RESULTS VIEW */}
                {batchSummary && (
                  <div className="mt-4 space-y-5">
                    {/* SUMMARY BANNER */}
                    <div
                      className={`rounded-xl border p-4 ${
                        batchSummary.failed === 0
                          ? "border-emerald-200 bg-emerald-50/80"
                          : batchSummary.succeeded > 0
                          ? "border-amber-200 bg-amber-50/80"
                          : "border-rose-200 bg-rose-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {batchSummary.failed === 0 ? (
                          <svg
                            className="h-5 w-5 text-emerald-700 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-amber-700 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
                          </svg>
                        )}
                        <p
                          className={`text-xs font-bold ${
                            batchSummary.failed === 0
                              ? "text-emerald-950"
                              : batchSummary.succeeded > 0
                              ? "text-amber-950"
                              : "text-rose-950"
                          }`}
                        >
                          {batchSummary.failed === 0
                            ? `Successfully imported all ${batchSummary.succeeded} workbook${
                                batchSummary.succeeded > 1 ? "s" : ""
                              } (${batchSummary.totalRows} transactions ingested).`
                            : batchSummary.succeeded > 0
                            ? `Batch completed: ${batchSummary.succeeded} succeeded, ${batchSummary.failed} failed (${batchSummary.totalRows} transactions ingested).`
                            : `Import failed for all ${batchSummary.failed} workbook${
                                batchSummary.failed > 1 ? "s" : ""
                              }. Review errors and retry.`}
                        </p>
                      </div>
                    </div>

                    {/* METRICS GRID */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Total Files
                        </p>
                        <p className="mt-1 text-xl font-black text-blue-950">
                          {batchSummary.total}
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Succeeded
                        </p>
                        <p className="mt-1 text-xl font-black text-emerald-700">
                          {batchSummary.succeeded}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Failed
                        </p>
                        <p
                          className={`mt-1 text-xl font-black ${
                            batchSummary.failed > 0 ? "text-rose-600" : "text-slate-600"
                          }`}
                        >
                          {batchSummary.failed}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Total Txns
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-700">
                          {batchSummary.totalRows}
                        </p>
                      </div>
                    </div>

                    {/* WORKSHEET BREAKDOWN FOR COMPLETED WORKBOOKS */}
                    {completedCount > 0 && activeCompletedFile?.result && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Worksheet Breakdown
                          </h4>
                          {completedCount > 1 && (
                            <select
                              value={activeCompletedFile.id}
                              onChange={(e) => setActiveResultFileId(e.target.value)}
                              className="text-xs font-bold text-emerald-800 bg-white border border-slate-200 rounded-lg px-2 py-1 cursor-pointer"
                            >
                              {selectedFiles
                                .filter((f) => f.status === "completed" && f.result)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name} ({f.result.imported_rows} txns)
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>

                        {/* ACTIVE FILE SUMMARY PILL */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs flex items-center justify-between">
                          <div className="truncate font-semibold text-slate-700">
                            {activeCompletedFile.name}
                          </div>
                          <span className="font-bold text-emerald-700">
                            {activeCompletedFile.result.sheet_count} worksheets • {activeCompletedFile.result.imported_rows} txns
                          </span>
                        </div>

                        {/* DISCOVERED WORKSHEETS LIST */}
                        {activeCompletedFile.result.sheets_summary &&
                          activeCompletedFile.result.sheets_summary.length > 0 && (
                            <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                              {activeCompletedFile.result.sheets_summary.map((sheet, idx) => (
                                <div
                                  key={sheet.sheet_name + idx}
                                  className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white p-2 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-bold text-blue-950">
                                      {sheet.sheet_name}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {sheet.imported_rows} imported / {sheet.total_rows} eligible rows
                                    </p>
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      sheet.failed_rows > 0
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {sheet.failed_rows > 0
                                      ? `${sheet.failed_rows} skipped`
                                      : "Clean"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* IDLE PLACEHOLDER */}
                {!isUploading && !batchSummary && !uploadError && (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <svg
                      className="mx-auto h-10 w-10 text-slate-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 3h6m2 5H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"
                      />
                    </svg>
                    Select an investigation case and choose NCRP workbook(s) or a folder to begin import.
                  </div>
                )}
              </section>

              {/* HISTORICAL NCRP FILES FOR THE CASE */}
              {selectedCaseId && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-blue-950">
                        NCRP Files for this Case
                      </h3>
                      <p className="text-xs text-slate-500">
                        Previously imported workbooks for Case #{selectedCase?.case_number}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {caseNcrpFiles.length}
                    </span>
                  </div>

                  <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                    {loadingNcrpFiles ? (
                      <p className="py-4 text-center text-xs text-slate-400">
                        Loading files...
                      </p>
                    ) : caseNcrpFiles.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">
                        No NCRP files uploaded for this case yet.
                      </p>
                    ) : (
                      caseNcrpFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs transition hover:border-slate-200 hover:bg-slate-100/60"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="truncate font-bold text-blue-950">
                              {f.original_filename}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {f.sheet_count} sheets • {f.imported_rows} txns • {formatDate(f.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                f.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : f.status === "PROCESSING"
                                  ? "bg-blue-100 text-blue-800 animate-pulse"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {f.status}
                            </span>
                            <button
                              type="button"
                              disabled={deletingFileId === f.id}
                              onClick={() => handleDeleteNcrpFile(f.id)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Delete NCRP File"
                            >
                              {deletingFileId === f.id ? (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-rose-600 border-t-transparent" />
                              ) : (
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
