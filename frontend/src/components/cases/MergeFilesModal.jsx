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
    return isNaN(d.getTime())
      ? String(dateStr)
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
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

  // Classify eligible files: Existing merged files that are NOT superseded are fully eligible!
  const fileAnalysis = useMemo(() => {
    return files.map((file) => {
      const isMerged = Boolean(file.is_merged);
      const isSuperseded = Boolean(file.is_superseded);
      const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";
      const hasAccount = Boolean(
        file.account_number && String(file.account_number).trim()
      );
      const normalizedAcc = normalizeAccountNumber(file.account_number);

      let ineligibilityReason = null;
      if (isSuperseded) {
        ineligibilityReason = "Already merged into another statement";
      } else if (!isCompleted) {
        ineligibilityReason =
          String(file.status || "").toUpperCase() === "FAILED"
            ? "Processing failed"
            : `Processing status: ${file.status || "PENDING"}`;
      } else if (!hasAccount) {
        ineligibilityReason = "No account number detected";
      }

      return {
        ...file,
        isEligible: !ineligibilityReason,
        ineligibilityReason,
        normalizedAcc,
        isMerged,
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
      return {
        isValid: false,
        message: "Select at least 2 bank statement files to merge.",
      };
    }
    if (selectedIds.length === 1) {
      return {
        isValid: false,
        message: "Select at least 1 more statement file for this account.",
      };
    }

    const accountNumbers = new Set(
      selectedFiles.map((f) => f.normalizedAcc).filter(Boolean)
    );
    if (accountNumbers.size > 1) {
      const accList = Array.from(accountNumbers).join(", ");
      return {
        isValid: false,
        isAccountMismatch: true,
        message: `Selected files belong to different accounts (${accList}). Only statements for the same bank account can be merged.`,
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
    if (eligibleFiles.length === 0) return;

    // If an account is already selected, filter by that account; else use the first eligible file's account
    const targetAcc =
      selectedFiles.length > 0 && selectedFiles[0].normalizedAcc
        ? selectedFiles[0].normalizedAcc
        : eligibleFiles[0].normalizedAcc;

    const sameAccFiles = eligibleFiles.filter(
      (f) => f.normalizedAcc === targetAcc
    );
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

    // SweetAlert2 Confirmation Dialog in BAS Light Theme
    const confirmResult = await Swal.fire({
      title: "Confirm Statement Merge",
      text: `Are you sure you want to merge ${selectedIds.length} statements? All source files and individual transactions will remain fully preserved.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Merge Statements",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748B",
      background: "#FFFFFF",
      color: "#172554",
      customClass: {
        popup: "border border-slate-200 rounded-2xl shadow-2xl",
        title: "text-[#172554] font-bold text-lg",
        htmlContainer: "text-slate-600 text-xs sm:text-sm",
        confirmButton: "rounded-xl font-bold px-4 py-2.5 text-xs shadow-sm",
        cancelButton: "rounded-xl font-semibold px-4 py-2.5 text-xs shadow-sm",
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
        text: "The unified bank statement is now ready and available for analysis and reports.",
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
        background: "#FFFFFF",
        color: "#172554",
        customClass: {
          popup: "border border-emerald-200 rounded-2xl shadow-xl",
          title: "text-[#172554] font-bold",
          htmlContainer: "text-slate-600 text-xs",
        },
      });

      if (onMergeSuccess) {
        onMergeSuccess(res?.data || res);
      }
      onClose();
    } catch (err) {
      console.error("Merge error:", err);
      const msg =
        err?.response?.data?.detail || err?.message || "Failed to merge statements.";
      setError(msg);
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-5 bg-[#F8FAFC]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[#059669] shadow-2xs shrink-0">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#172554]">
                Merge Bank Statements
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Combine multiple statements for the same bank account into one unified file.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            aria-label="Close dialog"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50 cursor-pointer"
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
        <form onSubmit={handleMergeSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Selection Summary Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-[#172554]">
                  {selectedIds.length} of {eligibleFiles.length} eligible selected
                </span>
                {selectedFiles.length > 0 && selectedFiles[0]?.account_number && (
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-emerald-800 border border-emerald-200">
                    A/C: {selectedFiles[0].account_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllEligible}
                  disabled={isMerging || eligibleFiles.length === 0}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#172554] shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Select Matching
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={isMerging || selectedIds.length === 0}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#64748B] shadow-2xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            {!validationState.isValid && validationState.message && (
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium shadow-2xs ${
                  validationState.isAccountMismatch
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0 mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{validationState.message}</span>
              </div>
            )}

            {validationState.isValid && selectedFiles.length >= 2 && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  Ready to merge {selectedFiles.length} statements for account {selectedFiles[0]?.account_number || ""}.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 font-medium shadow-2xs">
                <svg
                  className="h-4 w-4 shrink-0 mt-0.5 text-rose-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
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
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {fileAnalysis.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl">
                  No statement files uploaded for this case yet.
                </div>
              ) : (
                fileAnalysis.map((file) => {
                  const isSelected = selectedIds.includes(file.id);
                  const isEligible = file.isEligible;
                  const isMerged = Boolean(file.is_merged);

                  return (
                    <div
                      key={file.id}
                      onClick={() => isEligible && toggleFile(file.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl p-3 transition-all select-none ${
                        !isEligible
                          ? "border border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "border-2 border-[#059669] bg-emerald-50/45 shadow-xs cursor-pointer"
                          : "border border-[#E2E8F0] bg-white hover:border-emerald-300 hover:bg-emerald-50/20 shadow-2xs cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isEligible || isMerging}
                          onChange={() => {}} // Handled by container onClick
                          className="h-4 w-4 rounded border-slate-300 text-[#059669] accent-[#059669] focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`truncate text-xs font-bold ${
                                isSelected ? "text-[#172554]" : "text-slate-800"
                              }`}
                            >
                              {file.original_filename}
                            </p>
                            {isMerged && (
                              <span className="rounded-md bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 shrink-0 uppercase tracking-wider">
                                Merged
                              </span>
                            )}
                            {!isMerged && isEligible && (
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 shrink-0 uppercase tracking-wider">
                                Original
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                            {file.account_number ? (
                              <span className="font-mono font-bold text-[#059669]">
                                A/C: {file.account_number}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold">
                                No A/C #
                              </span>
                            )}
                            {file.bank_name && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-700">{file.bank_name}</span>
                              </>
                            )}
                            {(file.statement_start_date || file.statement_end_date) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>
                                  {formatDate(file.statement_start_date)} to{" "}
                                  {formatDate(file.statement_end_date)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {!isEligible ? (
                          <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 border border-slate-200">
                            {file.ineligibilityReason}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono font-medium">
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
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-[#172554] mb-1.5">
                Merged Statement Filename{" "}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={mergedFilename}
                onChange={(e) => setMergedFilename(e.target.value)}
                disabled={isMerging}
                placeholder="e.g. Merged_FY23_FY25_Statement.pdf"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#172033] placeholder-slate-400 focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-[#64748B]">
                Leave blank to automatically name by account number and statement date span.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] px-6 py-4 bg-[#F8FAFC]">
            <button
              type="button"
              onClick={onClose}
              disabled={isMerging}
              className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validationState.isValid || isMerging}
              className="flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-5 py-2.5 text-xs font-bold text-white transition shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {isMerging ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Merging Statements...</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                    />
                  </svg>
                  <span>
                    Merge{" "}
                    {selectedIds.length > 0
                      ? `(${selectedIds.length}) Statements`
                      : "Statements"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
