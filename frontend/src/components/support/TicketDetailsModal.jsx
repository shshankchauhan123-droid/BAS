import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import {
  addAdminTicketReply,
  addMyTicketReply,
  downloadAdminTicketAttachment,
  downloadMyTicketAttachment,
  getAdminTicketDetails,
  getMyTicketDetails,
  updateAdminTicket,
} from "../../services/api/support";

const STATUS_CONFIG = {
  open: { label: "Open", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_progress: { label: "In Progress", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  waiting_user: { label: "Waiting for User", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  closed: { label: "Closed", bg: "bg-slate-100 text-slate-700 border-slate-300" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", bg: "bg-slate-100 text-slate-600 border-slate-200" },
  medium: { label: "Medium", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "High", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  critical: { label: "Critical", bg: "bg-rose-50 text-rose-700 border-rose-200" },
};

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

export default function TicketDetailsModal({
  isOpen,
  onClose,
  ticketId,
  isAdmin = false,
  isReadOnly = false,
  onUpdated,
}) {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isClient = userRole === "client_admin";
  const effectiveReadOnly = isReadOnly || (!isAdmin && isClient);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [downloadingAttachment, setDownloadingAttachment] = useState(false);

  // Admin controls
  const [newStatus, setNewStatus] = useState("");
  const [adminResolutionNote, setAdminResolutionNote] = useState("");
  const [updatingTicket, setUpdatingTicket] = useState(false);

  useEffect(() => {
    if (!isOpen || !ticketId) {
      setTicket(null);
      setError("");
      setReplyText("");
      return;
    }

    let isMounted = true;
    async function fetchDetails() {
      try {
        setLoading(true);
        setError("");
        const res = isAdmin
          ? await getAdminTicketDetails(ticketId)
          : await getMyTicketDetails(ticketId);

        if (isMounted) {
          const tkt = res?.data ?? res;
          setTicket(tkt);
          setNewStatus(tkt.status || "open");
          setAdminResolutionNote(tkt.admin_response || "");
        }
      } catch (err) {
        console.error("Failed to fetch ticket details:", err);
        const errMsg = err?.response?.data?.detail || err?.message || "Failed to load ticket details.";
        if (isMounted) {
          setError(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, ticketId, isAdmin]);

  if (!isOpen) return null;

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (effectiveReadOnly || !replyText.trim()) return;

    try {
      setSubmittingReply(true);
      if (isAdmin) {
        await addAdminTicketReply(ticketId, {
          message: replyText.trim(),
          is_internal: isInternal,
        });
      } else {
        await addMyTicketReply(ticketId, replyText.trim());
      }

      setReplyText("");
      setIsInternal(false);

      // Refresh ticket details
      const refreshRes = isAdmin
        ? await getAdminTicketDetails(ticketId)
        : await getMyTicketDetails(ticketId);
      const updatedTkt = refreshRes?.data ?? refreshRes;
      setTicket(updatedTkt);
      setNewStatus(updatedTkt.status || "open");

      if (onUpdated) onUpdated(updatedTkt);
    } catch (err) {
      console.error("Failed to post reply:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to post reply.";
      Swal.fire({
        icon: "error",
        title: "Reply Failed",
        text: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleAdminUpdate = async (statusOverride = null) => {
    try {
      setUpdatingTicket(true);
      const payload = {
        status: statusOverride || newStatus,
        admin_response: adminResolutionNote.trim() || null,
      };

      const res = await updateAdminTicket(ticketId, payload);
      const updatedTkt = res?.data ?? res;
      setTicket(updatedTkt);
      setNewStatus(updatedTkt.status);

      Swal.fire({
        icon: "success",
        title: "Ticket Updated",
        text: `Ticket #${updatedTkt.ticket_number} updated to status: ${updatedTkt.status.toUpperCase()}`,
        timer: 2000,
        showConfirmButton: false,
      });

      if (onUpdated) onUpdated(updatedTkt);
    } catch (err) {
      console.error("Failed to update ticket:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to update ticket.";
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
      });
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleDownloadAttachment = async () => {
    if (!ticket?.id) return;
    try {
      setDownloadingAttachment(true);
      const fname =
        ticket.attachment_filename ||
        `ticket_${ticket.ticket_number || ticket.id}_attachment`;
      if (isAdmin) {
        await downloadAdminTicketAttachment(ticket.id, fname);
      } else {
        await downloadMyTicketAttachment(ticket.id, fname);
      }
    } catch (err) {
      console.error("Failed to download attachment:", err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to download attachment.";
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
      });
    } finally {
      setDownloadingAttachment(false);
    }
  };

  const statusBadge = STATUS_CONFIG[ticket?.status] || {
    label: ticket?.status || "Open",
    bg: "bg-slate-100 text-slate-700 border-slate-300",
  };

  const priorityBadge = PRIORITY_CONFIG[ticket?.priority] || {
    label: ticket?.priority || "Medium",
    bg: "bg-slate-100 text-slate-700 border-slate-300",
  };

  const normalizeStatus = (status) =>
    String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  const isReplyDisabled = normalizeStatus(ticket?.status) === "closed";

  const formatIST = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900 ring-1 ring-blue-200">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {ticket?.ticket_number || "Ticket Details"}
                </span>
                {ticket && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.bg}`}
                  >
                    {statusBadge.label}
                  </span>
                )}
                {ticket && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${priorityBadge.bg}`}
                  >
                    {priorityBadge.label}
                  </span>
                )}
              </div>
              <h2 className="text-base font-extrabold text-blue-950 line-clamp-1 mt-0.5">
                {ticket?.subject || (error ? "Error Loading Ticket" : "Loading...")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="h-8 w-8 animate-spin text-emerald-600 mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm font-semibold">Loading ticket data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-3 ring-1 ring-rose-200">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {String(error).toLowerCase().includes("permission") ||
                String(error).toLowerCase().includes("access") ||
                String(error).toLowerCase().includes("unauthorized")
                  ? "Access Denied"
                  : "Unable to Load Ticket"}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mb-5">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          ) : ticket ? (
            <>
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Category</span>
                  <p className="font-bold text-slate-800 mt-0.5">{ticket.category}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Related Module</span>
                  <p className="font-bold text-slate-800 mt-0.5">{ticket.related_module || "General"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Created On</span>
                  <p className="font-bold text-slate-800 mt-0.5">{formatIST(ticket.created_at)}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Last Activity</span>
                  <p className="font-bold text-slate-800 mt-0.5">{formatIST(ticket.updated_at)}</p>
                </div>

                {/* Creator info for Client Admin or Admin */}
                {(isAdmin || effectiveReadOnly || Boolean(ticket.user_name)) && (
                  <div>
                    <span className="text-slate-400 font-medium">Submitted By</span>
                    <p className="font-bold text-slate-800 mt-0.5 truncate" title={ticket.user_name}>
                      {ticket.user_name || "User"} {ticket.user_email ? `(${ticket.user_email})` : ""}
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div>
                    <span className="text-slate-400 font-medium">Client / Tenant</span>
                    <p className="font-bold text-blue-950 mt-0.5">{ticket.client_name || "Direct Tenant"}</p>
                  </div>
                )}

                {(isAdmin || ticket.resolved_at) && (
                  <div>
                    <span className="text-slate-400 font-medium">Resolved At</span>
                    <p className="font-bold text-slate-800 mt-0.5">{formatIST(ticket.resolved_at)}</p>
                  </div>
                )}

                {(isAdmin || ticket.closed_at) && (
                  <div>
                    <span className="text-slate-400 font-medium">Closed At</span>
                    <p className="font-bold text-slate-800 mt-0.5">{formatIST(ticket.closed_at)}</p>
                  </div>
                )}
              </div>

              {/* Description Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Initial Problem Description
                </h4>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </div>

              {/* Attachments Section if present */}
              {(ticket.has_attachment || ticket.attachment_filename) && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-slate-500" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Attachments
                  </h4>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 font-black text-xs ring-1 ring-blue-200">
                        {getFileTypeBadge(ticket.attachment_filename)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate max-w-sm sm:max-w-md" title={ticket.attachment_filename}>
                          {ticket.attachment_filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>{formatFileSize(ticket.attachment_size)}</span>
                          {ticket.attachment_mime && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[180px]">{ticket.attachment_mime}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingAttachment}
                      onClick={handleDownloadAttachment}
                      className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition disabled:opacity-50"
                    >
                      {downloadingAttachment ? (
                        <>
                          <svg className="h-4 w-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-600" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>Download Attachment</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Resolution Note if present */}
              {ticket.admin_response && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-700" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Admin Resolution Summary
                    </h4>
                  </div>
                  <p className="text-sm text-emerald-950 whitespace-pre-wrap leading-relaxed">
                    {ticket.admin_response}
                  </p>
                </div>
              )}

              {/* Super Admin Control Panel */}
              {isAdmin && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-950 flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-blue-700" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Super Admin Triage Controls
                    </h4>
                    <div className="flex items-center gap-2">
                      {ticket.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdate("resolved")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      {ticket.status !== "closed" && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdate("closed")}
                          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                        >
                          Close Ticket
                        </button>
                      )}
                      {(ticket.status === "resolved" || ticket.status === "closed") && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdate("in_progress")}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                        >
                          Reopen Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Update Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full sm:w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_user">Waiting for User</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Official Resolution Note (User-Facing)
                    </label>
                    <textarea
                      rows={2}
                      value={adminResolutionNote}
                      onChange={(e) => setAdminResolutionNote(e.target.value)}
                      placeholder="Add summary of steps taken or guidance for the user..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={updatingTicket}
                      onClick={() => handleAdminUpdate()}
                      className="rounded-xl bg-blue-900 px-4 py-2 text-xs font-bold text-white hover:bg-blue-950 transition disabled:opacity-60"
                    >
                      {updatingTicket ? "Saving changes..." : "Save Triage Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Activity &amp; Conversation Trail</span>
                  <span className="font-normal normal-case text-slate-400">
                    {ticket.activities?.length || 0} events
                  </span>
                </h4>

                <div className="space-y-3">
                  {ticket.activities && ticket.activities.length > 0 ? (
                    ticket.activities.map((act) => {
                      const isInternalNote = act.is_internal;
                      const isUserAuthor = act.author_role === "user";
                      return (
                        <div
                          key={act.id}
                          className={`rounded-xl border p-3.5 transition-all text-xs ${
                            isInternalNote
                              ? "border-amber-300 bg-amber-50/70 text-amber-950"
                              : isUserAuthor
                              ? "border-slate-200 bg-white text-slate-800"
                              : "border-blue-200 bg-blue-50/40 text-blue-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{act.author_name || "System"}</span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                                {act.author_role}
                              </span>
                              {isInternalNote && (
                                <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
                                  Internal Note (Admins Only)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {formatIST(act.created_at)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{act.message}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic">No replies yet.</p>
                  )}
                </div>
              </div>

              {/* Reply Form / Disabled State / Read-Only Client State */}
              <div className="border-t border-slate-200 pt-4">
                {effectiveReadOnly ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-blue-700 shrink-0" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>Client Read-Only Access</span>
                    </div>
                    <p className="text-blue-800/90 leading-relaxed">
                      You are viewing this support ticket in read-only mode. Ticket creation, replies, and status updates are managed by the submitting user and Super Admins.
                    </p>
                  </div>
                ) : isReplyDisabled ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-100 p-3.5 text-xs text-slate-700 flex items-center gap-2.5">
                      <svg
                        className="h-4 w-4 shrink-0 text-slate-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
                        <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
                      </svg>
                      <span className="font-semibold">
                        This ticket is closed. Replies are disabled.
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      disabled
                      readOnly
                      placeholder="Replies are disabled for this ticket."
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-400 cursor-not-allowed select-none resize-none focus:outline-none"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-400 cursor-not-allowed select-none"
                      >
                        {isAdmin ? "Reply Disabled" : "Send Reply"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePostReply} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        {isAdmin ? "Add Response or Note" : "Reply to Ticket"}
                      </label>
                      {isAdmin && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-800">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                          />
                          Make this an internal admin-only note
                        </label>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isInternal
                          ? "Add an internal note visible only to Super Admins..."
                          : "Type your reply here..."
                      }
                      className={`w-full rounded-xl border p-3 text-xs text-slate-800 focus:outline-none ${
                        isInternal ? "border-amber-300 bg-amber-50/20" : "border-slate-200 bg-white"
                      }`}
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingReply || !replyText.trim()}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${
                          isInternal
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {submittingReply ? "Posting..." : isInternal ? "Post Internal Note" : "Send Reply"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
