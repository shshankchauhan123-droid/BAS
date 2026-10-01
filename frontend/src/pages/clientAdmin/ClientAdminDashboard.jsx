import { useEffect, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import { getUsers, createUser, updateUserStatus, updateUserPermissions } from "../../services/api/user";
import { useAuth } from "../../context/AuthContext";
import AuditLogTable from "../../components/audit/AuditLogTable";

const DEFAULT_PERMISSIONS = {
  can_create_case: true,
  can_upload_files: true,
  can_update_files: true,
  can_delete_files: true,
};

export default function ClientAdminDashboard() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("team"); // "team" | "audit"

  // Status toggle in-flight tracker
  const [togglingUserId, setTogglingUserId] = useState(null);

  // Add User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("credentials"); // "credentials" | "rights"
  const [createLoading, setCreateLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
  });
  const [formPermissions, setFormPermissions] = useState(DEFAULT_PERMISSIONS);

  // Edit Rights Modal State
  const [editRightsUser, setEditRightsUser] = useState(null);
  const [editPermissions, setEditPermissions] = useState(DEFAULT_PERMISSIONS);
  const [editRightsLoading, setEditRightsLoading] = useState(false);
  const [editRightsError, setEditRightsError] = useState("");


  const fetchTeam = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getUsers();
      const list = res?.users || res?.items || (Array.isArray(res) ? res : []);
      setUsers(list);
      setQuota(res?.quota || null);
    } catch (err) {
      setError(err?.message || "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleToggleUserStatus = async (targetUser) => {
    if (targetUser.id === user?.id) {
      alert("You cannot change your own admin account access status.");
      return;
    }

    const nextStatus = !targetUser.is_active;
    const confirmMsg = nextStatus
      ? `Allow access for "${targetUser.username}"? They will be granted portal access.`
      : `Decline / Bar access for "${targetUser.username}"? They will be immediately blocked from logging in.`;

    if (!window.confirm(confirmMsg)) return;

    setTogglingUserId(targetUser.id);
    setError("");
    setSuccess("");

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextStatus } : u))
    );

    try {
      await updateUserStatus(targetUser.id, nextStatus);
      setSuccess(`User "${targetUser.username}" access ${nextStatus ? "Allowed (Active)" : "Declined (Inactive)"}.`);
    } catch (err) {
      // Revert if API failed
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: targetUser.is_active } : u))
      );
      setError(err?.message || "Failed to update user status.");
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setModalError("");
    setError("");
    setSuccess("");

    try {
      await createUser({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        permissions: formData.role === "client_admin" ? undefined : formPermissions,
      });

      setIsModalOpen(false);
      setModalTab("credentials");
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "user",
      });
      setFormPermissions(DEFAULT_PERMISSIONS);
      setSuccess(`User "${formData.username}" added successfully with assigned access rights!`);
      await fetchTeam();
    } catch (err) {
      setModalError(err?.message || "Failed to add team member.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveEditedPermissions = async (e) => {
    e.preventDefault();
    if (!editRightsUser) return;
    setEditRightsLoading(true);
    setEditRightsError("");
    setError("");
    setSuccess("");

    try {
      await updateUserPermissions(editRightsUser.id, editPermissions);
      setSuccess(`Access rights updated for "${editRightsUser.username}"!`);
      setEditRightsUser(null);
      await fetchTeam();
    } catch (err) {
      setEditRightsError(err?.message || "Failed to update permissions.");
    } finally {
      setEditRightsLoading(false);
    }
  };


  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSeats = quota?.active_users ?? quota?.used_seats ?? users.length;
  const maxSeats = quota?.max_users ?? quota?.max_seats ?? 0;
  const isLimitReached = quota?.is_limit_reached ?? (activeSeats >= maxSeats && maxSeats > 0);
  const remainingSeats = quota?.remaining_seats ?? Math.max(0, maxSeats - activeSeats);
  const percentUsed = maxSeats > 0 ? Math.min(100, Math.round((activeSeats / maxSeats) * 100)) : 0;

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
                    Company Administration
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Team Members & Seat Quota
                </h1>
                <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-400">
                  Manage your organization's investigator accounts within your allocated enterprise seat capacity.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isLimitReached}
                  onClick={() => setIsModalOpen(true)}
                  className={`inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-xs font-semibold uppercase tracking-wider transition shadow-lg ${
                    isLimitReached
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/20"
                  }`}
                  title={isLimitReached ? "Seat limit reached. Contact SuperAdmin." : "Add new investigator"}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Team Member
                </button>
              </div>
            </div>
          </section>

          {/* Dashboard Tab Navigation */}
          <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === "team"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Team Members
              <span className="ml-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                {users.length}
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
              Audit & Activity Log
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>
          </div>

          {activeTab === "audit" ? (
            <AuditLogTable isSuperAdmin={false} />
          ) : (
            <>
          {/* Prominent Seats Left Banner */}
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-[#071a15] to-teal-500/10 p-5 shadow-lg shadow-emerald-950/30">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Seat Allocation Quota
                </div>
                <div className="text-xl font-bold text-white sm:text-2xl">
                  <span className="text-emerald-300 font-extrabold">{remainingSeats}</span> User Limit{remainingSeats === 1 ? "" : "s"} Left Now
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  You have used <strong className="text-white">{activeSeats}</strong> out of <strong className="text-white">{maxSeats}</strong> total allocated seats for your company.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-300">{percentUsed}% Allocated</div>
                <div className="text-[10px] text-slate-500">
                  {remainingSeats > 0 ? `${remainingSeats} available slots` : "Quota full"}
                </div>
              </div>
              <div className="h-10 w-28 rounded-xl bg-white/5 p-1.5 border border-white/10 flex items-center">
                <div className="h-full w-full rounded-lg bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${
                      percentUsed >= 100
                        ? "bg-rose-500"
                        : percentUsed >= 80
                        ? "bg-amber-400"
                        : "bg-gradient-to-r from-emerald-500 to-teal-400"
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seat Limit Warning Banner */}
          {isLimitReached && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
              <svg className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-semibold uppercase tracking-wider">Seat Limit Reached:</span> You have utilized all <span className="font-bold text-white">{maxSeats} / {maxSeats}</span> available seats allocated to your company. To onboard additional team members, please contact the Product Owner (SuperAdmin) to expand your company seat quota.
              </div>
            </div>
          )}

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

          {/* Seat Quota Metric Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-[#071a15] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Seats Occupied</span>
              <div className="mt-2 text-2xl font-bold text-emerald-300">{activeSeats} / {maxSeats}</div>
              <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentUsed >= 100
                      ? "bg-rose-500"
                      : percentUsed >= 80
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-emerald-400/80">{percentUsed}% of total capacity used</div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-[#071618] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Limits Left Now</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-cyan-300">{remainingSeats}</span>
                <span className="text-xs text-cyan-400/80">seats available</span>
              </div>
              <div className="mt-2 text-[11px] text-cyan-400/80">
                {remainingSeats > 0 ? "Ready to onboard new users" : "All allocated seats in use"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#071512] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Your Company</span>
              <div className="mt-2 text-xl font-bold text-white">{quota?.client_name || user?.client_name || "Enterprise Client"}</div>
              <div className="mt-1 text-[11px] text-slate-500">Tenant ID #{quota?.client_id || user?.client_id || "—"}</div>
            </div>
          </div>

          {/* Privacy & Confidentiality Notice */}
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 text-xs text-slate-300">
            <svg className="h-5 w-5 shrink-0 text-cyan-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-semibold text-cyan-300 uppercase tracking-wider">Privacy & Case Isolation Policy:</span> As a company administrator, you manage team seats and user onboarding. All investigation cases and financial analytics created by investigators remain strictly private to the creating investigator to maintain strict regulatory and legal isolation.
            </div>
          </div>

          {/* Team Members Table Section */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#071512] shadow-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/[0.06] p-5">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search team members by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="text-xs text-slate-400">
                Total Team Members: <span className="font-semibold text-white">{filteredUsers.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No team members found. Click "Add Team Member" above to create an investigator account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-black/20 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">First-Time Password</th>
                      <th className="px-6 py-4">Access Status (Click to Decline / Allow)</th>
                      <th className="px-6 py-4">Assigned Rights</th>
                      <th className="px-6 py-4 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredUsers.map((u) => {
                      const isClientAdmin = u.role === "client_admin";
                      const isSelf = u.id === user?.id;
                      const isActive = u.is_active !== false;
                      const isToggling = togglingUserId === u.id;

                      return (
                        <tr key={u.id} className="transition hover:bg-white/[0.02]">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white text-sm flex items-center gap-2">
                              {u.username}
                              {isSelf && (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{u.email}</div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isClientAdmin
                                  ? "border border-amber-400/20 bg-amber-400/10 text-amber-300"
                                  : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                              }`}
                            >
                              {isClientAdmin ? "Company Admin" : "Investigator"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {u.first_login ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Prompt Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Completed
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {isSelf ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  Allowed (Admin)
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleUserStatus(u)}
                                className={`group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                                  isActive
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                                }`}
                                title={
                                  isActive
                                    ? "Click to Decline / Bar this user's access"
                                    : "Click to Allow / Grant this user access"
                                }
                              >
                                {isToggling ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <span
                                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                      isActive ? "bg-emerald-500" : "bg-slate-700"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isActive ? "translate-x-3" : "translate-x-0"
                                      }`}
                                    />
                                  </span>
                                )}
                                <span>{isActive ? "Allowed (Active)" : "Declined (Barred)"}</span>
                              </button>
                            )}
                          </td>

                          {/* ASSIGNED RIGHTS */}
                          <td className="px-6 py-4">
                            {isClientAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                Full Admin Access
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5 min-w-[210px]">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                      u.permissions?.can_create_case
                                        ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                        : "border border-rose-500/20 bg-rose-500/10 text-rose-400 line-through"
                                    }`}
                                    title={u.permissions?.can_create_case ? "Case Creation Allowed" : "Case Creation Denied"}
                                  >
                                    {u.permissions?.can_create_case ? "+ Case" : "No Case"}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                      u.permissions?.can_upload_files
                                        ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                        : "border border-rose-500/20 bg-rose-500/10 text-rose-400 line-through"
                                    }`}
                                    title={u.permissions?.can_upload_files ? "Upload Files Allowed" : "Upload Denied"}
                                  >
                                    {u.permissions?.can_upload_files ? "+ Upload" : "No Upload"}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                      u.permissions?.can_update_files
                                        ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                        : "border border-rose-500/20 bg-rose-500/10 text-rose-400 line-through"
                                    }`}
                                    title={u.permissions?.can_update_files ? "Update Files Allowed" : "Update Denied"}
                                  >
                                    {u.permissions?.can_update_files ? "✎ Edit File" : "No Edit"}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                      u.permissions?.can_delete_files
                                        ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                        : "border border-rose-500/20 bg-rose-500/10 text-rose-400 line-through"
                                    }`}
                                    title={u.permissions?.can_delete_files ? "Delete Files Allowed" : "Delete Denied"}
                                  >
                                    {u.permissions?.can_delete_files ? "🗑 Del File" : "No Del"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditRightsUser(u);
                                    setEditPermissions({
                                      can_create_case: u.permissions?.can_create_case ?? true,
                                      can_upload_files: u.permissions?.can_upload_files ?? true,
                                      can_update_files: u.permissions?.can_update_files ?? true,
                                      can_delete_files: u.permissions?.can_delete_files ?? true,
                                    });
                                    setEditRightsError("");
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline transition self-start"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  Manage Rights
                                </button>
                              </div>
                            )}
                          </td>


                          <td className="px-6 py-4 text-right text-slate-400 text-[11px]">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
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
          ADD TEAM MEMBER MODAL
      ========================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-8 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-emerald-400/20 bg-[#071512] p-6 sm:p-7 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                  New Member Onboarding
                </span>
                <h2 className="text-lg font-bold text-white">Add Team Member</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setModalTab("credentials");
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="mt-4 flex rounded-xl bg-black/40 p-1 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setModalTab("credentials")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  modalTab === "credentials"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                1. Account Details
              </button>
              {formData.role !== "client_admin" && (
                <button
                  type="button"
                  onClick={() => setModalTab("rights")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    modalTab === "rights"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>2. Access Rights</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </button>
              )}
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

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              {modalTab === "credentials" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. investigator_01"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Temporary Initial Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      The user will be prompted to change or keep this password upon their first login.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-[#0a1f1b] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="user">User / Investigator</option>
                      <option value="client_admin">Client Admin</option>
                    </select>
                  </div>

                  {formData.role === "user" && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-[11px] text-emerald-300 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">Default Rights Assigned</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Create cases, upload, update & delete files are enabled.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalTab("rights")}
                        className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition shrink-0"
                      >
                        Customize Rights →
                      </button>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-1/3 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                    >
                      Cancel
                    </button>
                    {formData.role === "user" ? (
                      <div className="flex w-2/3 gap-2">
                        <button
                          type="button"
                          onClick={() => setModalTab("rights")}
                          className="w-1/2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                          Next: Rights →
                        </button>
                        <button
                          type="submit"
                          disabled={createLoading}
                          className="w-1/2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                        >
                          {createLoading ? "Creating..." : "Create"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={createLoading}
                        className="w-2/3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                      >
                        {createLoading ? "Creating..." : "Create Admin"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* RIGHTS CONFIGURATION TAB */
                <div className="space-y-4">
                  {/* Immutable Case Policy Notice */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                    <svg className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <strong className="font-semibold text-white">Case Integrity Rule:</strong> Once created, cases cannot be deleted by anyone. Parent cases cannot be edited; all updates and new data belong under that case.
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setFormPermissions({ can_create_case: true, can_upload_files: true, can_update_files: true, can_delete_files: true })}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Full Investigator
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPermissions({ can_create_case: true, can_upload_files: true, can_update_files: true, can_delete_files: false })}
                      className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-300 hover:bg-teal-500/20"
                    >
                      Upload & Work (No Delete)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPermissions({ can_create_case: false, can_upload_files: false, can_update_files: false, can_delete_files: false })}
                      className="rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      Read-Only Analyst
                    </button>
                  </div>

                  {/* Case Rights */}
                  <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 space-y-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      📁 Case Rights
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-semibold text-white">Create New Cases</div>
                        <div className="text-[10px] text-slate-400">Allow user to initiate and create investigation cases</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...formPermissions, can_create_case: !formPermissions.can_create_case })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          formPermissions.can_create_case ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formPermissions.can_create_case ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.01] opacity-60 cursor-not-allowed">
                      <div>
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                          Delete Cases
                          <span className="rounded bg-rose-500/20 px-1 py-0.5 text-[9px] font-bold text-rose-300">
                            Locked by Policy
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">Cases cannot be deleted once created to ensure audit compliance</div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-slate-800"
                      >
                        <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-500 shadow ring-0 translate-x-0" />
                      </button>
                    </div>
                  </div>

                  {/* File Rights (Under Case) */}
                  <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 space-y-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      📄 File Rights (Under Case)
                    </div>

                    {/* Can Upload Files */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-semibold text-white">Upload Files</div>
                        <div className="text-[10px] text-slate-400">Allow uploading bank statements & documents under case</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...formPermissions, can_upload_files: !formPermissions.can_upload_files })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          formPermissions.can_upload_files ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formPermissions.can_upload_files ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Can Update Files */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-semibold text-white">Update Files</div>
                        <div className="text-[10px] text-slate-400">Allow modifying file details, passwords or re-triggering analysis</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...formPermissions, can_update_files: !formPermissions.can_update_files })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          formPermissions.can_update_files ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formPermissions.can_update_files ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Can Delete Files */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-semibold text-white">Delete Files</div>
                        <div className="text-[10px] text-slate-400">Allow removing uploaded files and statements from cases</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...formPermissions, can_delete_files: !formPermissions.can_delete_files })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          formPermissions.can_delete_files ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formPermissions.can_delete_files ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setModalTab("credentials")}
                      className="w-1/3 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-2/3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                    >
                      {createLoading ? "Creating..." : "Create User with Rights"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          EDIT RIGHTS MODAL (For existing members)
      ========================================================== */}
      {editRightsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-8 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-emerald-400/20 bg-[#071512] p-6 sm:p-7 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                  Access Permissions & Rights
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{editRightsUser.username}</span>
                  <span className="text-xs text-slate-400 font-normal">({editRightsUser.email})</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditRightsUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {editRightsError && (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/15 p-3.5 text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{editRightsError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditRightsError("")}
                  className="text-rose-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSaveEditedPermissions} className="mt-5 space-y-4">
              {/* Immutable Case Policy Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                <svg className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <strong className="font-semibold text-white">Case Integrity Rule:</strong> Once created, cases cannot be deleted. Parent cases cannot be modified; all operations are performed on files under the case.
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Presets:</span>
                <button
                  type="button"
                  onClick={() => setEditPermissions({ can_create_case: true, can_upload_files: true, can_update_files: true, can_delete_files: true })}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  Full Investigator
                </button>
                <button
                  type="button"
                  onClick={() => setEditPermissions({ can_create_case: true, can_upload_files: true, can_update_files: true, can_delete_files: false })}
                  className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-300 hover:bg-teal-500/20"
                >
                  Upload & Work (No Delete)
                </button>
                <button
                  type="button"
                  onClick={() => setEditPermissions({ can_create_case: false, can_upload_files: false, can_update_files: false, can_delete_files: false })}
                  className="rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Read-Only Analyst
                </button>
              </div>

              {/* Case Rights */}
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  📁 Case Rights
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <div>
                    <div className="text-xs font-semibold text-white">Create New Cases</div>
                    <div className="text-[10px] text-slate-400">Allow user to initiate and create investigation cases</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditPermissions({ ...editPermissions, can_create_case: !editPermissions.can_create_case })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editPermissions.can_create_case ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editPermissions.can_create_case ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.01] opacity-60 cursor-not-allowed">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      Delete Cases
                      <span className="rounded bg-rose-500/20 px-1 py-0.5 text-[9px] font-bold text-rose-300">
                        Locked by Policy
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">Cases cannot be deleted once created</div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-slate-800"
                  >
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-500 shadow ring-0 translate-x-0" />
                  </button>
                </div>
              </div>

              {/* File Rights (Under Case) */}
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  📄 File Rights (Under Case)
                </div>

                {/* Can Upload Files */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <div>
                    <div className="text-xs font-semibold text-white">Upload Files</div>
                    <div className="text-[10px] text-slate-400">Allow uploading bank statements & documents under case</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditPermissions({ ...editPermissions, can_upload_files: !editPermissions.can_upload_files })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editPermissions.can_upload_files ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editPermissions.can_upload_files ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Can Update Files */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <div>
                    <div className="text-xs font-semibold text-white">Update Files</div>
                    <div className="text-[10px] text-slate-400">Allow modifying file details, passwords or re-triggering analysis</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditPermissions({ ...editPermissions, can_update_files: !editPermissions.can_update_files })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editPermissions.can_update_files ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editPermissions.can_update_files ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Can Delete Files */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <div>
                    <div className="text-xs font-semibold text-white">Delete Files</div>
                    <div className="text-[10px] text-slate-400">Allow removing uploaded files and statements from cases</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditPermissions({ ...editPermissions, can_delete_files: !editPermissions.can_delete_files })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editPermissions.can_delete_files ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editPermissions.can_delete_files ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditRightsUser(null)}
                  className="w-1/3 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editRightsLoading}
                  className="w-2/3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                >
                  {editRightsLoading ? "Saving Rights..." : "Save Rights"}
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

