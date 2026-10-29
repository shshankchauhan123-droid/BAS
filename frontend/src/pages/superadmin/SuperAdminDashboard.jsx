import { useEffect, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import {
  getClients,
  createClient,
  updateClientStatus,
  updateClientMaxUsers,
  updateClient,
  deleteClient,
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

  // Edit Client Profile Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    company_code: "",
    max_users: 10,
    is_active: true,
    admin_email: "",
    admin_username: "",
  });
  const [editClientLoading, setEditClientLoading] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  // Delete Client Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");
  const [deleteCanDeactivate, setDeleteCanDeactivate] = useState(false);

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
      setSuccess(`Company "${formData.name}" and Admin "${formData.admin_username}" registered successfully!`);
      await fetchClientsList();
    } catch (err) {
      setModalError(err?.message || "Failed to register client.");
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

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setEditFormData({
      name: client.name || "",
      company_code: client.company_code || "",
      max_users: client.max_users || 10,
      is_active: client.is_active ?? true,
      admin_email: client.admin_email || "",
      admin_username: client.admin_username || "",
    });
    setEditModalError("");
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingClient) return;

    setEditClientLoading(true);
    setEditModalError("");
    setError("");
    setSuccess("");

    try {
      const payload = {
        name: editFormData.name.trim(),
        company_code: editFormData.company_code.trim().toUpperCase(),
        max_users: parseInt(editFormData.max_users, 10),
        is_active: Boolean(editFormData.is_active),
      };
      if (editFormData.admin_email && editFormData.admin_email.trim()) {
        payload.admin_email = editFormData.admin_email.trim().toLowerCase();
      }
      if (editFormData.admin_username && editFormData.admin_username.trim()) {
        payload.admin_username = editFormData.admin_username.trim();
      }

      await updateClient(editingClient.id, payload);
      setEditModalOpen(false);
      setSuccess(`Client "${payload.name}" updated successfully.`);
      await fetchClientsList();
    } catch (err) {
      setEditModalError(err?.message || "Failed to update client details.");
    } finally {
      setEditClientLoading(false);
    }
  };

  const handleOpenDeleteModal = (client) => {
    setDeletingClient(client);
    setDeleteConfirmText("");
    setDeleteModalError("");
    setDeleteCanDeactivate(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient) return;
    if (deleteConfirmText.trim() !== deletingClient.name.trim()) return;

    setDeleteLoading(true);
    setDeleteModalError("");
    setError("");
    setSuccess("");

    try {
      const res = await deleteClient(deletingClient.id);
      setDeleteModalOpen(false);
      setSuccess(res?.message || `Client "${deletingClient.name}" deleted successfully.`);
      await fetchClientsList();
    } catch (err) {
      const msg = err?.message || "Failed to delete client.";
      setDeleteModalError(msg);
      if (
        msg.toLowerCase().includes("deactivate") ||
        msg.toLowerCase().includes("case") ||
        msg.toLowerCase().includes("document") ||
        msg.toLowerCase().includes("ncrp")
      ) {
        setDeleteCanDeactivate(true);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!deletingClient) return;
    setDeleteLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateClientStatus(deletingClient.id, false);
      setDeleteModalOpen(false);
      setSuccess(`Client "${deletingClient.name}" access has been deactivated.`);
      await fetchClientsList();
    } catch (err) {
      setDeleteModalError(err?.message || "Failed to deactivate client.");
    } finally {
      setDeleteLoading(false);
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
  const totalUsersActive = clients.reduce(
    (acc, c) => acc + (c.active_users ?? c.current_users_count ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#172033] flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Styles for subtle animations & reduced motion support */}
      <style>{`
        @keyframes arthbodhFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes arthbodhFloatOrb {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(8px, -10px, 0); }
        }
        .arthbodh-anim-enter {
          animation: arthbodhFadeIn 350ms cubic-bezier(.16, 1, .3, 1) both;
        }
        .arthbodh-kpi-card {
          transition: transform 220ms cubic-bezier(.16, 1, .3, 1),
            box-shadow 220ms cubic-bezier(.16, 1, .3, 1),
            border-color 220ms ease;
        }
        .arthbodh-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -4px rgba(23, 37, 84, 0.08), 0 4px 8px -2px rgba(23, 37, 84, 0.03);
        }
        .arthbodh-ambient-orb {
          animation: arthbodhFloatOrb 12s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .arthbodh-anim-enter, .arthbodh-ambient-orb { animation: none !important; }
          .arthbodh-kpi-card, .arthbodh-kpi-card:hover {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <UserNavbar />

      <main className="relative flex-1 overflow-hidden">
        {/* Ambient subtle light background orbs & blueprint grid */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="arthbodh-ambient-orb absolute -left-36 -top-36 h-[480px] w-[480px] rounded-full bg-emerald-200/25 blur-3xl" />
          <div className="arthbodh-ambient-orb absolute right-0 top-16 h-[440px] w-[440px] rounded-full bg-blue-200/25 blur-3xl [animation-delay:-4s]" />
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(226,232,240,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(226,232,240,.7) 1px,transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-9">
          {/* Header Section */}
          <section className="arthbodh-anim-enter mb-8 flex flex-col justify-between gap-5 sm:gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Product Owner Control Center
                </span>
                <span className="h-3 w-px bg-slate-300" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Tenant Governance
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                Client &amp; <span className="text-[#059669]">Tenant Governance</span>
              </h1>

              <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-[#64748B]">
                Provision client enterprise accounts, govern seat allocations, and manage tenant access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#059669] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm shadow-emerald-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#047857] hover:shadow-md hover:shadow-emerald-900/20 active:translate-y-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Register New Client
              </button>
            </div>
          </section>

          {/* Navigation Tabs - Modern Segmented Control */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="inline-flex rounded-2xl bg-white p-1.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("clients")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                  activeTab === "clients"
                    ? "bg-[#059669] text-white shadow-sm shadow-emerald-900/15"
                    : "text-slate-600 hover:text-[#172554] hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span>Client Companies</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    activeTab === "clients"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {clients.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                  activeTab === "audit"
                    ? "bg-[#059669] text-white shadow-sm shadow-emerald-900/15"
                    : "text-slate-600 hover:text-[#172554] hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>System Audit Trail</span>
                <span className="flex h-2 w-2 relative ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Tenant Control Center Active</span>
            </div>
          </div>

          {activeTab === "audit" ? (
            <AuditLogTable isSuperAdmin={true} theme="light" />
          ) : (
            <>
              {/* Feedback Alerts */}
              {error && (
                <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-rose-600 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="text-rose-700 hover:text-rose-950 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {success && (
                <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-emerald-600 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{success}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccess("")}
                    className="text-emerald-700 hover:text-emerald-950 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Metrics Grid - 4 KPI Cards */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Total Clients */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Clients
                    </span>
                    <span className="rounded-xl bg-indigo-50 border border-indigo-100 p-2 text-indigo-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-[#172554] sm:text-3xl">
                    {totalClients}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Registered client companies</div>
                </div>

                {/* 2. Active Clients */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Active Clients
                    </span>
                    <span className="rounded-xl bg-emerald-50 border border-emerald-100 p-2 text-emerald-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-[#059669] sm:text-3xl">
                    {activeClients}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Granted system access</div>
                </div>

                {/* 3. Deactivated Clients */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Deactivated Clients
                    </span>
                    <span className="rounded-xl bg-rose-50 border border-rose-100 p-2 text-rose-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-[#E11D48] sm:text-3xl">
                    {inactiveClients}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Access blocked / revoked</div>
                </div>

                {/* 4. Capacity & Seats */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Capacity &amp; Seats
                    </span>
                    <span className="rounded-xl bg-cyan-50 border border-cyan-100 p-2 text-cyan-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-[#0891B2] sm:text-3xl">
                    {totalUsersActive} / {totalCapacity}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Seats occupied across all clients</div>
                </div>
              </div>

              {/* Client Table Section */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                {/* Table Filters Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 p-5 bg-white">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#172554]">
                      Client Companies
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Provision enterprise organizations, configure seat quotas, and govern active tenant access.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-80">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by company name, code, or admin..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchClientsList()}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-[#172554]"
                      title="Refresh Client List"
                    >
                      <svg
                        className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : "text-slate-500"}`}
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
                      <span>Refresh</span>
                    </button>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 font-semibold shadow-2xs">
                      Companies: <span className="font-extrabold text-[#172554]">{filteredClients.length}</span> of {totalClients}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                    <span className="mt-3 text-xs text-slate-500 font-medium">Loading client companies...</span>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs">
                    No client companies found. Click &quot;Register New Client&quot; above to onboard your first enterprise client.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <tr>
                          <th className="px-6 py-4">Client Company (ID)</th>
                          <th className="px-6 py-4">Admin Email</th>
                          <th className="px-6 py-4">Access Status</th>
                          <th className="px-6 py-4">Assigned Limit</th>
                          <th className="px-6 py-4">Usage &amp; Left</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredClients.map((client) => {
                          const used = client.active_users ?? client.current_users_count ?? 0;
                          const assigned = client.max_users || 1;
                          const remaining = Math.max(0, assigned - used);
                          const percent = Math.min(100, Math.round((used / assigned) * 100));
                          const isToggling = togglingId === client.id;
                          const isAdjusting = adjustingId === client.id;

                          return (
                            <tr key={client.id} className="transition hover:bg-slate-50/70">
                              {/* 1. Client Company (ID) */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#172554] font-extrabold border border-slate-200 text-xs">
                                    {client.name ? client.name.charAt(0).toUpperCase() : "C"}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-[#172554] text-sm">
                                      {client.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                                        {client.company_code}
                                      </span>
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        (Client ID: #{client.id})
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Admin & Email */}
                              <td className="px-6 py-4">
                                <div className="text-slate-800 font-bold text-xs">
                                  {client.admin_username || "—"}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {client.admin_email || "—"}
                                </div>
                              </td>

                              {/* 3. Status (Active / Inactive - Direct Click to Allow / Decline) */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() => handleToggleStatus(client)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                      client.is_active ? "bg-emerald-600 shadow-2xs" : "bg-slate-300"
                                    }`}
                                    title={
                                      client.is_active
                                        ? "Access Allowed. Click to decline/bar access."
                                        : "Access Denied. Click to grant access."
                                    }
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        client.is_active ? "translate-x-5" : "translate-x-0"
                                      }`}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() => handleToggleStatus(client)}
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                                      client.is_active
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                        : "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                                    }`}
                                  >
                                    {client.is_active ? "Active (Allowed)" : "Inactive (Declined)"}
                                  </button>
                                </div>
                              </td>

                              {/* 4. Assigned Limit (Direct +/- Quick Adjuster) */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-2xs">
                                    <button
                                      type="button"
                                      disabled={isAdjusting || assigned <= Math.max(1, used)}
                                      onClick={() => handleQuickAdjustMaxUsers(client, -1)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700 transition hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                                      title={
                                        assigned <= used
                                          ? "Cannot decrease limit below used seats"
                                          : "Decrease limit by 1"
                                      }
                                    >
                                      −
                                    </button>

                                    <span className="min-w-[46px] text-center font-extrabold text-[#172554] text-xs">
                                      {assigned}
                                    </span>

                                    <button
                                      type="button"
                                      disabled={isAdjusting}
                                      onClick={() => handleQuickAdjustMaxUsers(client, 1)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700 transition hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-30 shadow-2xs"
                                      title="Increase limit by 1"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-slate-500 font-semibold">seats</span>
                                </div>
                              </td>

                              {/* 5. Usage & Remaining (Used X, Left Y) */}
                              <td className="px-6 py-4">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-600 text-xs">
                                      Used: <strong className="text-[#172554] font-extrabold">{used}</strong>
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <span
                                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                        remaining > 0
                                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                          : "border border-rose-200 bg-rose-50 text-rose-800"
                                      }`}
                                    >
                                      {remaining} left
                                    </span>
                                  </div>
                                  <div className="mt-1 h-2 w-36 rounded-full bg-slate-100 border border-slate-200/60 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        percent >= 100
                                          ? "bg-rose-500"
                                          : percent >= 80
                                          ? "bg-amber-500"
                                          : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* 6. Actions: Edit, Custom Limit, Delete */}
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(client)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                                    title={`Edit details for ${client.name}`}
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditClient(client);
                                      setNewMaxUsers(client.max_users);
                                    }}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-[#172554] hover:border-slate-300"
                                    title={`Adjust seat capacity for ${client.name}`}
                                  >
                                    Custom Limit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteModal(client)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 shadow-2xs transition hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                                    title={`Delete client ${client.name}`}
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>Delete</span>
                                  </button>
                                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 overflow-y-auto py-10 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-[#172033]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Client Provisioning
                </span>
                <h2 className="text-lg font-extrabold text-[#172554]">
                  Register New Enterprise Client
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 shrink-0 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError("")}
                  className="text-rose-600 hover:text-rose-900 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              {/* Section 1: Company Profile */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-2.5">
                  1. Company Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Corporation"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Company Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. APEX"
                      value={formData.company_code}
                      onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition uppercase"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Max Allowed Users (Quota) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    placeholder="e.g. 10"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    The Client Admin cannot add more users than this assigned limit.
                  </p>
                </div>
              </div>

              {/* Section 2: Initial Client Admin */}
              <div className="pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-2.5">
                  2. Primary Client Admin Account
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Admin Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. apex_admin"
                      value={formData.admin_username}
                      onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Admin Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. admin@apex.com"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Temporary password (min 6 chars)"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      The admin will be prompted to change or retain this password upon their first login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-2/3 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                >
                  {createLoading ? "Registering Client..." : "Register Client & Admin"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-[#172033]">
            <h3 className="text-base font-extrabold text-[#172554]">Update Seat Allocation</h3>
            <p className="mt-1 text-xs text-slate-500">
              Set maximum user capacity for <span className="font-bold text-[#059669]">{editClient.name}</span>.
            </p>

            <form onSubmit={handleSaveMaxUsers} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Users</label>
                <input
                  type="number"
                  required
                  min={editClient.active_users || 1}
                  value={newMaxUsers}
                  onChange={(e) => setNewMaxUsers(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Current occupied seats: <strong className="text-[#172554]">{editClient.active_users || 0}</strong>
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditClient(null)}
                  className="w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-1/2 rounded-xl bg-[#059669] px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Update Quota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          EDIT CLIENT PROFILE & ADMIN MODAL
      ========================================================== */}
      {editModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 overflow-y-auto py-10 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-[#172033]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                    Client Management
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                    ID #{editingClient.id}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-[#172554] mt-0.5">
                  Edit Client: {editingClient.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {editModalError && (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 shrink-0 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{editModalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalError("")}
                  className="text-rose-600 hover:text-rose-900 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              {/* Section 1: Company Profile */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-2.5">
                  1. Company Profile
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Company Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.company_code}
                      onChange={(e) => setEditFormData({ ...editFormData, company_code: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Max User Limit (Seats) *
                    </label>
                    <input
                      type="number"
                      required
                      min={editingClient.active_users || editingClient.current_users_count || 1}
                      max={1000}
                      value={editFormData.max_users}
                      onChange={(e) => setEditFormData({ ...editFormData, max_users: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Occupied: <strong className="text-slate-800">{editingClient.active_users || 0}</strong> seats
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Access Status *
                    </label>
                    <select
                      value={editFormData.is_active ? "true" : "false"}
                      onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === "true" })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    >
                      <option value="true">Active (Allowed to Log In)</option>
                      <option value="false">Inactive (Access Blocked)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Primary Client Admin */}
              <div className="pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-2.5">
                  2. Primary Client Admin
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={editFormData.admin_email}
                      onChange={(e) => setEditFormData({ ...editFormData, admin_email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Admin Username
                    </label>
                    <input
                      type="text"
                      value={editFormData.admin_username}
                      onChange={(e) => setEditFormData({ ...editFormData, admin_username: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editClientLoading}
                  className="w-2/3 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                >
                  {editClientLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          DELETE CLIENT CONFIRMATION MODAL
      ========================================================== */}
      {deleteModalOpen && deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 overflow-y-auto py-10 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 sm:p-7 shadow-2xl text-[#172033]">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-2xs">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  Critical Action
                </span>
                <h3 className="text-base font-extrabold text-[#172554]">
                  Delete Client Company
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Warning Details */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-semibold text-slate-500">Target Client:</span>
                <span className="font-extrabold text-[#172554]">{deletingClient.name}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Client ID / Code:</span>
                <span className="font-mono font-bold text-slate-700">#{deletingClient.id} ({deletingClient.company_code})</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Assigned Seats / Occupied:</span>
                <span className="font-bold text-slate-700">{deletingClient.max_users} seats ({deletingClient.active_users ?? deletingClient.current_users_count ?? 0} active)</span>
              </div>
            </div>

            <p className="mt-3.5 text-xs text-slate-600 leading-relaxed">
              Permanent deletion will remove this client organization. To safeguard critical legal evidence, clients with associated investigation cases, bank statements, or NCRP files cannot be permanently deleted.
            </p>

            {/* Error banner from backend */}
            {deleteModalError && (
              <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <p className="font-bold mb-1">Cannot Delete Client</p>
                <p className="leading-relaxed">{deleteModalError}</p>
                {deleteCanDeactivate && (
                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    disabled={deleteLoading}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Deactivate Client Instead (Safe)
                  </button>
                )}
              </div>
            )}

            {/* Confirmation typing requirement */}
            <div className="mt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Type <span className="font-mono text-rose-700 underline">{deletingClient.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deletingClient.name}
                disabled={deleteLoading}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/15 transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-5 mt-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className="w-1/3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading || deleteConfirmText.trim() !== deletingClient.name.trim()}
                className="w-2/3 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-rose-900/10 hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleteLoading ? "Deleting Client..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  );
}
