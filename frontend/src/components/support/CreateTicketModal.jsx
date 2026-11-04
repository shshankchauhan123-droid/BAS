import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { createTicket } from "../../services/api/support";

const CATEGORIES = [
  "Technical Issue",
  "Data/Report Issue",
  "Account/Access",
  "Feature Request",
  "Other",
];

const PRIORITIES = [
  { value: "low", label: "Low", tone: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "medium", label: "Medium", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "high", label: "High", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "critical", label: "Critical", tone: "bg-rose-50 text-rose-700 border-rose-200" },
];

const MODULES = [
  "Dashboard",
  "Bank Statement",
  "NCRP Reports",
  "Masters",
  "Upload",
  "Other",
];

const ALLOWED_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".csv",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileTypeBadge = (filename) => {
  if (!filename) return "FILE";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "IMG";
  if (["xlsx", "xls", "csv"].includes(ext)) return "EXCEL";
  if (["pdf"].includes(ext)) return "PDF";
  if (["doc", "docx", "txt"].includes(ext)) return "DOC";
  return ext?.toUpperCase() || "FILE";
};

export default function CreateTicketModal({ isOpen, onClose, onSuccess }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Technical Issue");
  const [priority, setPriority] = useState("medium");
  const [relatedModule, setRelatedModule] = useState("Dashboard");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const validateFile = (file) => {
    if (!file) return false;

    if (file.size > MAX_FILE_SIZE) {
      setAttachmentError(`File size (${formatFileSize(file.size)}) exceeds the maximum 10 MB limit.`);
      return false;
    }

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setAttachmentError(
        `Unsupported file type "${ext}". Accepted formats: Excel (.xlsx, .xls, .csv), Documents (.pdf, .doc, .docx, .txt), Images (.png, .jpg, .jpeg, .gif, .webp).`
      );
      return false;
    }

    setAttachmentError("");
    return true;
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (validateFile(file)) {
      setAttachment(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const validate = () => {
    const errors = {};
    if (!subject.trim()) {
      errors.subject = "Subject is required.";
    } else if (subject.trim().length < 3) {
      errors.subject = "Subject must be at least 3 characters.";
    } else if (subject.trim().length > 255) {
      errors.subject = "Subject cannot exceed 255 characters.";
    }

    if (!description.trim()) {
      errors.description = "Description is required.";
    } else if (description.trim().length < 5) {
      errors.description = "Description must provide at least 5 characters.";
    }

    if (attachment && attachment.size > MAX_FILE_SIZE) {
      errors.attachment = "Attachment must be less than 10 MB.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("subject", subject.trim());
      formData.append("category", category);
      formData.append("priority", priority);
      if (relatedModule) formData.append("related_module", relatedModule);
      formData.append("description", description.trim());
      if (attachment) {
        formData.append("attachment", attachment);
      }

      const res = await createTicket(formData);

      Swal.fire({
        icon: "success",
        title: "Ticket Submitted!",
        text: `Your ticket #${res.ticket_number || "new"} has been created successfully.`,
        timer: 2500,
        showConfirmButton: false,
      });

      // Reset
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCategory("Technical Issue");
      setRelatedModule("Dashboard");
      setAttachment(null);
      setAttachmentError("");
      setFormErrors({});

      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      console.error("Failed to submit ticket:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to create support ticket.";
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 flex flex-col w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-950">Create Support Ticket</h3>
              <p className="text-xs text-slate-500">Report an issue or submit an inquiry to the BAS team</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (formErrors.subject) setFormErrors((p) => ({ ...p, subject: null }));
                }}
                placeholder="e.g., Bank statement parsing failed on SBI statement"
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  formErrors.subject ? "border-rose-400 bg-rose-50/20" : "border-slate-200 bg-white"
                }`}
              />
              {formErrors.subject && (
                <p className="mt-1 text-xs text-rose-500 font-medium">{formErrors.subject}</p>
              )}
            </div>

            {/* Category & Priority grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Priority <span className="text-rose-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Related Module */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Related Module (Optional)
              </label>
              <select
                value={relatedModule}
                onChange={(e) => setRelatedModule(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (formErrors.description) setFormErrors((p) => ({ ...p, description: null }));
                }}
                placeholder="Describe the issue, steps to reproduce, or specific data context..."
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  formErrors.description ? "border-rose-400 bg-rose-50/20" : "border-slate-200 bg-white"
                }`}
              />
              {formErrors.description && (
                <p className="mt-1 text-xs text-rose-500 font-medium">{formErrors.description}</p>
              )}
            </div>

            {/* Attachment (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Attachment (Optional)
                </label>
                <span className="text-[11px] font-medium text-slate-400">
                  Max size: 10 MB
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
                className="hidden"
              />

              {!attachment ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50/50"
                      : attachmentError
                      ? "border-rose-300 bg-rose-50/20 hover:border-rose-400"
                      : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    <span className="text-emerald-700 underline font-bold">Click to browse</span> or drag and drop a file
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 text-center">
                    Excel (.xlsx, .xls, .csv), Docs (.pdf, .doc, .docx, .txt), Images (.png, .jpg, .jpeg, .gif, .webp)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs">
                      {getFileTypeBadge(attachment.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate" title={attachment.name}>
                        {attachment.name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        setAttachmentError("");
                      }}
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {attachmentError && (
                <p className="mt-1.5 text-xs text-rose-500 font-medium">{attachmentError}</p>
              )}
            </div>
          </div>

          {/* Footer Actions (Pinned at Bottom) */}
          <div className="flex shrink-0 items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
