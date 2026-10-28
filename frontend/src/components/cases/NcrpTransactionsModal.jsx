import React, { useEffect, useState, useCallback, useMemo } from "react";
import { getNcrpTransactions, getNcrpFileView } from "../../services/api/ncrp";

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "-";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTransactionDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

export default function NcrpTransactionsModal({
  isOpen,
  onClose,
  file,
  caseId,
}) {
  const [transactions, setTransactions] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState({ total_amount: 0, total_disputed_amount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset states when a new file is opened
  useEffect(() => {
    if (isOpen && file?.id) {
      setSelectedSheet("ALL");
      setSearchTerm("");
      setDebouncedSearch("");
      setPage(1);
      setExpandedRowId(null);
      setError("");
    }
  }, [isOpen, file?.id]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load transactions
  const fetchTransactions = useCallback(async () => {
    if (!isOpen || !file?.id) return;

    try {
      setIsLoading(true);
      setError("");

      const skip = (page - 1) * pageSize;
      const res = await getNcrpTransactions(file.id, {
        caseId: caseId || file.case_id,
        sheetName: selectedSheet !== "ALL" ? selectedSheet : null,
        search: debouncedSearch.trim() || null,
        skip,
        limit: pageSize,
      });

      if (res && typeof res === "object") {
        const items = Array.isArray(res.items)
          ? res.items
          : Array.isArray(res.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        setTransactions(items);
        setTotal(Number(res.total ?? items.length));
        setTotalPages(Number(res.total_pages ?? Math.ceil(items.length / pageSize)));

        if (Array.isArray(res.sheets) && res.sheets.length > 0) {
          setSheets(res.sheets);
        }

        if (res.summary) {
          setSummary({
            total_amount: res.summary.total_amount || 0,
            total_disputed_amount: res.summary.total_disputed_amount || 0,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load NCRP transactions:", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to load transactions.");
      setTransactions([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, file?.id, file?.case_id, caseId, page, pageSize, selectedSheet, debouncedSearch]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Download original workbook handler
  const handleDownloadWorkbook = async () => {
    if (!file?.id) return;
    try {
      setIsDownloading(true);
      const blob = await getNcrpFileView(file.id, caseId || file.case_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_filename || `NCRP_Workbook_${file.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Failed to download NCRP workbook:", err);
      alert("Unable to download the workbook. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-7xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 text-purple-700">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M10 9H8" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                  NCRP Statement
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {file.status || "COMPLETED"}
                </span>
              </div>
              <h3 className="mt-1 truncate text-base font-bold text-[#172554]" title={file.original_filename}>
                {file.original_filename}
              </h3>
              <p className="text-xs text-[#64748B]">
                {file.sheet_count || sheets.length || 1} worksheets • {file.imported_rows ?? total} imported rows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleDownloadWorkbook}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-[#059669] disabled:opacity-50"
              title="Download original uploaded Excel workbook"
            >
              {isDownloading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Excel
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              title="Close modal (Esc)"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-4 sm:px-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Matching Rows</p>
            <p className="mt-1 text-base font-extrabold text-[#172554]">{total.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Txn Amount</p>
            <p className="mt-1 text-base font-extrabold text-emerald-700">₹{formatIndianCurrency(summary.total_amount)}</p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-white p-3 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Disputed</p>
            <p className="mt-1 text-base font-extrabold text-amber-700">₹{formatIndianCurrency(summary.total_disputed_amount)}</p>
          </div>
          <div className="rounded-xl border border-purple-200/80 bg-white p-3 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Active Worksheet</p>
            <p className="mt-1 truncate text-base font-extrabold text-purple-700" title={selectedSheet}>
              {selectedSheet === "ALL" ? "All Sheets" : selectedSheet}
            </p>
          </div>
        </div>

        {/* CONTROLS (WORKSHEET SELECTOR & SEARCH) */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="ncrp-sheet-select" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Worksheet:
              </label>
              <select
                id="ncrp-sheet-select"
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Worksheets ({sheets.length})</option>
                {sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
            </div>

            {selectedSheet !== "ALL" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSheet("ALL");
                  setPage(1);
                }}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                View all sheets
              </button>
            )}
          </div>

          <div className="relative flex min-w-[260px] items-center">
            <svg
              className="absolute left-3 h-4 w-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search Ack No, Account, UTR, Bank, Layer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ERROR NOTICE */}
        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* TABLE CONTENT */}
        <div className="flex-1 overflow-auto bg-slate-50/30 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
              <p className="mt-4 text-xs font-medium text-[#64748B]">Loading NCRP transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 shadow-2xs">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#172554]">No transactions found</h4>
              <p className="mt-1 text-xs text-[#64748B]">
                {debouncedSearch
                  ? `No transactions match your search "${debouncedSearch}".`
                  : selectedSheet !== "ALL"
                  ? `Worksheet "${selectedSheet}" contains no imported transactions.`
                  : "No transactions were imported for this workbook."}
              </p>
              {(debouncedSearch || selectedSheet !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedSheet("ALL");
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Worksheet</th>
                    <th className="px-3 py-3 text-center">Row</th>
                    <th className="px-4 py-3">Ack No</th>
                    <th className="px-4 py-3">Account / Wallet ID</th>
                    <th className="px-4 py-3">Txn ID / UTR</th>
                    <th className="px-4 py-3">Txn Date</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3 text-right">Disputed (₹)</th>
                    <th className="px-4 py-3">Bank Name</th>
                    <th className="px-3 py-3 text-center">Layer</th>
                    <th className="px-3 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {transactions.map((tx) => {
                    const isExpanded = expandedRowId === tx.id;
                    const rawKeys = tx.raw_data ? Object.keys(tx.raw_data) : [];

                    return (
                      <React.Fragment key={tx.id}>
                        <tr className={`transition-colors hover:bg-slate-50/70 ${isExpanded ? "bg-purple-50/20" : ""}`}>
                          {/* Worksheet */}
                          <td className="px-4 py-3 font-semibold text-purple-900">
                            <span className="inline-block max-w-[150px] truncate rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800" title={tx.sheet_name}>
                              {tx.sheet_name}
                            </span>
                          </td>

                          {/* Row number */}
                          <td className="px-3 py-3 text-center text-slate-500 font-mono text-[11px]">
                            {tx.row_number}
                          </td>

                          {/* Acknowledgement No */}
                          <td className="px-4 py-3 font-mono text-[11px] text-[#172554] select-all">
                            {tx.acknowledgement_no || "-"}
                          </td>

                          {/* Account or Wallet ID */}
                          <td className="px-4 py-3 font-mono text-[11px] text-[#172554] select-all">
                            {tx.account_or_wallet_id || "-"}
                          </td>

                          {/* Transaction ID / UTR */}
                          <td className="px-4 py-3 font-mono text-[11px] text-[#172554] select-all">
                            <div>{tx.transaction_id_utr || "-"}</div>
                            {tx.source_utr && tx.source_utr !== tx.transaction_id_utr && (
                              <div className="text-[10px] text-slate-500 font-mono tracking-tight mt-0.5" title="Source / Incoming UTR">
                                <span className="text-slate-400 font-semibold">Src: </span>{tx.source_utr}
                              </div>
                            )}
                          </td>

                          {/* Transaction Date */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-[11px]">
                            {formatTransactionDate(tx.transaction_date)}
                          </td>

                          {/* Transaction Amount */}
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            ₹{formatIndianCurrency(tx.transaction_amount)}
                          </td>

                          {/* Disputed Amount */}
                          <td className="px-4 py-3 text-right font-bold text-amber-700">
                            {tx.disputed_amount ? `₹${formatIndianCurrency(tx.disputed_amount)}` : "-"}
                          </td>

                          {/* Bank Name */}
                          <td className="px-4 py-3 text-slate-700 max-w-[160px]" title={tx.bank_name || tx.action_taken_by_bank || ""}>
                            {tx.bank_name ? (
                              <span className="font-semibold text-slate-800 truncate block">{tx.bank_name}</span>
                            ) : tx.action_taken_by_bank ? (
                              <div className="truncate">
                                <span className="text-slate-700">{tx.action_taken_by_bank}</span>
                                <span className="block text-[9px] text-slate-400 font-normal italic">(Action Bank)</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* Layer */}
                          <td className="px-3 py-3 text-center">
                            {tx.layer ? (
                              <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {tx.layer}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* Toggle raw data */}
                          <td className="px-3 py-3 text-center">
                            {rawKeys.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : tx.id)}
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition shadow-2xs ${
                                  isExpanded
                                    ? "border-purple-300 bg-purple-100 text-purple-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                                }`}
                                title="Toggle worksheet-specific columns"
                              >
                                {isExpanded ? "Hide" : `+${rawKeys.length}`}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>

                        {/* EXPANDED WORKSHEET-SPECIFIC RAW DATA */}
                        {isExpanded && tx.raw_data && (
                          <tr className="bg-purple-50/30">
                            <td colSpan={11} className="px-6 py-4 border-y border-purple-100">
                              <div className="rounded-xl border border-purple-200/80 bg-white p-4 shadow-2xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800 mb-3 flex items-center gap-2">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6" />
                                  </svg>
                                  Worksheet-Specific Fields & Raw Data ({tx.sheet_name}, Row {tx.row_number})
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                                  {Object.entries(tx.raw_data).map(([key, value]) => (
                                    <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title={key}>
                                        {key}
                                      </p>
                                      <p className="mt-0.5 font-semibold text-[#172554] break-words select-all">
                                        {value !== null && value !== undefined && value !== "" ? String(value) : "-"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-[#64748B]">
              Showing{" "}
              <span className="font-bold text-slate-800">
                {total > 0 ? (page - 1) * pageSize + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-bold text-slate-800">
                {Math.min(page * pageSize, total)}
              </span>{" "}
              of <span className="font-bold text-slate-800">{total}</span> rows
            </p>

            <div className="flex items-center gap-1.5 ml-2">
              <label htmlFor="ncrp-page-size" className="text-[11px] text-slate-500">
                Per page:
              </label>
              <select
                id="ncrp-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Previous
            </button>

            <span className="text-xs font-bold text-slate-700 px-2">
              Page {totalPages > 0 ? page : 0} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
