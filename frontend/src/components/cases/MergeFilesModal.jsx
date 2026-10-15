import { useState, useMemo, useEffect } from "react";
import Swal from "sweetalert2";
import { mergeFiles } from "../../services/api/file";

function normalizeAccountNumber(acc) {
  if (!acc) return "";
  return String(acc).replace(/[\s\-_/]+/g, "").toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return String(dateStr);
  }
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  const num = Number(bytes);
  if (isNaN(num) || num <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  return `${(num / Math.pow(1024, i)).toFixed(1)} ${units[i] || "MB"}`;
}

export default function MergeFilesModal({
  isOpen,
  onClose,
  files = [],
  caseId,
  onMergeSuccess,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [mergedFilename, setMergedFilename] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setMergedFilename("");
      setError("");
      setIsMerging(false);
    }
  }, [isOpen]);

  // Classify eligible files
  const fileAnalysis = useMemo(() => {
    return files.map((file) => {
      const isMerged = Boolean(file.is_merged);
      const isSuperseded = Boolean(file.is_superseded);
      const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";
      const hasAccount = Boolean(file.account_number && String(file.account_number).trim());
      const normalizedAcc = normalizeAccountNumber(file.account_number);

      let ineligibilityReason = null;
      if (isMerged) {
        ineligibilityReason = "Already a merged statement";
      } else if (isSuperseded) {
        ineligibilityReason = "Already merged into another statement";
      } else if (!isCompleted) {
        ineligibilityReason = `Status is ${file.status || "PENDING"}`;
      } else if (!hasAccount) {
        ineligibilityReason = "No account number detected";
      }

      return {
        ...file,
        isEligible: !ineligibilityReason,
        ineligibilityReason,
        normalizedAcc,
      };
    });
  }, [files]);

  const eligibleFiles = useMemo(() => {
    return fileAnalysis.filter((f) => f.isEligible);
  }, [fileAnalysis]);

  const selectedFiles = useMemo(() => {
    const idSet = new Set(selectedIds);
    return fileAnalysis.filter((f) => idSet.has(f.id));
  }, [selectedIds, fileAnalysis]);

  // Pre-merge validation on selected files
  const validationState = useMemo(() => {
    if (selectedIds.length === 0) {
      return { isValid: false, message: "Select at least 2 bank statement files to merge." };
    }
    if (selectedIds.length === 1) {
      return { isValid: false, message: "Select at least 1 more file to merge." };
    }

    const accountNumbers = new Set(selectedFiles.map((f) => f.normalizedAcc).filter(Boolean));
    if (accountNumbers.size > 1) {
      const accList = Array.from(accountNumbers).join(", ");
      return {
        isValid: false,
        isAccountMismatch: true,
        message: `Selected files belong to different accounts (${accList}). Only statements for the same account can be merged.`,
      };
    }

    return { isValid: true, message: null };
  }, [selectedIds, selectedFiles]);

  const toggleFile = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError("");
  };

  const handleSelectAllEligible = () => {
    // If some eligible files share the first account, group by the dominant account number
    if (eligibleFiles.length === 0) return;

    // By default, select files sharing the account number of the first eligible file
    const targetAcc = eligibleFiles[0].normalizedAcc;
    const sameAccFiles = eligibleFiles.filter((f) => f.normalizedAcc === targetAcc);
    setSelectedIds(sameAccFiles.map((f) => f.id));
    setError("");
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setError("");
  };

  const handleMergeSubmit = async (e) => {
    e.preventDefault();
    if (!validationState.isValid || isMerging) return;

    setError("");

    // SweetAlert2 Confirmation Dialog
    const confirmResult = await Swal.fire({
      title: "Confirm Statement Merge",
      text: `Are you sure you want to merge ${selectedIds.length} statements? All source files and individual transactions will remain fully preserved.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Merge Files",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#334155",
      background: "#061411",
      color: "#f1f5f9",
      customClass: {
        popup: "border border-white/10 rounded-2xl",
      },
    });

    if (!confirmResult.isConfirmed) return;

    setIsMerging(true);
    try {
      const payload = {
        file_ids: selectedIds,
        merged_filename: mergedFilename.trim() || undefined,
      };

      const res = await mergeFiles(caseId, payload);

      await Swal.fire({
        title: "Statements Merged!",
        text: "The merged bank statement is now available in your documents and reports.",
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
        background: "#061411",
        color: "#f1f5f9",
        customClass: {
          popup: "border border-emerald-500/20 rounded-2xl",
        },
      });

      if (onMergeSuccess) {
        onMergeSuccess(res?.data || res);
      }
      onClose();
    } catch (err) {
      console.error("Merge error:", err);
      const msg = err?.response?.data?.detail || err?.message || "Failed to merge files.";
      setError(msg);
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        backgroundColor: "rgba(2, 6, 23, 0.75)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/[0.08] bg-[#020b09] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Merge Bank Statements</h2>
              <p className="text-xs text-slate-400">
                Combine multiple periodic statements for the same account into one unified file.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white transition disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleMergeSubmit} className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  {selectedIds.length} of {eligibleFiles.length} eligible selected
                </span>
                {selectedFiles.length > 0 && selectedFiles[0]?.account_number && (
                  <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-400 border border-emerald-400/20">
                    A/C: {selectedFiles[0].account_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllEligible}
                  disabled={isMerging || eligibleFiles.length === 0}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-40"
                >
                  Select Matching
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={isMerging || selectedIds.length === 0}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            {!validationState.isValid && validationState.message && (
              <div
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
                  validationState.isAccountMismatch
                    ? "border-red-500/20 bg-red-500/10 text-red-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                }`}
              >
                <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{validationState.message}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Files List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {fileAnalysis.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No files uploaded for this case yet.
                </div>
              ) : (
                fileAnalysis.map((file) => {
                  const isSelected = selectedIds.includes(file.id);
                  const isEligible = file.isEligible;

                  return (
                    <div
                      key={file.id}
                      onClick={() => isEligible && toggleFile(file.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                        !isEligible
                          ? "border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed"
                          : isSelected
                          ? "border-emerald-400/40 bg-emerald-400/[0.06] cursor-pointer"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15] cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isEligible || isMerging}
                          onChange={() => {}} // Handled by container onClick
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 disabled:opacity-40"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-200">
                            {file.original_filename}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                            {file.account_number ? (
                              <span className="font-mono text-emerald-400">
                                A/C: {file.account_number}
                              </span>
                            ) : (
                              <span className="text-amber-400">No A/C #</span>
                            )}
                            {file.bank_name && (
                              <>
                                <span>•</span>
                                <span>{file.bank_name}</span>
                              </>
                            )}
                            {(file.statement_start_date || file.statement_end_date) && (
                              <>
                                <span>•</span>
                                <span>
                                  {formatDate(file.statement_start_date)} to {formatDate(file.statement_end_date)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {!isEligible ? (
                          <span className="inline-block rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700/50">
                            {file.ineligibilityReason}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatFileSize(file.file_size)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Custom Merged Filename Input */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Merged Statement Filename <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={mergedFilename}
                onChange={(e) => setMergedFilename(e.target.value)}
                disabled={isMerging}
                placeholder="e.g. Merged_FY23_FY25_Statement.pdf"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Leave blank to automatically name by account number and statement date span.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-6 py-4 bg-white/[0.01]">
            <button
              type="button"
              onClick={onClose}
              disabled={isMerging}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validationState.isValid || isMerging}
              className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-semibold text-[#03100d] hover:bg-emerald-300 transition shadow-[0_8px_25px_rgba(52,211,153,0.15)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isMerging ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  <span>Merging Files...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>Merge {selectedIds.length > 0 ? `(${selectedIds.length}) Files` : "Files"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
