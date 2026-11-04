import { useCallback, useEffect, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import TicketDetailsModal from "../../components/support/TicketDetailsModal";
import { getClients } from "../../services/api/clients";
import { getAdminTickets, getAdminTicketsSummary } from "../../services/api/support";

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

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "Technical Issue", label: "Technical Issue" },
  { value: "Data/Report Issue", label: "Data/Report Issue" },
  { value: "Account/Access", label: "Account/Access" },
  { value: "Feature Request", label: "Feature Request" },
  { value: "Other", label: "Other" },
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

export default function SuperAdminSupportPage() {
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    waiting_user: 0,
    resolved: 0,
    closed: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  // Modal
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Load clients list for filtering
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await getClients();
        const clientList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setClients(clientList);
      } catch (err) {
        console.warn("Could not load clients for support filter:", err);
      }
    }
    fetchClients();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, ticketsRes] = await Promise.all([
        getAdminTicketsSummary(),
        getAdminTickets({
          search,
          client_id: clientFilter ? parseInt(clientFilter, 10) : undefined,
          status: statusFilter,
          priority: priorityFilter,
          category: categoryFilter,
          sort_by: sortBy,
          sort_order: sortOrder,
          page,
          page_size: 15,
        }),
      ]);

      setSummary(summaryRes?.data ?? summaryRes ?? {});
      const listData = ticketsRes?.data ?? [];
      setTickets(Array.isArray(listData) ? listData : []);
      setTotalPages(ticketsRes?.total_pages || 1);
      setTotalTickets(ticketsRes?.total || 0);
    } catch (err) {
      console.error("Failed to load admin support tickets:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to load admin tickets.";
      setError(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  }, [search, clientFilter, statusFilter, priorityFilter, categoryFilter, sortBy, sortOrder, page]);

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-900 ring-1 ring-blue-200">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="9" y1="10" x2="15" y2="10" />
                    <line x1="12" y1="7" x2="12" y2="13" />
                  </svg>
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-blue-950">
                  Support Ticket Management
                </h1>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  Super Admin Control Room
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Triage, assign, resolve, and manage support tickets submitted by all client organizations.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" />
              </svg>
              <span>Refresh Tickets</span>
            </button>
          </div>

          {/* 6 KPI Cards for Super Admin */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Total Tickets</span>
              <p className="mt-1.5 text-2xl font-black text-blue-950">
                {summary.total.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Open */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700">Open</span>
              <p className="mt-1.5 text-2xl font-black text-emerald-700">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-blue-700">In Progress</span>
              <p className="mt-1.5 text-2xl font-black text-blue-700">
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

            {/* Waiting for User */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-amber-700">Waiting for User</span>
              <p className="mt-1.5 text-2xl font-black text-amber-700">
                {summary.waiting_user.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${summary.total ? (summary.waiting_user / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Resolved */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-purple-700">Resolved</span>
              <p className="mt-1.5 text-2xl font-black text-purple-700">
                {summary.resolved.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${summary.total ? (summary.resolved / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Closed */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-700">Closed</span>
              <p className="mt-1.5 text-2xl font-black text-slate-700">
                {summary.closed.toLocaleString("en-IN")}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{
                    width: `${summary.total ? (summary.closed / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Filter Row 1: Search & Dropdowns */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative sm:col-span-2">
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
                    placeholder="Search by ticket ID, client, user, subject..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Client Company Filter */}
                <div>
                  <select
                    value={clientFilter}
                    onChange={(e) => {
                      setClientFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="">All Companies / Clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <select
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter Row 2: Category & Sorting */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2.5">
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={`${sortBy}_${sortOrder}`}
                    onChange={(e) => {
                      const [sb, so] = e.target.value.split("_");
                      setSortBy(sb);
                      setSortOrder(so);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="created_at_desc">Newest First (Created Date)</option>
                    <option value="created_at_asc">Oldest First (Created Date)</option>
                    <option value="updated_at_desc">Recently Updated</option>
                    <option value="priority_desc">Priority (High to Low)</option>
                  </select>
                </div>

                {(search || clientFilter || statusFilter || priorityFilter || categoryFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setClientFilter("");
                      setStatusFilter("");
                      setPriorityFilter("");
                      setCategoryFilter("");
                      setPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 transition"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* Tickets Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3.5">Ticket ID</th>
                    <th className="py-3 px-3.5">Client / Company</th>
                    <th className="py-3 px-3.5">User Details</th>
                    <th className="py-3 px-3.5">Subject</th>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3.5">Priority</th>
                    <th className="py-3 px-3.5">Created Date</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Assigned Admin</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <svg className="inline h-6 w-6 animate-spin text-blue-900 mb-2" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <p className="font-semibold">Loading all tenant tickets...</p>
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400">
                        <p className="text-sm font-bold text-slate-700">No support tickets match the current criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => {
                      const stBadge = STATUS_BADGES[t.status] || "bg-slate-100 text-slate-700 border-slate-300";
                      const prBadge = PRIORITY_BADGES[t.priority] || "bg-slate-100 text-slate-600 border-slate-200";

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-blue-50/20 transition-colors group cursor-pointer"
                          onClick={() => handleOpenDetails(t.id)}
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-blue-950">
                            {t.ticket_number}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                            {t.client_name || "Direct Tenant"}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <p className="font-semibold text-slate-900 leading-none">{t.user_name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{t.user_email}</p>
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800 max-w-xs truncate">
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
                          <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                            {t.category}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${prBadge}`}>
                              {t.priority.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">
                            {formatIST(t.created_at)}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${stBadge}`}>
                              {t.status.replaceAll("_", " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                            {t.assigned_admin_name ? (
                              <span className="font-semibold text-blue-900">{t.assigned_admin_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(t.id)}
                              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-900 hover:bg-blue-50 transition shadow-2xs"
                            >
                              Manage
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

      {/* Ticket Management Drawer / Modal */}
      <TicketDetailsModal
        isOpen={detailsModalOpen}
        ticketId={selectedTicketId}
        isAdmin={true}
        onClose={() => setDetailsModalOpen(false)}
        onUpdated={() => loadData()}
      />
    </div>
  );
}
