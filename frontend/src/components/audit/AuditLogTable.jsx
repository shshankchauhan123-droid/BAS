import { useEffect, useState, useCallback } from "react";
import { getAuditLogs, getAuditStats } from "../../services/api/audit";
import { getClients } from "../../services/api/clients";

export default function AuditLogTable({ isSuperAdmin = false }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [searchEntityId, setSearchEntityId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientsList, setClientsList] = useState([]);

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Detail Modal
  const [activeDetailLog, setActiveDetailLog] = useState(null);

  // Load clients list for SuperAdmin dropdown
  useEffect(() => {
    if (isSuperAdmin) {
      getClients()
        .then((res) => {
          const list = res?.clients || res?.data || (Array.isArray(res) ? res : []);
          setClientsList(list);
        })
        .catch(() => { });
    }
  }, [isSuperAdmin]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        page_size: pageSize,
      };

      if (selectedAction) params.action = selectedAction;
      if (selectedEntityType) params.entity_type = selectedEntityType;
      if (searchEntityId.trim()) params.entity_id = searchEntityId.trim();

      // Only SuperAdmin can supply client_id
      if (isSuperAdmin && selectedClientId) {
        params.client_id = selectedClientId;
      }

      const res = await getAuditLogs(params);
      const items = res?.data || [];
      setLogs(items);
      setTotal(res?.total || items.length);
      setTotalPages(res?.total_pages || 1);
    } catch (err) {
      setError(err?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedAction, selectedEntityType, searchEntityId, selectedClientId, isSuperAdmin]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const clientIdParam = isSuperAdmin && selectedClientId ? selectedClientId : null;
      const res = await getAuditStats(clientIdParam);
      setStats(res?.data || null);
    } catch {
      // Ignore stats error gracefully
    } finally {
      setStatsLoading(false);
    }
  }, [isSuperAdmin, selectedClientId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    fetchLogs();
    fetchStats();
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "CASE_CREATED":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "CASE_UPDATED":
        return "bg-sky-500/15 text-sky-400 border-sky-500/30";
      case "CASE_ARCHIVED":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "CASE_ARCHIVE_DENIED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold";
      case "FILE_UPLOADED":
        return "bg-teal-500/15 text-teal-400 border-teal-500/30";
      case "FILE_UPDATED":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      case "FILE_DELETED":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "FILE_PROCESSING_SUCCESS":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "FILE_PROCESSING_FAILED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "USER_CREATED":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "USER_STATUS_TOGGLED":
        return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
      case "PERMISSIONS_UPDATED":
        return "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30";
      default:
        return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Today's Activities
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {statsLoading ? "..." : stats?.total_today ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Platform-wide events</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Case Actions
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-300">
            {statsLoading ? "..." : stats?.case_activities ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Created / Updated / Archived</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
            Files Uploaded
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-300">
            {statsLoading ? "..." : stats?.file_uploads ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Statements uploaded</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            Process Failures
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {statsLoading ? "..." : stats?.file_processing_failures ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Parsing errors</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg backdrop-blur col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
            User Operations
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-300">
            {statsLoading ? "..." : stats?.user_management_activities ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Creations / Status / Rights</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="CASE_CREATED">Case Created</option>
            <option value="CASE_UPDATED">Case Updated</option>
            <option value="CASE_ARCHIVED">Case Archived</option>
            <option value="CASE_ARCHIVE_DENIED">Archive Denied (Security)</option>
            <option value="FILE_UPLOADED">File Uploaded</option>
            <option value="FILE_UPDATED">File Updated</option>
            <option value="FILE_DELETED">File Deleted</option>
            <option value="FILE_PROCESSING_SUCCESS">Processing Succeeded</option>
            <option value="FILE_PROCESSING_FAILED">Processing Failed</option>
            <option value="USER_CREATED">User Created</option>
            <option value="USER_STATUS_TOGGLED">User Status Toggled</option>
            <option value="PERMISSIONS_UPDATED">Permissions Updated</option>
          </select>

          {/* Entity Type Filter */}
          <select
            value={selectedEntityType}
            onChange={(e) => {
              setSelectedEntityType(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Entity Types</option>
            <option value="case">Cases</option>
            <option value="file">Files</option>
            <option value="user">Users</option>
          </select>

          {/* SuperAdmin Company Filter */}
          {isSuperAdmin && (
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 focus:border-emerald-400 focus:outline-none"
            >
              <option value="">All Client Companies</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company_code})
                </option>
              ))}
            </select>
          )}

          {/* Search Entity ID */}
          <input
            type="text"
            placeholder="Search Entity ID..."
            value={searchEntityId}
            onChange={(e) => setSearchEntityId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setPage(1);
            }}
            className="w-36 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Refresh Audit Logs"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-400">
          {error}
        </div>
      )}

      {/* Main Audit Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4">Actor / User</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Target / Entity</th>
                <th className="px-5 py-4">Description</th>
                <th className="px-5 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      Loading audit records...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No activity logs recorded matching current criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-white/[0.02]">
                    {/* Timestamp */}
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[11px] text-slate-400">
                      {formatTimestamp(log.created_at)}
                    </td>

                    {/* Actor */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-[11px] font-bold text-emerald-400">
                          {log.user_name ? log.user_name.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{log.user_name}</div>
                          <div className="text-[10px] text-slate-500">{log.user_email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                          {log.entity_type}
                        </span>
                        <span className="font-medium text-slate-200">
                          {log.entity_name || `#${log.entity_id}`}
                        </span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-4 text-slate-300 max-w-md truncate" title={log.description}>
                      {log.description}
                    </td>

                    {/* Details button */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveDetailLog(log)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-slate-950/40 px-5 py-4 text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{logs.length}</strong> of{" "}
            <strong className="text-white">{total}</strong> total activities
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-xs">
              Page <strong className="text-white">{page}</strong> of{" "}
              <strong className="text-white">{totalPages}</strong>
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {activeDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Audit Event Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Event ID #{activeDetailLog.id} • {formatTimestamp(activeDetailLog.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailLog(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Action</div>
                  <div className="mt-1 font-semibold text-white">{activeDetailLog.action}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Entity</div>
                  <div className="mt-1 font-semibold text-white">
                    {activeDetailLog.entity_type.toUpperCase()} #{activeDetailLog.entity_id} ({activeDetailLog.entity_name || "N/A"})
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Actor</div>
                  <div className="mt-1 font-semibold text-white">
                    {activeDetailLog.user_name} ({activeDetailLog.user_role})
                  </div>
                  <div className="text-[10px] text-slate-400">{activeDetailLog.user_email}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Client / Company ID</div>
                  <div className="mt-1 font-semibold text-white">
                    {activeDetailLog.client_id ? `Company #${activeDetailLog.client_id}` : "Global (SuperAdmin)"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">Human Description</div>
                <div className="rounded-xl border border-white/5 bg-slate-950/80 p-3 text-xs text-slate-200">
                  {activeDetailLog.description}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">Structured Details (JSON)</div>
                <pre className="rounded-xl border border-white/5 bg-slate-950/90 p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                  {JSON.stringify(activeDetailLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setActiveDetailLog(null)}
                className="rounded-xl bg-white/10 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
