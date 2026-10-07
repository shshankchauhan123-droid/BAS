import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getCase } from "../../../services/api/case";

import {
  getCaseFiles,
  uploadFile,
  getFileView,
  deleteFile,
  updateFileDetails,
} from "../../../services/api/file";

import {
  getFileTransactions,
  searchCaseTransactions,
} from "../../../services/api/bankTransaction";

import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

function CaseDetails() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();

  const canUploadFiles =
    user?.role === "superadmin" ||
    user?.role === "client_admin" ||
    user?.permissions?.can_upload_files !== false;

  const canDeleteFiles =
    user?.role === "superadmin" ||
    user?.role === "client_admin" ||
    user?.permissions?.can_delete_files !== false;

  const canViewReports =
    user?.role === "superadmin" ||
    user?.role === "client_admin" ||
    user?.permissions?.can_view_reports !== false;

  /*
   * ============================================================
   * CASE ID
   * ============================================================
   *
   * React Router returns route parameters as strings.
   *
   * Example:
   *
   * /dashboard/cases/5
   *
   * params.caseId === "5"
   *
   * We validate it before sending it to FastAPI.
   */

  const rawCaseId = params?.caseId;

  const caseId = useMemo(() => {
    if (
      rawCaseId === undefined ||
      rawCaseId === null ||
      rawCaseId === ""
    ) {
      return null;
    }

    /*
     * Never allow Promise/object values to reach the API.
     */
    if (
      typeof rawCaseId === "object" ||
      typeof rawCaseId === "function"
    ) {
      console.error(
        "Invalid caseId received from route:",
        rawCaseId
      );

      return null;
    }

    const parsedId = Number(rawCaseId);

    if (
      !Number.isInteger(parsedId) ||
      parsedId <= 0
    ) {
      console.error(
        "Invalid case ID:",
        rawCaseId
      );

      return null;
    }

    return parsedId;
  }, [rawCaseId]);

  // ============================================================
  // CASE STATE
  // ============================================================

  const [caseData, setCaseData] = useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] = useState("");

  // ============================================================
  // FILE STATE
  // ============================================================

  const [uploadedFiles, setUploadedFiles] =
    useState([]);
  const [expandedFileId, setExpandedFileId] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSavingFile, setIsSavingFile] = useState(false);


  const [isFilesLoading, setIsFilesLoading] =
    useState(true);

  const [filesError, setFilesError] =
    useState("");

  // ============================================================
