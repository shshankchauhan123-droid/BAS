import { useEffect, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import {
  getClients,
  createClient,
  updateClientStatus,
  updateClientMaxUsers,
} from "../../services/api/clients";
import AuditLogTable from "../../components/audit/AuditLogTable";

export default function SuperAdminDashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("clients"); // "clients" | "audit"

  // Create Client Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    company_code: "",
    max_users: 10,
    admin_username: "",
    admin_email: "",
    admin_password: "",
  });

  // Edit Max Users Modal State
  const [editClient, setEditClient] = useState(null);
  const [newMaxUsers, setNewMaxUsers] = useState(10);
  const [editLoading, setEditLoading] = useState(false);

  // Status toggle in-flight tracker
  const [togglingId, setTogglingId] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);

  const handleQuickAdjustMaxUsers = async (client, delta) => {
    const currentMax = client.max_users || 1;
    const nextLimit = currentMax + delta;
    const currentUsed = client.active_users ?? client.current_users_count ?? 0;

    if (nextLimit < Math.max(1, currentUsed)) {
      setError(`Cannot reduce seat limit below currently occupied seats (${currentUsed}).`);
      return;
    }
    if (nextLimit > 1000) return;

    setAdjustingId(client.id);
    setError("");
    setSuccess("");

    // Optimistic UI update
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, max_users: nextLimit } : c))
    );

    try {
      await updateClientMaxUsers(client.id, nextLimit);
      setSuccess(`Limit for "${client.name}" ${delta > 0 ? "increased" : "decreased"} to ${nextLimit} seats.`);
    } catch (err) {
      // Revert if API failed
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, max_users: currentMax } : c))
      );
      setError(err?.message || "Failed to update seat limit.");
    } finally {
      setAdjustingId(null);
    }
  };

  const fetchClientsList = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getClients();
      const list = res?.clients || res?.items || (Array.isArray(res) ? res : []);
      setClients(list);
    } catch (err) {
      setError(err?.message || "Failed to load clients list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsList();
  }, []);

  const handleToggleStatus = async (client) => {
    const nextStatus = !client.is_active;
    const confirmMessage = nextStatus
      ? `Activate access for ${client.name}? All company members will be allowed to log in.`
      : `Deny / Block access for ${client.name}? All company users and admins will be barred immediately.`;

    if (!window.confirm(confirmMessage)) return;

    setTogglingId(client.id);
    setError("");
    setSuccess("");
    try {
      await updateClientStatus(client.id, nextStatus);
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, is_active: nextStatus } : c))
      );
      setSuccess(`Client "${client.name}" status changed to ${nextStatus ? "Active" : "Deactivated"}.`);
    } catch (err) {
      setError(err?.message || "Failed to update client status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setModalError("");
    setError("");
    setSuccess("");

    try {
      await createClient({
        name: formData.name.trim(),
        company_code: formData.company_code.trim().toUpperCase(),
        max_users: parseInt(formData.max_users, 10),
        admin: {
          username: formData.admin_username.trim(),
          email: formData.admin_email.trim(),
          password: formData.admin_password,
        },
      });

      setIsModalOpen(false);
      setFormData({
        name: "",
        company_code: "",
        max_users: 10,
        admin_username: "",
        admin_email: "",
        admin_password: "",
      });
      setSuccess(`Company "${formData.name}" and Admin "${formData.admin_username}" created successfully!`);
      await fetchClientsList();
    } catch (err) {
      setModalError(err?.message || "Failed to create client.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveMaxUsers = async (e) => {
    e.preventDefault();
    if (!editClient) return;

    setEditLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateClientMaxUsers(editClient.id, parseInt(newMaxUsers, 10));
      setClients((prev) =>
        prev.map((c) =>
          c.id === editClient.id ? { ...c, max_users: parseInt(newMaxUsers, 10) } : c
        )
      );
      setSuccess(`Seat limit updated to ${newMaxUsers} for ${editClient.name}.`);
      setEditClient(null);
    } catch (err) {
      setError(err?.message || "Failed to update seat limit.");
    } finally {
      setEditLoading(false);
    }
  };

  // Filtered clients
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.admin_username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Metrics
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.is_active).length;
  const inactiveClients = totalClients - activeClients;
  const totalCapacity = clients.reduce((acc, c) => acc + (c.max_users || 0), 0);
  const totalUsersActive = clients.reduce((acc, c) => acc + (c.active_users ?? c.current_users_count ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#06100e] text-white">
      <UserNavbar />

      <main className="relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-180px] top-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-500/[0.04] blur-3xl" />
          <div className="absolute right-[-220px] top-[160px] h-[480px] w-[480px] rounded-full bg-cyan-500/[0.03] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {/* Header Section */}
          <section className="mb-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-px w-8 bg-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
                    Product Owner Control Center
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Client & Tenant Governance
                </h1>
                <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-400">
                  Provision client enterprise accounts, govern seat allocations, and toggle client tenant access instantly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Register New Client
              </button>
            </div>
          </section>

          {/* Dashboard Tab Navigation */}
          <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setActiveTab("clients")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === "clients"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Client Companies
              <span className="ml-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                {clients.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === "audit"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              System Audit Trail
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>
          </div>

          {activeTab === "audit" ? (
            <AuditLogTable isSuperAdmin={true} />
          ) : (
            <>
          {/* Feedback Alerts */}
          {error && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} className="text-rose-400 hover:text-white">✕</button>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              <span>{success}</span>
              <button type="button" onClick={() => setSuccess("")} className="text-emerald-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#071512] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Clients</span>
              <div className="mt-2 text-2xl font-bold text-white">{totalClients}</div>
              <div className="mt-1 text-[11px] text-slate-500">Registered client companies</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-[#071a15] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Active Clients</span>
              <div className="mt-2 text-2xl font-bold text-emerald-300">{activeClients}</div>
              <div className="mt-1 text-[11px] text-emerald-400/70">Granted system access</div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-[#160a0c] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Deactivated Clients</span>
              <div className="mt-2 text-2xl font-bold text-rose-300">{inactiveClients}</div>
              <div className="mt-1 text-[11px] text-rose-400/70">Access blocked / revoked</div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-[#071618] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Capacity & Seats</span>
              <div className="mt-2 text-2xl font-bold text-cyan-300">{totalUsersActive} / {totalCapacity}</div>
              <div className="mt-1 text-[11px] text-cyan-400/70">Seats occupied across all clients</div>
            </div>
          </div>

          {/* Client Table Section */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#071512] shadow-2xl overflow-hidden">
            {/* Table Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/[0.06] p-5">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search by company name, code, or admin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="text-xs text-slate-400">
                Showing <span className="font-semibold text-white">{filteredClients.length}</span> of {totalClients} companies
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No client companies found. Click "Register New Client" above to onboard your first enterprise client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-black/20 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Client Company (ID)</th>
                      <th className="px-6 py-4">Admin Email</th>
                      <th className="px-6 py-4">Access Status</th>
                      <th className="px-6 py-4">Assigned Limit</th>
                      <th className="px-6 py-4">Usage & Left</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredClients.map((client) => {
                      const used = client.active_users ?? client.current_users_count ?? 0;
                      const assigned = client.max_users || 1;
                      const remaining = Math.max(0, assigned - used);
                      const percent = Math.min(100, Math.round((used / assigned) * 100));
                      const isToggling = togglingId === client.id;
                      const isAdjusting = adjustingId === client.id;

                      return (
                        <tr key={client.id} className="transition hover:bg-white/[0.02]">
                          {/* 1. Client Company (ID) */}
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white text-sm">{client.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                                {client.company_code}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                (User ID / Client ID: #{client.id})
                              </span>
                            </div>
                          </td>

                          {/* 2. Admin & Email */}
                          <td className="px-6 py-4">
                            <div className="text-slate-200 font-medium">{client.admin_username || "—"}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{client.admin_email || "—"}</div>
                          </td>

                          {/* 3. Status (Active / Inactive - Direct Click to Allow / Decline) */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleStatus(client)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                  client.is_active ? "bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.4)]" : "bg-rose-900/70"
                                }`}
                                title={client.is_active ? "Access Allowed. Click to decline/bar access." : "Access Denied. Click to grant access."}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    client.is_active ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleStatus(client)}
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                                  client.is_active
                                    ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                                    : "border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                }`}
                              >
                                {client.is_active ? "Active (Allowed)" : "Inactive (Declined)"}
                              </button>
                            </div>
                          </td>

                          {/* 4. Assigned Limit (Direct +/- Quick Adjuster) */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
                                <button
                                  type="button"
                                  disabled={isAdjusting || assigned <= Math.max(1, used)}
                                  onClick={() => handleQuickAdjustMaxUsers(client, -1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/[0.04] text-sm font-bold text-slate-300 transition hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-20 disabled:cursor-not-allowed"
                                  title={assigned <= used ? "Cannot decrease limit below used seats" : "Decrease limit by 1"}
                                >
                                  −
                                </button>

                                <span className="min-w-[46px] text-center font-bold text-white text-xs">
                                  {assigned}
                                </span>

                                <button
                                  type="button"
                                  disabled={isAdjusting}
                                  onClick={() => handleQuickAdjustMaxUsers(client, 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/[0.04] text-sm font-bold text-slate-300 transition hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-20"
                                  title="Increase limit by 1"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">seats</span>
                            </div>
                          </td>

                          {/* 5. Usage & Remaining (Used X, Left Y) */}
                          <td className="px-6 py-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300">
                                  Used: <strong className="text-white">{used}</strong>
                                </span>
                                <span className="text-slate-600">•</span>
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    remaining > 0
                                      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                      : "border border-rose-500/20 bg-rose-500/10 text-rose-300"
                                  }`}
                                >
                                  {remaining} left
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 w-36 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    percent >= 100
                                      ? "bg-rose-500"
                                      : percent >= 80
                                      ? "bg-amber-400"
                                      : "bg-emerald-400"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 6. Custom Actions */}
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditClient(client);
                                setNewMaxUsers(client.max_users);
                              }}
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                            >
                              Custom Limit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </main>

      {/* =========================================================
          REGISTER NEW CLIENT MODAL
      ========================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 overflow-y-auto py-10">
          <div className="relative w-full max-w-lg rounded-2xl border border-emerald-400/20 bg-[#071512] p-6 sm:p-8 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                  Client Provisioning
                </span>
                <h2 className="text-lg font-bold text-white">Register New Enterprise Client</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/15 p-3.5 text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError("")}
                  className="text-rose-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              {/* Section 1: Company Profile */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                  1. Company Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Corporation"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Company Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. APEX"
                      value={formData.company_code}
                      onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-slate-400">Max Allowed Users (Quota) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    placeholder="e.g. 10"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    The Client Admin cannot add more users than this assigned limit.
                  </p>
                </div>
              </div>

              {/* Section 2: Initial Client Admin */}
              <div className="pt-2 border-t border-white/[0.08]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                  2. Primary Client Admin Account
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Admin Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. apex_admin"
                      value={formData.admin_username}
                      onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Admin Work Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. admin@apex.com"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Initial Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Temporary password (min 6 chars)"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      The admin will be prompted to change or keep this password upon their first login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-2/3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                >
                  {createLoading ? "Creating Client..." : "Create Client & Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          EDIT SEAT CAPACITY MODAL
      ========================================================== */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-emerald-400/20 bg-[#071512] p-6 shadow-2xl text-white">
            <h3 className="text-sm font-bold text-white">Update Seat Allocation</h3>
            <p className="mt-1 text-xs text-slate-400">
              Set maximum user capacity for <span className="font-semibold text-emerald-300">{editClient.name}</span>.
            </p>

            <form onSubmit={handleSaveMaxUsers} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400">Max Users</label>
                <input
                  type="number"
                  required
                  min={editClient.active_users || 1}
                  value={newMaxUsers}
                  onChange={(e) => setNewMaxUsers(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Current occupied seats: {editClient.active_users || 0}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditClient(null)}
                  className="w-1/2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-1/2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Update Quota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  );
}
