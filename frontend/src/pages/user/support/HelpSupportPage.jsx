import { useCallback, useEffect, useState } from "react";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import CreateTicketModal from "../../../components/support/CreateTicketModal";
import TicketDetailsModal from "../../../components/support/TicketDetailsModal";
import { getMyTickets, getMyTicketsSummary } from "../../../services/api/support";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_user", label: "Waiting for User" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_BADGES = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  waiting_user: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-purple-50 text-purple-700 border-purple-200",
  closed: "bg-slate-100 text-slate-700 border-slate-300",
};

const PRIORITY_BADGES = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function HelpSupportPage() {
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, ticketsRes] = await Promise.all([
        getMyTicketsSummary(),
        getMyTickets({
          search,
          status: statusFilter,
          priority: priorityFilter,
          page,
          page_size: 10,
        }),
      ]);

      setSummary(summaryRes?.data ?? summaryRes ?? {});
      const listData = ticketsRes?.data ?? [];
      setTickets(Array.isArray(listData) ? listData : []);
      setTotalPages(ticketsRes?.total_pages || 1);
      setTotalTickets(ticketsRes?.total || 0);
    } catch (err) {
      console.error("Failed to load user support tickets:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to load support tickets.";
      setError(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDetails = (id) => {
    setSelectedTicketId(id);
    setDetailsModalOpen(true);
  };

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
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <UserNavbar />

      <main className="relative flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-blue-950 truncate">
                  Help &amp; Support
                </h1>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Create support tickets and track the resolution of your issues.
              </p>
            </div>

            <div className="flex shrink-0 sm:self-center">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition whitespace-nowrap min-w-[140px] w-full sm:w-auto"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Create Ticket</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Tickets</span>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {summary.total.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Open */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700">Open Tickets</span>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                {summary.open.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${summary.total ? (summary.open / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-blue-700">In Progress</span>
              <p className="mt-2 text-2xl font-black text-blue-700">
                {summary.in_progress.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${summary.total ? (summary.in_progress / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Resolved / Closed */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-purple-700">Resolved / Closed</span>
              <p className="mt-2 text-2xl font-black text-purple-700">
                {(summary.resolved + summary.closed).toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${
                      summary.total
                        ? ((summary.resolved + summary.closed) / summary.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 bg-gradient-to-r from-slate-50/50 to-white">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by ticket ID or subject..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Status and Priority Dropdowns */}
              <div className="flex items-center gap-2.5">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  title="Refresh"
                  onClick={loadData}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <svg className="inline h-6 w-6 animate-spin text-emerald-600 mb-2" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <p className="font-semibold">Loading support tickets...</p>
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M8 12h8M12 8v8" />
                            </svg>
                          </div>
                          <p className="text-sm font-bold text-slate-700">No support tickets found</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            {search || statusFilter || priorityFilter
                              ? "Try adjusting your search criteria or clear active filters."
                              : "You haven't submitted any support requests yet. Click 'Create Ticket' above to get started."}
                          </p>
                          {!search && !statusFilter && !priorityFilter && (
                            <button
                              type="button"
                              onClick={() => setCreateModalOpen(true)}
                              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                            >
                              Create First Ticket
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => {
                      const stBadge = STATUS_BADGES[t.status] || "bg-slate-100 text-slate-700 border-slate-300";
                      const prBadge = PRIORITY_BADGES[t.priority] || "bg-slate-100 text-slate-600 border-slate-200";

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                          onClick={() => handleOpenDetails(t.id)}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-blue-950">
                            {t.ticket_number}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{t.subject}</span>
                              {t.has_attachment && (
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  aria-label="Has attachment"
                                >
                                  <title>Has attachment</title>
                                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {t.category}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${prBadge}`}>
                              {t.priority.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {formatIST(t.created_at)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {formatIST(t.updated_at)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${stBadge}`}>
                              {t.status.replaceAll("_", " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(t.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/40 text-xs text-slate-500">
                <span>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalTickets} tickets)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <UserFooter />

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Ticket Details Drawer / Modal */}
      <TicketDetailsModal
        isOpen={detailsModalOpen}
        ticketId={selectedTicketId}
        isAdmin={false}
        onClose={() => setDetailsModalOpen(false)}
        onUpdated={() => loadData()}
      />
    </div>
  );
}