// TRANSACTION STATE
// ============================================================
const [transactions, setTransactions] = useState([]);

  const [isTransactionsLoading, setIsTransactionsLoading] =
    useState(false);

  const [transactionsError, setTransactionsError] =
    useState("");

  const [selectedTransactionFileId, setSelectedTransactionFileId] =
    useState(null);

  // Transaction pagination
  const [transactionPage, setTransactionPage] =
    useState(1);

  const [transactionPageSize] =
    useState(50);

  const [transactionTotal, setTransactionTotal] =
    useState(0);

  const [transactionTotalPages, setTransactionTotalPages] =
    useState(0);

  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionDateFrom, setTransactionDateFrom] = useState("");
  const [transactionDateTo, setTransactionDateTo] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [transactionMinAmount, setTransactionMinAmount] = useState("");
  const [transactionMaxAmount, setTransactionMaxAmount] = useState("");


  const [selectedFile, setSelectedFile] =
    useState(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [uploadError, setUploadError] =
    useState("");

  const [isUploadTypeOpen, setIsUploadTypeOpen] =
    useState(false);

  const [isFolderUploading, setIsFolderUploading] =
    useState(false);

  const [folderUploadProgress, setFolderUploadProgress] =
    useState({
      completed: 0,
      total: 0,
      failed: 0,
    });

  const singleFileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [deletingFileId, setDeletingFileId] =
    useState(null);

  // ============================================================
  // PAGINATION
  // ============================================================

  const [currentPage, setCurrentPage] =
    useState(1);

  const FILES_PER_PAGE = 10;

  // ============================================================
  // ERROR MESSAGE HELPER
  // ============================================================

  function getErrorMessage(requestError, fallback) {
    if (!requestError) {
      return fallback;
    }

    /*
     * Some API clients return:
     *
     * error.response.data.detail
     *
     * Some return:
     *
     * error.detail
     *
     * Some return:
     *
     * error.message
     */

    const detail =
      requestError?.response?.data?.detail ??
      requestError?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          return (
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
          );
        })
        .join(", ");
    }

    if (
      detail &&
      typeof detail === "object"
    ) {
      return (
        detail.message ||
        JSON.stringify(detail)
      );
    }

    if (
      requestError?.message &&
      requestError.message !==
        "[object Object]"
    ) {
      return requestError.message;
    }

    return fallback;
  }

  // ============================================================
  // LOAD CASE
  // ============================================================

  const loadCase = useCallback(async () => {
    /*
     * Do not call backend if caseId is invalid.
     */

    if (!caseId) {
      setIsLoading(false);
      setCaseData(null);
      setError(
        "Invalid case ID. Please open the case again from the Cases page."
      );

      return;
    }

    try {
      setIsLoading(true);
      setError("");

      console.log(
        "Loading case with ID:",
        caseId,
        "Type:",
        typeof caseId
      );

      const response =
        await getCase(caseId);

      console.log(
        "GET case response:",
        response
      );

      const loadedCase =
        response?.data ?? null;

      if (!loadedCase) {
        throw new Error(
          "The server returned an empty case response."
        );
      }

      setCaseData(loadedCase);
    } catch (requestError) {
      console.error(
        "Failed to load case:",
        requestError
      );

      const message =
        getErrorMessage(
          requestError,
          "Unable to load this case."
        );

      setError(message);
      setCaseData(null);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  // ============================================================
  // LOAD FILES
  // ============================================================

  const loadFiles = useCallback(async () => {
    /*
     * Do not call backend if caseId is invalid.
     */

    if (!caseId) {
      setIsFilesLoading(false);
      setUploadedFiles([]);
      setFilesError(
        "Invalid case ID. Documents cannot be loaded."
      );

      return;
    }

    try {
      setIsFilesLoading(true);
      setFilesError("");

      console.log(
        "Loading files for case ID:",
        caseId,
        "Type:",
        typeof caseId
      );

      const response =
        await getCaseFiles(caseId);

      console.log(
        "GET case files response:",
        response
      );

      /*
       * Expected response:
       *
       * {
       *   success: true,
       *   message: "...",
       *   total: 2,
       *   data: [...]
       * }
       */

      const files = Array.isArray(
        response?.data
      )
        ? response.data
        : [];

      setUploadedFiles(files);

      /*
       * If current page is no longer valid,
       * return to page 1.
       */

      setCurrentPage((previousPage) => {
        const pages = Math.max(
          1,
          Math.ceil(
            files.length /
              FILES_PER_PAGE
          )
        );

        return Math.min(
          previousPage,
          pages
        );
      });
    } catch (requestError) {
      console.error(
        "Failed to load case files:",
        requestError
      );

      const message =
        getErrorMessage(
          requestError,
          "Unable to load documents."
        );

      setFilesError(message);
      setUploadedFiles([]);
    } finally {
      setIsFilesLoading(false);
    }
  }, [caseId]);

  // ============================================================
  // LOAD TRANSACTIONS
  // ============================================================

  const loadTransactions = useCallback(
    async (fileId, page = 1) => {
      if (!fileId) {
        setTransactions([]);
        setSelectedTransactionFileId(null);
        setTransactionTotal(0);
        setTransactionTotalPages(0);
        setTransactionsError("File ID is missing.");
        return;
      }

      try {
        setIsTransactionsLoading(true);
        setTransactionsError("");
        setSelectedTransactionFileId(fileId);
        setTransactionPage(page);

        console.log("Loading transactions:", {
          fileId,
          page,
          pageSize: transactionPageSize,
        });

        const response = await getFileTransactions(
          fileId,
          page,
          transactionPageSize
        );

        console.log(
          "GET file transactions response:",
          response
        );

        const loadedTransactions = Array.isArray(
          response?.data
        )
          ? response.data
          : [];

        setTransactions(loadedTransactions);
        setTransactionTotal(Number(response?.total || 0));
        setTransactionTotalPages(
          Number(response?.total_pages || 0)
        );
      } catch (requestError) {
        console.error(
          "Failed to load transactions:",
          requestError
        );

        setTransactions([]);
        setTransactionTotal(0);
        setTransactionTotalPages(0);
        setTransactionsError(
          getErrorMessage(
            requestError,
            "Unable to load transactions."
          )
        );
      } finally {
        setIsTransactionsLoading(false);
      }
    },
    [transactionPageSize]
  );

  const loadFilteredTransactions = useCallback(
  async (page = 1) => {
    if (!caseId) {
      setTransactions([]);
      setTransactionTotal(0);
      setTransactionTotalPages(0);
      setTransactionsError("Case ID is missing.");
      return;
    }

    try {
      setIsTransactionsLoading(true);
      setTransactionsError("");

      const response = await searchCaseTransactions(caseId, {
        search: transactionSearch,
        dateFrom: transactionDateFrom,
        dateTo: transactionDateTo,
        transactionType,
        minAmount: transactionMinAmount,
        maxAmount: transactionMaxAmount,
        page,
        pageSize: transactionPageSize,
      });

      console.log(
        "Filtered transactions response:",
        response
      );

      const loadedTransactions = Array.isArray(response?.data)
        ? response.data
        : [];

      setTransactions(loadedTransactions);
      setTransactionPage(Number(response?.page || page));
      setTransactionTotal(Number(response?.total || 0));
      setTransactionTotalPages(
        Number(response?.total_pages || 0)
      );
    } catch (requestError) {
      console.error(
        "Failed to load filtered transactions:",
        requestError
      );

      setTransactions([]);
      setTransactionTotal(0);
      setTransactionTotalPages(0);

      setTransactionsError(
        getErrorMessage(
          requestError,
          "Unable to load filtered transactions."
        )
      );
    } finally {
      setIsTransactionsLoading(false);
    }
  },
  [
    caseId,
    transactionSearch,
    transactionDateFrom,
    transactionDateTo,
    transactionType,
    transactionMinAmount,
    transactionMaxAmount,
    transactionPageSize,
  ]
);


function applyTransactionFilters() {
  loadFilteredTransactions(1);
}

function clearTransactionFilters() {
  setTransactionSearch("");
  setTransactionDateFrom("");
  setTransactionDateTo("");
  setTransactionType("");
  setTransactionMinAmount("");
  setTransactionMaxAmount("");

  setTimeout(() => {
    loadTransactions(
      selectedTransactionFileId,
      1
    );
  }, 0);
}

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
      setEditingFileId(null);
    } else {
      setExpandedFileId(fileId);
      setEditingFileId(null);
    }
  };

  const handleEditClick = (e, file) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditFormData({
      account_name: file.account_name || "",
      account_number: file.account_number || "",
      bank_name: file.bank_name || "",
      branch_name: file.branch_name || "",
      ifsc: file.ifsc || "",
      micr: file.micr || "",
      account_type: file.account_type || "",
      statement_start_date: file.statement_start_date || "",
      statement_end_date: file.statement_end_date || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingFileId(null);
    setEditFormData({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveFileDetails = async (fileId) => {
    setIsSavingFile(true);
    try {
      const payload = { ...editFormData };
      // Convert empty strings to null to avoid Pydantic date validation errors
      Object.keys(payload).forEach(key => {
        if (payload[key] === "") {
          payload[key] = null;
        }
      });
      const response = await updateFileDetails(fileId, payload);
      if (response && response.success) {
        // Update local state
        setUploadedFiles(prevFiles => prevFiles.map(f => {
          if (f.id === fileId) {
            return response.data || {
              ...f,
              ...payload
            };
          }
          return f;
        }));
        setEditingFileId(null);
        // show success (if toast is available, but for now just console or alert is fine if toast isn't in scope)
      } else {
        alert(response?.message || "Failed to update file details");
      }
    } catch (err) {
      alert(err.message || "An error occurred while saving");
    } finally {
      setIsSavingFile(false);
    }
  };


  useEffect(() => {
    loadCase();
    loadFiles();
  }, [loadCase, loadFiles]);


  // ============================================================
// AUTO REFRESH FILE PROCESSING STATUS
// ============================================================

useEffect(() => {
  if (!caseId) {
    return;
  }

  const hasProcessingFiles = uploadedFiles.some((file) => {
    const status = String(
      file?.status || ""
    ).toUpperCase();

    return [
      "UPLOADING",
      "QUEUED",
      "PROCESSING",
      "VALIDATING",
    ].includes(status);
  });

  if (!hasProcessingFiles) {
    return;
  }

  const intervalId = setInterval(() => {
    loadFiles();
  }, 2000);

  return () => {
    clearInterval(intervalId);
  };
}, [caseId, uploadedFiles, loadFiles]);

  // ============================================================
  // TOTAL PAGES
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      uploadedFiles.length /
        FILES_PER_PAGE
    )
  );

  // ============================================================
  // PROTECT CURRENT PAGE
  // ============================================================

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  // ============================================================
  // CURRENT PAGE FILES
  // ============================================================

  const currentPageFiles = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      FILES_PER_PAGE;

    const endIndex =
      startIndex +
      FILES_PER_PAGE;

    return uploadedFiles.slice(
      startIndex,
      endIndex
    );
  }, [
    uploadedFiles,
    currentPage,
  ]);

  // ============================================================
  // FILE SIZE
  // ============================================================

  function formatFileSize(bytes) {
    if (
      bytes === undefined ||
      bytes === null ||
      Number.isNaN(Number(bytes))
    ) {
      return "-";
    }

    const size = Number(bytes);

    if (size === 0) {
      return "0 Bytes";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

    const index = Math.floor(
      Math.log(size) /
        Math.log(1024)
    );

    const safeIndex = Math.min(
      index,
      units.length - 1
    );

    const value =
      size /
      Math.pow(
        1024,
        safeIndex
      );

    return `${value.toFixed(
      safeIndex === 0 ? 0 : 2
    )} ${units[safeIndex]}`;
  }

  // ============================================================
  // FILE EXTENSION
  // ============================================================

  function getFileExtension(filename) {
    if (!filename) {
      return "FILE";
    }

    const parts =
      String(filename).split(".");

    if (parts.length < 2) {
      return "FILE";
    }

    return String(
      parts[parts.length - 1]
    ).toUpperCase();
  }

  // ============================================================
  // FILE TYPE
  // ============================================================

  function getFileTypeLabel(file) {
    const extension =
      getFileExtension(
        file?.original_filename
      );

    if (extension === "PDF") {
      return "PDF";
    }

    if (
      extension === "XLS" ||
      extension === "XLSX"
    ) {
      return "EXCEL";
    }

    if (extension === "CSV") {
      return "CSV";
    }

    if (
      extension === "DOC" ||
      extension === "DOCX"
    ) {
      return "DOCUMENT";
    }

    if (extension === "TXT") {
      return "TEXT";
    }

    return extension;
  }

  // ============================================================
  // FILE STATUS CLASSES
  // ============================================================

  function getStatusClasses(status) {
    const normalizedStatus =
      String(status || "UNKNOWN")
        .toUpperCase();

    const classes = {
      UPLOADING:
        "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",

      UPLOADED:
        "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

      QUEUED:
        "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",

      PROCESSING:
        "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",

      VALIDATING:
        "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",

      COMPLETED:
        "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

      PARTIAL:
        "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",

      FAILED:
        "border-red-400/20 bg-red-400/[0.08] text-red-300",

      UNKNOWN:
        "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",
    };

    return (
      classes[normalizedStatus] ||
      classes.UNKNOWN
    );
  }

  // ============================================================
  // FORMAT STATUS
  // ============================================================

  function formatStatus(status) {
    return String(
      status || "UNKNOWN"
    )
      .replaceAll("_", " ")
      .toUpperCase();
  }

  // ============================================================
  // FILE ICON
  // ============================================================

  function getFileIcon(file) {
    const extension =
      getFileExtension(
        file?.original_filename
      );

    if (extension === "PDF") {
      return (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    }

    if (
      extension === "XLS" ||
      extension === "XLSX" ||
      extension === "CSV"
    ) {
      return (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect
            x="4"
            y="3"
            width="16"
            height="18"
            rx="2"
          />

          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );
    }

    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(date) {
    if (!date) {
      return "-";
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "-";
    }

    return parsedDate.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ============================================================
  // UPLOAD HELPERS
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

  const MAX_FILE_SIZE =
    100 * 1024 * 1024;

  function isSupportedFile(file) {
    if (!file?.name) {
      return false;
    }

    const extension = getFileExtension(file.name).toLowerCase();

    return ALLOWED_EXTENSIONS.includes(extension);
  }

  // ============================================================
  // OPEN UPLOAD TYPE MODAL
  // ============================================================

  function handleOpenUploadType() {
    if (!canUploadFiles) {
      setUploadError("You do not have permission to upload files.");
      return;
    }
    setUploadError("");
    setIsUploadTypeOpen(true);
  }

  // ============================================================
  // SINGLE FILE SELECTION
  // ============================================================

  async function handleSingleFileChange(event) {
    const file = event.target.files?.[0] || null;

    // Allows selecting the same file again.
    event.target.value = "";

    setIsUploadTypeOpen(false);

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setUploadError("");

    await uploadSingleFile(file);
  }

  // ============================================================
  // SINGLE FILE UPLOAD
  // ============================================================

  async function uploadSingleFile(file) {
    if (!canUploadFiles) {
      setUploadError("You do not have permission to upload files.");
      return;
    }

    if (!caseId) {
      setUploadError(
        "Invalid case ID. Please reopen the case."
      );
      return;
    }

    if (!file) {
      setUploadError("Please select a file first.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(
        `${file.name} exceeds the 100 MB file size limit.`
      );
      return;
    }

    if (!isSupportedFile(file)) {
      setUploadError(
        `${file.name} is not a supported file type. Supported formats: PDF, Excel, CSV, TXT, DOC and DOCX.`
      );
      return;
    }

    try {
      setIsUploading(true);
      setUploadError("");
      setFilesError("");

      console.log(
        "Uploading single file for case ID:",
        caseId,
        "File:",
        file.name
      );

      await uploadFile(caseId, file);

      await loadFiles();

      setSelectedFile(null);
      setCurrentPage(1);
    } catch (requestError) {
      console.error(
        "Failed to upload file:",
        requestError
      );

      const message = getErrorMessage(
        requestError,
        `Unable to upload ${file.name}.`
      );

      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }

  // ============================================================
  // FOLDER SELECTION
  // ============================================================

  async function handleFolderChange(event) {
    if (!canUploadFiles) {
      setUploadError("You do not have permission to upload files.");
      return;
    }

    const files = Array.from(event.target.files || []);

    // Allows selecting the same folder again.
    event.target.value = "";

    setIsUploadTypeOpen(false);

    if (!files.length) {
      return;
    }

    setUploadError("");
    setFilesError("");

    /*
     * webkitdirectory returns every file inside the selected
     * folder, including files inside subfolders.
     *
     * We intentionally do not preserve the folder path.
     * Each file is sent individually to the existing upload API.
     */
    const supportedFiles = files.filter(isSupportedFile);

    const unsupportedCount =
      files.length - supportedFiles.length;

    if (!supportedFiles.length) {
      setUploadError(
        "No supported files were found in the selected folder. Supported formats: PDF, Excel, CSV, TXT, DOC and DOCX."
      );
      return;
    }

    await uploadFolderFiles(
      supportedFiles,
      unsupportedCount
    );
  }

  // ============================================================
  // FOLDER UPLOAD
  // ============================================================

  async function uploadFolderFiles(
    files,
    unsupportedCount = 0
  ) {
    if (!caseId) {
      setUploadError(
        "Invalid case ID. Please reopen the case."
      );
      return;
    }

    setIsFolderUploading(true);
    setUploadError("");
    setFilesError("");

    setFolderUploadProgress({
      completed: 0,
      total: files.length,
      failed: 0,
    });

    let completed = 0;
    let failed = 0;

    /*
     * Upload sequentially instead of sending every file at once.
     * This avoids creating a large request burst when a folder
     * contains many bank documents.
     */
    for (const file of files) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `${file.name} exceeds the 100 MB file size limit.`
          );
        }

        await uploadFile(caseId, file);
        completed += 1;
      } catch (requestError) {
        failed += 1;

        console.error(
          `Failed to upload ${file.name}:`,
          requestError
        );
      }

      setFolderUploadProgress({
        completed: completed + failed,
        total: files.length,
        failed,
      });
    }

    try {
      await loadFiles();
      setCurrentPage(1);
    } catch (requestError) {
      console.error(
        "Failed to refresh files after folder upload:",
        requestError
      );
    }

    setIsFolderUploading(false);

    if (failed > 0) {
      setUploadError(
        `${completed} of ${files.length} supported files uploaded successfully. ${failed} file(s) failed.${
          unsupportedCount > 0
            ? ` ${unsupportedCount} unsupported file(s) were skipped.`
            : ""
        }`
      );
    } else if (unsupportedCount > 0) {
      setUploadError(
        `${completed} file(s) uploaded successfully. ${unsupportedCount} unsupported file(s) were skipped.`
      );
    }

    setFolderUploadProgress({
      completed,
      total: files.length,
      failed,
    });
  }

  // ============================================================
  // LEGACY SINGLE-FILE FORM HANDLER
  // ============================================================

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      handleOpenUploadType();
      return;
    }

    await uploadSingleFile(selectedFile);
  }

  // ============================================================
  // VIEW FILE
  // ============================================================

  async function handleViewFile(file) {
  try {
    if (!file?.id) {
      throw new Error("File ID is missing.");
    }

    const fileBlob = await getFileView(file.id);

    console.log("File view Blob:", fileBlob);

    if (!(fileBlob instanceof Blob)) {
      throw new Error("The file response is not a valid Blob.");
    }

    const fileUrl = URL.createObjectURL(fileBlob);

    console.log("File view URL:", fileUrl);

    window.open(
      fileUrl,
      "_blank",
      "noopener,noreferrer"
    );

    // Do not revoke immediately because the new tab
    // still needs the Blob URL.
    setTimeout(() => {
      URL.revokeObjectURL(fileUrl);
    }, 60 * 1000);

  } catch (requestError) {
    console.error(
      "Failed to open file:",
      requestError
    );

    setFilesError(
      requestError?.message ||
        "Unable to open the selected file."
    );
  }
}
  // ============================================================
  // DELETE FILE
  // ============================================================

  async function handleDeleteFile(file) {
    if (!canDeleteFiles) {
      setFilesError("You do not have permission to delete files.");
      return;
    }

    if (!file?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${file.original_filename}"?\n\nThis action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingFileId(file.id);
      setFilesError("");

      await deleteFile(file.id);

      /*
       * Remove from local state immediately.
       */

      setUploadedFiles(
        (currentFiles) =>
          currentFiles.filter(
            (currentFile) =>
              currentFile.id !==
              file.id
          )
      );

      /*
       * Calculate pages after deletion.
       */

      const remainingCount =
        Math.max(
          0,
          uploadedFiles.length - 1
        );

      const remainingPages =
        Math.max(
          1,
          Math.ceil(
            remainingCount /
              FILES_PER_PAGE
          )
        );

      setCurrentPage(
        (previousPage) =>
          Math.min(
            previousPage,
            remainingPages
          )
      );
    } catch (requestError) {
      console.error(
        "Failed to delete file:",
        requestError
      );

      const message =
        getErrorMessage(
          requestError,
          "Unable to delete the selected file."
        );

      setFilesError(message);
    } finally {
      setDeletingFileId(null);
    }
  }

  // ============================================================
  // REFRESH FILES
  // ============================================================

  async function handleRefreshFiles() {
    await loadFiles();
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  function goToPreviousPage() {
    setCurrentPage(
      (page) =>
        Math.max(
          1,
          page - 1
        )
    );
  }

  function goToNextPage() {
    setCurrentPage(
      (page) =>
        Math.min(
          totalPages,
          page + 1
        )
    );
  }

  function goToPage(page) {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    setCurrentPage(page);
  }

  function getPageNumbers() {
    const pages = [];

    if (totalPages <= 7) {
      for (
        let page = 1;
        page <= totalPages;
        page += 1
      ) {
        pages.push(page);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 4) {
      pages.push(
        "left-ellipsis"
      );
    }

    const startPage =
      Math.max(
        2,
        currentPage - 1
      );

    const endPage =
      Math.min(
        totalPages - 1,
        currentPage + 1
      );

    for (
      let page = startPage;
      page <= endPage;
      page += 1
    ) {
      if (!pages.includes(page)) {
        pages.push(page);
      }
    }

    if (
      currentPage <
      totalPages - 3
    ) {
      pages.push(
        "right-ellipsis"
      );
    }

    pages.push(totalPages);

    return pages;
  }

  // ============================================================
  // TRANSACTION PAGINATION
  // ============================================================

  function goToPreviousTransactionPage() {
  if (transactionPage <= 1) {
    return;
  }

  loadFilteredTransactions(transactionPage - 1);
}

function goToNextTransactionPage() {
  if (transactionPage >= transactionTotalPages) {
    return;
  }

  loadFilteredTransactions(transactionPage + 1);
}
  // ============================================================
  // CASE STATUS
  // ============================================================

  const status = String(
    caseData?.status ||
      "UNKNOWN"
  ).toUpperCase();

  const statusClasses = {
    DRAFT:
      "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",

    ACTIVE:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

    IN_PROGRESS:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",

    COMPLETED:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

    ARCHIVED:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",

    FAILED:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",

    UNKNOWN:
      "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",
  };

  const statusStyle =
    statusClasses[status] ||
    statusClasses.UNKNOWN;

  // ============================================================
  // INVALID CASE ID
  // ============================================================

  if (!rawCaseId || !caseId) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10">
          <BASNavbar />

          <main className="flex min-h-[calc(100vh-108px)] items-center justify-center px-5">

            <div className="w-full max-w-lg rounded-[22px] border border-red-400/20 bg-[#061411]/80 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop-blur-sm">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.05]">

                <svg
                  className="h-6 w-6 text-red-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path
                    d="M12 8v5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M12 16h.01"
                    strokeLinecap="round"
                  />
                </svg>

              </div>

              <p className="mt-5 text-base font-semibold text-red-300">
                Invalid Case
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                The case ID is missing or invalid.
                Please return to the Cases page
                and open the case again.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dashboard/cases"
                  )
                }
                className="mt-7 rounded-xl bg-emerald-400 px-5 py-3 text-xs font-semibold text-[#03100d] transition hover:bg-emerald-300"
              >
                Back to Cases
              </button>

            </div>

          </main>
        </div>

        <BASFooter />
      </div>
    );
  }

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="pointer-events-none absolute -top-48 left-1/3 h-[550px] w-[550px] rounded-full bg-emerald-400/[0.025] blur-3xl" />

        <div className="relative z-10">

          <BASNavbar />

          <main className="flex min-h-[calc(100vh-108px)] items-center justify-center px-5">

            <div className="text-center">

              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />

              <p className="mt-5 text-sm text-slate-500">
                Loading case...
              </p>

            </div>

          </main>

        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error || !caseData) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(52, 211, 153, 0.035) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="pointer-events-none absolute -top-48 left-1/3 h-[550px] w-[550px] rounded-full bg-emerald-400/[0.025] blur-3xl" />

        <div className="relative z-10">

          <BASNavbar />

          <main className="flex min-h-[calc(100vh-108px)] items-center justify-center px-5">

            <div className="w-full max-w-lg rounded-[22px] border border-red-400/20 bg-[#061411]/80 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop-blur-sm">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.05]">

                <svg
                  className="h-6 w-6 text-red-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path
                    d="M12 8v5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M12 16h.01"
                    strokeLinecap="round"
                  />
                </svg>

              </div>

              <p className="mt-5 text-base font-semibold text-red-300">
                Unable to load case
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {error ||
                  "Case not found."}
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dashboard/cases"
                  )
                }
                className="mt-7 rounded-xl bg-emerald-400 px-5 py-3 text-xs font-semibold text-[#03100d] transition hover:bg-emerald-300"
              >
                Back to Cases
              </button>

            </div>

          </main>

        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

      {/* ========================================================
          BACKGROUND
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(52, 211, 153, 0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(52, 211, 153, 0.035) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="pointer-events-none absolute -top-48 left-1/3 h-[550px] w-[550px] rounded-full bg-emerald-400/[0.025] blur-3xl" />

      <div className="pointer-events-none absolute right-[-180px] top-[450px] h-[450px] w-[450px] rounded-full bg-emerald-400/[0.018] blur-3xl" />

      <div className="relative z-10">

        <BASNavbar />

        <main>

          <div className="mx-auto max-w-[1700px] px-5 py-10 sm:px-8 lg:px-10">

            {/* ==================================================
                BACK BUTTON
            ================================================== */}

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dashboard/cases"
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-slate-400 transition-all duration-200 hover:border-emerald-400/20 hover:bg-emerald-400/[0.04] hover:text-emerald-300"
            >

              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M19 12H5"
                  strokeLinecap="round"
                />

                <path
                  d="m12 19-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              Back to Cases

            </button>

            {/* ==================================================
                CASE HEADER
            ================================================== */}

            <div className="mt-8 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">

              <div className="max-w-4xl">

                <div className="flex items-center gap-3">

                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

                  <span className="text-xs font-semibold tracking-[0.22em] text-emerald-400">
                    BANK ANALYTICAL SYSTEM
                  </span>

                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.20em] text-emerald-400/70">
                  {caseData.case_number}
                </p>

                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  {caseData.case_name}
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
                  {caseData.description ||
                    "No description provided for this investigation."}
                </p>

              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">

                {canViewReports && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/dashboard/cases/${caseId}/reports`
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-4 py-2.5 text-xs font-semibold text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.12)] transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-400/[0.18] hover:text-white"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    View Case Report
                  </button>
                )}

                <span
                  className={`
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    px-4
                    py-2
                    text-xs
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    ${statusStyle}
                  `}
                >

                  <span className="h-1.5 w-1.5 rounded-full bg-current" />

                  {status.replaceAll(
                    "_",
                    " "
                  )}

                </span>

              </div>

            </div>

            {/* ==================================================
                CASE INFORMATION
            ================================================== */}

            <section className="mt-10">

              <div className="mb-5 flex items-center gap-3">

                <span className="h-7 w-1 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.45)]" />

                <div>

                  <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400">
                    CASE INFORMATION
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Investigation Details
                  </h2>

                </div>

              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-[22px] border border-white/[0.08] bg-[#061411]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)] backdrop-blur-sm">

                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    CASE ID
                  </p>

                  <p className="mt-4 text-2xl font-semibold text-white">
                    #{caseData.id}
                  </p>

                </div>

                <div className="rounded-[22px] border border-white/[0.08] bg-[#061411]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)] backdrop-blur-sm">

                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    CASE NUMBER
                  </p>

                  <p className="mt-4 text-lg font-semibold text-emerald-300">
                    {caseData.case_number}
                  </p>

                </div>

                <div className="rounded-[22px] border border-white/[0.08] bg-[#061411]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)] backdrop-blur-sm">

                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    CREATED
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    {formatDate(
                      caseData.created_at
                    )}
                  </p>

                </div>

                <div className="rounded-[22px] border border-white/[0.08] bg-[#061411]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)] backdrop-blur-sm">

                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    LAST UPDATED
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    {formatDate(
                      caseData.updated_at
                    )}
                  </p>

                </div>

                {caseData.io && (
                  <div className="rounded-[22px] border border-emerald-400/20 bg-[#061411]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)] backdrop-blur-sm sm:col-span-2 xl:col-span-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                          INVESTIGATING OFFICER (IO)
                        </p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {caseData.io.officer_name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          {caseData.io.designation}
                        </span>
                        <span className="text-xs text-slate-300">
                          Station / Branch: <strong className="text-white">{caseData.io.police_station}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </section>

            {/* ==================================================
                DOCUMENTS
            ================================================== */}

            <section className="mt-10">

              <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#061411]/80 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-sm">

                {/* =================================================
                    DOCUMENT HEADER
                ================================================= */}

                <div className="border-b border-white/[0.06] px-7 py-7">

                  <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

                    <div className="flex items-center gap-4">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05]">

                        <svg
                          className="h-6 w-6 text-emerald-300"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M6 3h9l4 4v14H6z" />
                          <path d="M14 3v5h5" />
                          <path d="M9 13h6" />
                          <path d="M9 17h6" />
                        </svg>

                      </div>

                      <div>

                        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400">
                          CASE DOCUMENTS
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-white">
                          Investigation Files
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Upload, view and manage bank statements and case documents.
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center gap-3">

                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">

                        <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                          TOTAL FILES
                        </p>

                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          {uploadedFiles.length}
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={handleRefreshFiles}
                        disabled={
                          isFilesLoading
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >

                        <svg
                          className={`h-4 w-4 ${
                            isFilesLoading
                              ? "animate-spin"
                              : ""
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path
                            d="M20 11a8.1 8.1 0 0 0-15.3-3"
                            strokeLinecap="round"
                          />

                          <path
                            d="M4 5v4h4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          <path
                            d="M4 13a8.1 8.1 0 0 0 15.3 3"
                            strokeLinecap="round"
                          />

                          <path
                            d="M20 19v-4h-4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        Refresh

                      </button>

                    </div>

                  </div>

                </div>

                {/* =================================================
                    UPLOAD AREA
                ================================================= */}

                <div className="border-b border-white/[0.06] p-7">

                  <div className="rounded-2xl border border-dashed border-emerald-400/20 bg-emerald-400/[0.015] p-6">

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                      <div className="flex items-start gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04]">

                          <svg
                            className="h-5 w-5 text-emerald-300"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path
                              d="M12 16V4"
                              strokeLinecap="round"
                            />

                            <path
                              d="m7 9 5-5 5 5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            <path
                              d="M5 20h14"
                              strokeLinecap="round"
                            />
                          </svg>

                        </div>

                        <div>

                          <p className="text-sm font-semibold text-white">
                            Upload investigation documents
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Upload one file or an entire folder. Supported formats: PDF, Excel, CSV, TXT, DOC and DOCX. Maximum size: 100 MB per file.
                          </p>

                        </div>

                      </div>

                    {canUploadFiles ? (
                      <button
                        type="button"
                        onClick={handleOpenUploadType}
                        disabled={
                          isUploading ||
                          isFolderUploading
                        }
                        className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-xs font-bold text-[#03100d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >

                        {isUploading || isFolderUploading ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                d="M12 16V4"
                                strokeLinecap="round"
                              />
                              <path
                                d="m7 9 5-5 5 5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5 20h14"
                                strokeLinecap="round"
                              />
                            </svg>
                            Upload Documents
                          </>
                        )}

                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs font-medium text-amber-300">
                        <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Upload restricted by admin
                      </div>
                    )}

                    </div>

                    {isFolderUploading && (
                      <div className="mt-5 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] px-4 py-4">

                        <div className="flex items-center justify-between gap-4">

                          <p className="text-xs font-semibold text-slate-300">
                            Uploading folder...
                          </p>

                          <p className="text-xs font-semibold text-emerald-300">
                            {folderUploadProgress.completed} / {folderUploadProgress.total}
                          </p>

                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">

                          <div
                            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                            style={{
                              width: `${
                                folderUploadProgress.total > 0
                                  ? Math.min(
                                      100,
                                      (folderUploadProgress.completed /
                                        folderUploadProgress.total) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />

                        </div>

                        {folderUploadProgress.failed > 0 && (
                          <p className="mt-2 text-[10px] text-red-300">
                            Failed: {folderUploadProgress.failed}
                          </p>
                        )}

                      </div>
                    )}

                    {selectedFile && !isUploading && !isFolderUploading && (
                      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                        <div className="flex min-w-0 items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300">
                            {getFileIcon({
                              original_filename:
                                selectedFile.name,
                            })}
                          </div>

                          <div className="min-w-0">

                            <p className="truncate text-xs font-semibold text-slate-200">
                              {selectedFile.name}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-600">
                              {formatFileSize(
                                selectedFile.size
                              )}
                            </p>

                          </div>

                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-red-300 sm:text-right"
                        >
                          Remove
                        </button>

                      </div>
                    )}

                    {uploadError && (
                      <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3 text-xs text-red-300">
                        {uploadError}
                      </div>
                    )}

                  </div>

                </div>

                {/* =================================================
                    HIDDEN FILE INPUTS
                ================================================= */}

                <input
                  ref={singleFileInputRef}
                  type="file"
                  onChange={handleSingleFileChange}
                  disabled={
                    isUploading ||
                    isFolderUploading
                  }
                  accept=".pdf,.csv,.xlsx,.xls,.txt,.doc,.docx"
                  className="hidden"
                />

                <input
                  ref={folderInputRef}
                  type="file"
                  onChange={handleFolderChange}
                  disabled={
                    isUploading ||
                    isFolderUploading
                  }
                  multiple
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                />

                {/* =================================================
                    UPLOAD TYPE MODAL
                ================================================= */}

                {isUploadTypeOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#061411] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                            CASE DOCUMENTS
                          </p>

                          <h2 className="mt-2 text-xl font-semibold text-white">
                            Upload Documents
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            Choose whether you want to upload one file or an entire folder.
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={() => setIsUploadTypeOpen(false)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-slate-500 transition hover:border-white/[0.15] hover:text-white"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="m6 6 12 12"
                              strokeLinecap="round"
                            />
                            <path
                              d="m18 6-12 12"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>

                      </div>

                      <div className="mt-6 space-y-3">

                        <button
                          type="button"
                          onClick={() => {
                            setIsUploadTypeOpen(false);
                            singleFileInputRef.current?.click();
                          }}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]"
                        >

                          <div className="flex items-center gap-4">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300">
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d="M6 3h9l4 4v14H6z" />
                                <path d="M14 3v5h5" />
                                <path d="M9 13h6" />
                              </svg>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">
                                Single File
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Upload one PDF, Excel, CSV, TXT, DOC or DOCX file.
                              </p>
                            </div>

                          </div>

                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUploadTypeOpen(false);
                            folderInputRef.current?.click();
                          }}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]"
                        >

                          <div className="flex items-center gap-4">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300">
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d="M3 7h7l2 2h9v10H3z" />
                                <path d="M3 7V5h7l2 2" />
                              </svg>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">
                                Folder Upload
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Upload all supported files inside the folder and its subfolders.
                              </p>
                            </div>

                          </div>

                        </button>

                      </div>

                      <button
                        type="button"
                        onClick={() => setIsUploadTypeOpen(false)}
                        className="mt-5 w-full rounded-xl border border-white/[0.08] px-4 py-3 text-xs font-semibold text-slate-500 transition hover:border-white/[0.15] hover:text-white"
                      >
                        Cancel
                      </button>

                    </div>

                  </div>
                )}

                {/* =================================================
                    FILE ERROR
                ================================================= */}

                {filesError && (
                  <div className="mx-7 mt-7 rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3 text-xs text-red-300">
                    {filesError}
                  </div>
                )}

                {/* =================================================
                    FILE LIST
                ================================================= */}

                <div className="p-7">

                  {isFilesLoading ? (
                    <div className="flex min-h-[220px] items-center justify-center">

                      <div className="text-center">

                        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />

                        <p className="mt-4 text-xs text-slate-500">
                          Loading documents...
                        </p>

                      </div>

                    </div>
                  ) : uploadedFiles.length === 0 ? (
                    <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 text-center">

                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300">

                        <svg
                          className="h-6 w-6"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M6 3h9l4 4v14H6z" />
                          <path d="M14 3v5h5" />
                          <path d="M9 13h6" />
                          <path d="M9 17h6" />
                        </svg>

                      </div>

                      <p className="mt-5 text-sm font-semibold text-slate-300">
                        No documents uploaded
                      </p>

                      <p className="mt-2 max-w-md text-xs leading-5 text-slate-600">
                        Upload bank statements or other investigation documents to start working with this case.
                      </p>

                    </div>
                  ) : (
                    <>

                      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="text-sm font-semibold text-white">
                            Uploaded Documents
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Showing{" "}
                            {Math.min(
                              (currentPage - 1) *
                                FILES_PER_PAGE +
                                1,
                              uploadedFiles.length
                            )}
                            {" - "}
                            {Math.min(
                              currentPage *
                                FILES_PER_PAGE,
                              uploadedFiles.length
                            )}{" "}
                            of{" "}
                            {uploadedFiles.length}{" "}
                            files
                          </p>

                        </div>

                        {totalPages > 1 && (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            Page{" "}
                            {currentPage}{" "}
                            of{" "}
                            {totalPages}
                          </p>
                        )}

                      </div>

                      <div className="space-y-3">

                        {currentPageFiles.map(
                          (file) => (
                            <div
                              key={file.id}
                              className="group rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 transition-all duration-200 hover:border-emerald-400/15 hover:bg-emerald-400/[0.02]"
                            >

                              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                                <div className="flex min-w-0 items-center gap-4">

                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300">
                                    {getFileIcon(
                                      file
                                    )}
                                  </div>

                                  <div className="min-w-0">

                                    <p
                                      className="truncate text-sm font-semibold text-slate-200 cursor-pointer hover:text-emerald-300 transition-colors flex items-center gap-2 select-none"
                                      title={file.original_filename}
                                      onClick={() => handleFileClick(file.id)}
                                    >
                                      {file.original_filename}
                                      {expandedFileId === file.id ? (
                                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </p>

                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.10em] text-slate-600">

                                      <span>
                                        {getFileTypeLabel(
                                          file
                                        )}
                                      </span>

                                      <span className="h-1 w-1 rounded-full bg-slate-700" />

                                      <span>
                                        {formatFileSize(
                                          file.file_size
                                        )}
                                      </span>

                                      <span className="h-1 w-1 rounded-full bg-slate-700" />

                                      <span>
                                        {formatDate(
                                          file.created_at
                                        )}
                                      </span>

                                    </div>

                                  </div>

                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                                  <span
                                    className={`
                                      inline-flex
                                      items-center
                                      justify-center
                                      gap-2
                                      rounded-full
                                      border
                                      px-3
                                      py-1.5
                                      text-[9px]
                                      font-semibold
                                      tracking-[0.12em]
                                      ${getStatusClasses(
                                        file.status
                                      )}
                                    `}
                                  >

                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />

                                    {formatStatus(
                                      file.status
                                    )}

                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleViewFile(
                                        file
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.08]"
                                  >

                                    <svg
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.7"
                                    >
                                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />

                                      <circle
                                        cx="12"
                                        cy="12"
                                        r="2.5"
                                      />
                                    </svg>

                                    View

                                  </button>

                                  {String(file.status || "").toUpperCase() === "COMPLETED" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedTransactionFileId === file.id) {
                                          setSelectedTransactionFileId(null);
                                          setTransactions([]);
                                        } else {
                                          loadTransactions(file.id);
                                        }
                                      }}
                                      disabled={
                                        isTransactionsLoading &&
                                        selectedTransactionFileId === file.id
                                      }
                                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.03] px-4 py-2.5 text-xs font-semibold text-cyan-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isTransactionsLoading &&
                                      selectedTransactionFileId === file.id ? (
                                        <>
                                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                                          Loading...
                                        </>
                                      ) : (
                                        <>
                                          <svg
                                            className="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                          >
                                            <path d="M4 7h16" strokeLinecap="round" />
                                            <path d="M4 12h16" strokeLinecap="round" />
                                            <path d="M4 17h16" strokeLinecap="round" />
                                          </svg>
                                          Transactions
                                        </>
                                      )}
                                    </button>
                                  )}

                                  {canDeleteFiles && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteFile(
                                        file
                                      )
                                    }
                                    disabled={
                                      deletingFileId ===
                                      file.id
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.03] px-4 py-2.5 text-xs font-semibold text-red-300 transition hover:border-red-400/30 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                                  >

                                    {deletingFileId ===
                                    file.id ? (
                                      <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300/30 border-t-red-300" />

                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <svg
                                          className="h-4 w-4"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.7"
                                        >
                                          <path
                                            d="M4 7h16"
                                            strokeLinecap="round"
                                          />

                                          <path
                                            d="M10 11v6"
                                            strokeLinecap="round"
                                          />

                                          <path
                                            d="M14 11v6"
                                            strokeLinecap="round"
                                          />

                                          <path d="M6 7l1 14h10l1-14" />

                                          <path
                                            d="M9 7V4h6v3"
                                            strokeLinecap="round"
                                          />
                                        </svg>

                                        Delete
                                      </>
                                    )}

                                  </button>
                                  )}

                                </div>

                              </div>

                              {/* File Details Expanded Section */}
                              {expandedFileId === file.id && (
                                <div className="mt-4 border-t border-white/[0.06] pt-4 animate-in slide-in-from-top-2 duration-200">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">File Details</h4>
                                    {editingFileId !== file.id && (
                                      <button 
                                        type="button" 
                                        onClick={(e) => handleEditClick(e, file)}
                                        className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300 hover:text-cyan-400 border border-cyan-400/20 hover:border-cyan-400/40 bg-cyan-400/[0.05] hover:bg-cyan-400/[0.1] px-3 py-1 rounded-full transition-all"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Account Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_name" value={editFormData.account_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Number</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_number" value={editFormData.account_number} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_number || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Type</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_type" value={editFormData.account_type} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_type || 'Not Available'}</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Bank Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Bank Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="bank_name" value={editFormData.bank_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.bank_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Branch Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="branch_name" value={editFormData.branch_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.branch_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">IFSC</div>
                                          {editingFileId === file.id ? (
                                            <input type="text" name="ifsc" value={editFormData.ifsc} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.ifsc || 'Not Available'}</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">MICR</div>
                                          {editingFileId === file.id ? (
                                            <input type="text" name="micr" value={editFormData.micr} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.micr || 'Not Available'}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Statement & Processing Information */}
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement From</div>
                                          {editingFileId === file.id ? (
                                            <input type="date" name="statement_start_date" value={editFormData.statement_start_date} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.statement_start_date ? formatDate(file.statement_start_date) : 'Not Available'}</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement To</div>
                                          {editingFileId === file.id ? (
                                            <input type="date" name="statement_end_date" value={editFormData.statement_end_date} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.statement_end_date ? formatDate(file.statement_end_date) : 'Not Available'}</div>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Status</div>
                                        <div className="text-sm font-medium text-slate-200">{file.status || 'Not Available'}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Processing Stage</div>
                                          <div className="text-sm font-medium text-slate-200">{file.processing_stage || 'Not Available'}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Processing</div>
                                          <div className="text-sm font-medium text-slate-200">
                                            {file.processing_progress ? `${file.processing_progress}%` : 'Not Available'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {editingFileId === file.id && (
                                    <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]">
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingFile}
                                        className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveFileDetails(file.id)}
                                        disabled={isSavingFile}
                                        className="px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        {isSavingFile ? 'Saving...' : 'Save Changes'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        )}

                      </div>

                      {/* =================================================
                          PAGINATION
                      ================================================= */}

                      {totalPages > 1 && (
                        <div className="mt-7 flex flex-col gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">

                          <p className="text-xs text-slate-600">
                            Page{" "}
                            <span className="font-semibold text-slate-400">
                              {currentPage}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-slate-400">
                              {totalPages}
                            </span>
                          </p>

                          <div className="flex items-center gap-1.5">

                            <button
                              type="button"
                              onClick={
                                goToPreviousPage
                              }
                              disabled={
                                currentPage ===
                                1
                              }
                              className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
                            >

                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="m15 18-6-6 6-6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>

                            </button>

                            {getPageNumbers().map(
                              (page) => {
                                if (
                                  page ===
                                    "left-ellipsis" ||
                                  page ===
                                    "right-ellipsis"
                                ) {
                                  return (
                                    <span
                                      key={
                                        page
                                      }
                                      className="flex h-9 min-w-9 items-center justify-center px-1 text-xs text-slate-700"
                                    >
                                      ...
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    key={
                                      page
                                    }
                                    type="button"
                                    onClick={() =>
                                      goToPage(
                                        page
                                      )
                                    }
                                    className={`
                                      flex
                                      h-9
                                      min-w-9
                                      items-center
                                      justify-center
                                      rounded-lg
                                      border
                                      px-2.5
                                      text-xs
                                      font-semibold
                                      transition
                                      ${
                                        currentPage ===
                                        page
                                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                          : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-emerald-400/20 hover:text-emerald-300"
                                      }
                                    `}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                            )}

                            <button
                              type="button"
                              onClick={
                                goToNextPage
                              }
                              disabled={
                                currentPage ===
                                totalPages
                              }
                              className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
                            >

                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="m9 18 6-6-6-6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>

                            </button>

                          </div>

                        </div>
                      )}

                    </>
                  )}

                </div>

              </div>

            </section>

            {/* ==================================================
                TRANSACTIONS
            ================================================== */}

            {selectedTransactionFileId && (
              <section className="mt-10">

                <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#061411]/80 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-sm">

                  <div className="border-b border-white/[0.06] px-7 py-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400">
                          BANK TRANSACTIONS
                        </p>
                        <h2 className="mt-1 text-xl font-semibold text-white">
                          Processed Transactions
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Transaction records extracted from the selected bank statement.
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                          TOTAL TRANSACTIONS
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          {transactionTotal}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-7">
                    {isTransactionsLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center">
                        <div className="text-center">
                          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
                          <p className="mt-4 text-xs text-slate-500">
                            Loading transactions...
                          </p>
                        </div>
                      </div>
                    ) : transactionsError ? (
                      <div className="rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-4 text-sm text-red-300">
                        {transactionsError}
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 text-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-300">
                            No transactions found
                          </p>
                          <p className="mt-2 text-xs text-slate-600">
                            The selected file does not currently contain stored transaction records.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                        <table className="min-w-[1000px] w-full text-left">
                          <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                            <tr>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">#</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Date</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Mode</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Description</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Counter Party</th>
                              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Debit</th>
                              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Credit</th>
                              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Balance</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Page</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {transactions.map((transaction, index) => (
                              <tr key={transaction.id ?? `${transaction.file_id}-${transaction.source_row}-${index}`} className="transition hover:bg-emerald-400/[0.02]">
                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                                  {(transactionPage - 1) *
                                    transactionPageSize +
                                    index +
                                    1}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-300">
                                  {transaction.transaction_date || "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  {transaction.mode || "-"}
                                </td>
                                <td className="max-w-[320px] px-4 py-3 text-xs leading-5 text-slate-400" title={transaction.description || ""}>
                                  <div className="line-clamp-2">
                                    {transaction.description || "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs leading-5">
                                  {transaction.counterparty_name ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-emerald-300">
                                        {transaction.counterparty_name}
                                      </span>
                                      {transaction.counterparty_identifier && (
                                        <span className="text-[10px] text-slate-500">
                                          ID: {transaction.counterparty_identifier}
                                        </span>
                                      )}
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {transaction.counterparty_type && (
                                          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                                            {transaction.counterparty_type}
                                          </span>
                                        )}
                                        {transaction.counterparty_source && (
                                          <span className="rounded bg-indigo-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-indigo-400">
                                            {transaction.counterparty_source}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-red-300">
                                  {transaction.debit ?? "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-emerald-300">
                                  {transaction.credit ?? "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-slate-200">
                                  {transaction.balance ?? "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                                  {transaction.source_page ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {transactionTotalPages > 1 && (
                        <div className="flex flex-col gap-4 border-t border-white/[0.06] bg-white/[0.01] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs text-slate-500">
                            Showing{" "}
                            <span className="font-semibold text-slate-300">
                              {transactionTotal === 0
                                ? 0
                                : (transactionPage - 1) *
                                    transactionPageSize +
                                  1}
                            </span>
                            {" "}–{" "}
                            <span className="font-semibold text-slate-300">
                              {Math.min(
                                transactionPage * transactionPageSize,
                                transactionTotal
                              )}
                            </span>
                            {" "}of{" "}
                            <span className="font-semibold text-slate-300">
                              {transactionTotal}
                            </span>
                            {" "}transactions
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={goToPreviousTransactionPage}
                              disabled={
                                transactionPage === 1 ||
                                isTransactionsLoading
                              }
                              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="m15 18-6-6 6-6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Previous
                            </button>

                            <div className="flex h-9 items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 text-xs font-semibold text-emerald-300">
                              Page {transactionPage} of {transactionTotalPages}
                            </div>

                            <button
                              type="button"
                              onClick={goToNextTransactionPage}
                              disabled={
                                transactionPage === transactionTotalPages ||
                                isTransactionsLoading
                              }
                              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Next
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="m9 18 6-6-6-6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      </>
                    )}
                  </div>

                </div>

              </section>
            )}

                        {/* ==================================================
                WORKSPACE MODULES
            ================================================== */}

            <section className="mt-10">

              <div className="mb-5 flex items-center gap-3">

                <span className="h-7 w-1 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.45)]" />

                <div>

                  <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400">
                    ANALYTICAL WORKSPACE
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Investigation Modules
                  </h2>

                </div>

              </div>

              <div className="grid gap-5 md:grid-cols-3">

                {/* Transactions */}

                <div className="group rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.02] p-6">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04]">
                      <svg
                        className="h-5 w-5 text-emerald-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M4 7h16" strokeLinecap="round" />
                        <path d="M4 12h16" strokeLinecap="round" />
                        <path d="M4 17h16" strokeLinecap="round" />
                      </svg>
                    </div>

                    {transactions.length > 0 && (
                      <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-1 text-[10px] font-semibold text-emerald-300">
                        {transactions.length} rows
                      </span>
                    )}

                  </div>

                  <h3 className="mt-5 text-base font-semibold text-white">
                    Transactions
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Select Transactions on a completed file to load its processed bank transaction data.
                  </p>

                  {selectedTransactionFileId && (
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Selected file ID: {selectedTransactionFileId}
                    </p>
                  )}

                  {transactionsError && (
                    <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-300">
                      {transactionsError}
                    </div>
                  )}

                  {isTransactionsLoading && (
                    <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
                      Loading transactions...
                    </div>
                  )}

                </div>

                {/* Relationship Graph */}

                <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.015] p-6 transition-all duration-200 hover:border-emerald-400/20 hover:bg-emerald-400/[0.02]">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04]">

                    <svg
                      className="h-5 w-5 text-emerald-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <circle
                        cx="5"
                        cy="12"
                        r="2"
                      />

                      <circle
                        cx="19"
                        cy="6"
                        r="2"
                      />

                      <circle
                        cx="19"
                        cy="18"
                        r="2"
                      />

                      <path d="m7 11 10-4" />
                      <path d="m7 13 10 4" />
                    </svg>

                  </div>

                  <h3 className="mt-5 text-base font-semibold text-white">
                    Relationship Graph
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Transaction relationships and entity connections will appear here.
                  </p>

                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/60">
                    Coming next
                  </div>

                </div>

                {/* Reports */}

                <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.015] p-6 transition-all duration-200 hover:border-emerald-400/20 hover:bg-emerald-400/[0.02]">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04]">

                    <svg
                      className="h-5 w-5 text-emerald-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M5 3h14v18H5z" />

                      <path d="M8 8h8" />
                      <path d="M8 12h8" />
                      <path d="M8 16h5" />
                    </svg>

                  </div>

                  <h3 className="mt-5 text-base font-semibold text-white">
                    Reports
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Analysis and financial intelligence reports will appear here.
                  </p>

                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/60">
                    Coming next
                  </div>

                </div>

              </div>

            </section>

            {/* ==================================================
                CASE SUMMARY
            ================================================== */}

            <section className="mt-10">

              <div className="rounded-[22px] border border-emerald-400/[0.08] bg-emerald-400/[0.02] p-7">

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div>

                    <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400">
                      ACTIVE CASE
                    </p>

                    <p className="mt-2 text-lg font-semibold text-white">
                      {caseData.case_name}
                    </p>

                  </div>

                  <div className="text-left md:text-right">

                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      STATUS
                    </p>

                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      {status.replaceAll(
                        "_",
                        " "
                      )}
                    </p>

                  </div>

                </div>

              </div>

            </section>

          </div>

        </main>

        <BASFooter />

      </div>
    </div>
  );
}

export default CaseDetails;