import { useEffect, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";
import {
  getUsers,
  createUser,
  updateUserStatus,
  updateUserPermissions,
  deleteUser,
  updateUserDetails,
} from "../../services/api/user";
import { useAuth } from "../../context/AuthContext";
import AuditLogTable from "../../components/audit/AuditLogTable";
import AdminCaseReportSelector from "../../components/admin/AdminCaseReportSelector";

const DEFAULT_PERMISSIONS = {
  // CASE
  can_view_cases: true,
  can_create_case: true,

  // FILES
  can_upload_files: true,
  can_delete_files: true,

  // REPORTS
  can_view_reports: true,

  // IO
  can_view_io: true,
  can_create_io: true,
  can_update_io: true,
  can_delete_io: true,

  // ANALYSIS MODULES
  can_bank_statement_analysis: false,
  can_ncrp_statement_analysis: false,

  // FACT SERVICES RIGHTS
  can_gst_advance_search: false,
  can_cin_advance_search: false,
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

  // View & Edit User Modals State
  const [viewUserModal, setViewUserModal] = useState(null);
  const [editUserModal, setEditUserModal] = useState(null);
  const [editFormData, setEditFormData] = useState({ username: "", email: "", password: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Prevent background scrolling when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(isModalOpen || editRightsUser || viewUserModal || editUserModal);
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isModalOpen, editRightsUser, viewUserModal, editUserModal]);

  // Support Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (editRightsUser) {
          setEditRightsUser(null);
        } else if (isModalOpen) {
          setIsModalOpen(false);
          setModalTab("credentials");
        } else if (viewUserModal) {
          setViewUserModal(null);
        } else if (editUserModal) {
          setEditUserModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editRightsUser, isModalOpen, viewUserModal, editUserModal]);

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user?.id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete user " + targetUser.username + "?")) return;
    try {
      await deleteUser(targetUser.id);
      setSuccess("User " + targetUser.username + " deleted successfully.");
      fetchTeam(true);
    } catch (err) {
      setError(err?.message || "Failed to delete user.");
    }
  };

  const handleViewUser = (targetUser) => {
    setViewUserModal(targetUser);
  };

  const handleEditUser = (targetUser) => {
    if (targetUser.id === user?.id) {
      alert("Please update your own profile through settings.");
      return;
    }
    setEditUserModal(targetUser);
    setEditFormData({
      username: targetUser.username,
      email: targetUser.email,
      password: "",
    });
  };

  const submitEditUser = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setModalError("");
    try {
      await updateUserDetails(editUserModal.id, {
        username: editFormData.username,
        email: editFormData.email,
        password: editFormData.password || undefined,
      });
      setSuccess("User updated successfully");
      setEditUserModal(null);
      fetchTeam(true);
    } catch (err) {
      setModalError(err?.message || "Failed to update user.");
    } finally {
      setEditLoading(false);
    }
  };

  const fetchTeam = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const res = await getUsers();
      const list = res?.users || res?.items || (Array.isArray(res) ? res : []);
      setUsers(list);
      setQuota(res?.quota || null);
    } catch (err) {
      if (!silent) setError(err?.message || "Failed to load team members.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  // Real-time Admin Dashboard WebSocket listener
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isMounted = true;

    function connectWs() {
      const token = localStorage.getItem("antidrone_access_token");
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8082";
      const wsProto = baseUrl.startsWith("https") ? "wss" : "ws";
      const host = baseUrl.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProto}://${host}/api/v1/ws/admin-dashboard?token=${encodeURIComponent(token)}`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.event === "dashboard_refresh") {
              fetchTeam(true);
            }
          } catch (e) {
            console.warn("WebSocket parse error:", e);
          }
        };

        ws.onclose = (event) => {
          if (isMounted && event.code !== 1000 && event.code !== 1008) {
            reconnectTimeout = setTimeout(() => {
              if (isMounted) connectWs();
            }, 3000);
          }
        };

        ws.onerror = () => {
          // Connection failures trigger onclose
        };
      } catch (e) {
        console.warn("WebSocket init error:", e);
      }
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close(1000, "Dashboard unmounted");
      }
    };
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

  // 6 KPIs
  const totalLicenseIssued = quota?.total_licenses ?? quota?.max_seats ?? quota?.max_users ?? 0;
  const activeUsersCount = quota?.active_users ?? users.filter((u) => u.is_active !== false).length;
  const inactiveUsersCount = quota?.inactive_users ?? users.filter((u) => u.is_active === false).length;
  const availableLicenses =
    quota?.available_licenses ?? quota?.remaining_seats ?? Math.max(0, totalLicenseIssued - users.length);
  const todayUserLogins = quota?.today_login_count ?? 0;
  const totalUsersCount = quota?.total_users ?? users.length;

  const occupiedSeats = quota?.used_seats ?? users.length;
  const maxSeats = totalLicenseIssued;
  const isLimitReached = quota?.is_limit_reached ?? (occupiedSeats >= maxSeats && maxSeats > 0);

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
          {/* Dashboard Header Section */}
          <section className="arthbodh-anim-enter mb-8 flex flex-col justify-between gap-5 sm:gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Company Administration
                </span>
                <span className="h-3 w-px bg-slate-300" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Enterprise Seat Quota
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                Team Members &amp; <span className="text-[#059669]">Seat Quota</span>
              </h1>

              <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-[#64748B]">
                Manage your organization&apos;s investigator accounts within your allocated enterprise seat capacity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isLimitReached}
                onClick={() => setIsModalOpen(true)}
                className={`group inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-all duration-200 shadow-sm ${
                  isLimitReached
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                    : "bg-[#059669] text-white shadow-emerald-900/10 hover:-translate-y-0.5 hover:bg-[#047857] hover:shadow-md hover:shadow-emerald-900/20 active:translate-y-0"
                }`}
                title={isLimitReached ? "Seat limit reached. Contact SuperAdmin." : "Add new investigator"}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Team Member
              </button>
            </div>
          </section>

          {/* Navigation Tabs - Modern Segmented Control */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="inline-flex rounded-2xl bg-white p-1.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                  activeTab === "team"
                    ? "bg-[#059669] text-white shadow-sm shadow-emerald-900/15"
                    : "text-slate-600 hover:text-[#172554] hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span>Team Members</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    activeTab === "team"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {users.length}
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
                <span>Audit &amp; Activity Log</span>
                <span className="flex h-2 w-2 relative ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Live System Sync Active</span>
            </div>
          </div>

          {activeTab === "audit" ? (
            <AuditLogTable isSuperAdmin={false} theme="light" />
          ) : activeTab === "reports" ? (
            <AdminCaseReportSelector />
          ) : (
            <>
              {/* Seat Limit Warning Banner */}
              {isLimitReached && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700 shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="leading-relaxed">
                    <strong className="font-bold text-amber-950 uppercase tracking-wide">
                      Seat Limit Reached:
                    </strong>{" "}
                    You have utilized all{" "}
                    <span className="font-bold text-[#172554]">
                      {maxSeats} / {maxSeats}
                    </span>{" "}
                    available seats allocated to your company. To onboard additional team members, please
                    contact the Product Owner (SuperAdmin) to expand your company seat quota.
                  </div>
                </div>
              )}

              {/* Feedback Alerts */}
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

              {/* Admin Dashboard 6 KPI Section */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {/* 1. Total License Issued */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total License Issued
                    </span>
                    <span className="rounded-xl bg-indigo-50 border border-indigo-100 p-2 text-indigo-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-[#172554] sm:text-3xl">
                    {totalLicenseIssued}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Company allocated seat quota</div>
                </div>

                {/* 2. Total Users */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Users
                    </span>
                    <span className="rounded-xl bg-sky-50 border border-sky-100 p-2 text-sky-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-sky-700 sm:text-3xl">
                    {totalUsersCount}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Onboarded company accounts</div>
                </div>

                {/* 3. Active Users */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Active Users
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
                    {activeUsersCount}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Active status accounts</div>
                </div>

                {/* 4. Inactive Users */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Inactive Users
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
                  <div className="mt-3 text-2xl font-extrabold text-rose-600 sm:text-3xl">
                    {inactiveUsersCount}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Barred / access declined</div>
                </div>

                {/* 5. Available Licenses */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Available Licenses
                    </span>
                    <span className="rounded-xl bg-teal-50 border border-teal-100 p-2 text-teal-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-teal-700 sm:text-3xl">
                    {availableLicenses}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Ready for user onboarding</div>
                </div>

                {/* 6. Today's User Login */}
                <div className="arthbodh-kpi-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Today&apos;s User Login
                    </span>
                    <span className="rounded-xl bg-amber-50 border border-amber-100 p-2 text-amber-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-amber-700 sm:text-3xl">
                    {todayUserLogins}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Distinct user logins today</div>
                </div>
              </div>

              {/* Team Members Table Section */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 p-5 bg-white">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#172554]">
                      Team Members
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage user credentials, investigate assignments, and toggle portal access.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-72">
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
                        placeholder="Search by username or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchTeam()}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-[#172554]"
                      title="Refresh Team Members"
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
                      Members: <span className="font-extrabold text-[#172554]">{filteredUsers.length}</span>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                    <span className="mt-3 text-xs text-slate-500 font-medium">Loading team members...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs">
                    No team members found. Click &quot;Add Team Member&quot; above to create an investigator account.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">First-Time Password</th>
                          <th className="px-6 py-4">Access Status (Click to Toggle)</th>
                          <th className="px-6 py-4">Assigned Rights</th>
                          <th className="px-6 py-4 text-right">Joined</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredUsers.map((u) => {
                          const isClientAdmin = u.role === "client_admin";
                          const isSelf = u.id === user?.id;
                          const isActive = u.is_active !== false;
                          const isToggling = togglingUserId === u.id;

                          return (
                            <tr key={u.id} className="transition hover:bg-slate-50/70">
                              {/* USER */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#172554] font-bold border border-slate-200 text-xs">
                                    {u.username ? u.username.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-[#172554] text-sm flex items-center gap-2">
                                      <span>{u.username}</span>
                                      {isSelf && (
                                        <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-800">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{u.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* ROLE */}
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    isClientAdmin
                                      ? "border border-amber-200 bg-amber-50 text-amber-800"
                                      : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  {isClientAdmin ? "Company Admin" : "Investigator"}
                                </span>
                              </td>

                              {/* FIRST-TIME PASSWORD */}
                              <td className="px-6 py-4">
                                {u.first_login ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Prompt Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Completed
                                  </span>
                                )}
                              </td>

                              {/* ACCESS STATUS TOGGLE */}
                              <td className="px-6 py-4">
                                {isSelf ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                    Allowed (Admin)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() => handleToggleUserStatus(u)}
                                    className={`group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                                      isActive
                                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                        : "border-rose-200 bg-rose-50/70 text-rose-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
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
                                          isActive ? "bg-emerald-600" : "bg-slate-300"
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
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    Full Admin Access
                                  </span>
                                ) : (
                                  <div className="flex flex-col gap-1.5 min-w-[210px]">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_view_cases !== false
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_view_cases !== false
                                            ? "View Cases Allowed"
                                            : "View Cases Denied"
                                        }
                                      >
                                        {u.permissions?.can_view_cases !== false ? "Cases" : "No Case View"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_create_case
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_create_case
                                            ? "Case Creation Allowed"
                                            : "Case Creation Denied"
                                        }
                                      >
                                        {u.permissions?.can_create_case ? "+ Case" : "No Create"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_upload_files
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_upload_files ? "Upload Allowed" : "Upload Denied"
                                        }
                                      >
                                        {u.permissions?.can_upload_files ? "+ Upload" : "No Upload"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_delete_files
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_delete_files ? "Delete Allowed" : "Delete Denied"
                                        }
                                      >
                                        {u.permissions?.can_delete_files ? "Del File" : "No Del"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_view_reports !== false
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_view_reports !== false
                                            ? "Reports Allowed"
                                            : "Reports Denied"
                                        }
                                      >
                                        {u.permissions?.can_view_reports !== false ? "Reports" : "No Reports"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_view_io !== false
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={u.permissions?.can_view_io !== false ? "IO Allowed" : "IO Denied"}
                                      >
                                        {u.permissions?.can_view_io !== false ? "IO" : "No IO"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_bank_statement_analysis
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_bank_statement_analysis
                                            ? "Bank Statement Analysis Allowed"
                                            : "Bank Statement Analysis Denied"
                                        }
                                      >
                                        {u.permissions?.can_bank_statement_analysis ? "Bank Stmt" : "No Bank"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          u.permissions?.can_ncrp_statement_analysis
                                            ? "border border-purple-200 bg-purple-50 text-purple-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          u.permissions?.can_ncrp_statement_analysis
                                            ? "NCRP Statement Analysis Allowed"
                                            : "NCRP Statement Analysis Denied"
                                        }
                                      >
                                        {u.permissions?.can_ncrp_statement_analysis ? "NCRP Stmt" : "No NCRP"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          (u.permissions?.can_gst_advance_search ?? u.permissions?.gst_advance_search)
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          (u.permissions?.can_gst_advance_search ?? u.permissions?.gst_advance_search)
                                            ? "GST Advance Search Allowed"
                                            : "GST Advance Search Denied"
                                        }
                                      >
                                        {(u.permissions?.can_gst_advance_search ?? u.permissions?.gst_advance_search) ? "GST" : "No GST"}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                          (u.permissions?.can_cin_advance_search ?? u.permissions?.cin_advance_search)
                                            ? "border border-blue-200 bg-blue-50 text-blue-800"
                                            : "border border-slate-200 bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title={
                                          (u.permissions?.can_cin_advance_search ?? u.permissions?.cin_advance_search)
                                            ? "CIN Advance Search Allowed"
                                            : "CIN Advance Search Denied"
                                        }
                                      >
                                        {(u.permissions?.can_cin_advance_search ?? u.permissions?.cin_advance_search) ? "CIN" : "No CIN"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditRightsUser(u);
                                        setEditPermissions({
                                          can_view_cases: u.permissions?.can_view_cases ?? true,
                                          can_create_case: u.permissions?.can_create_case ?? true,
                                          can_upload_files: u.permissions?.can_upload_files ?? true,
                                          can_delete_files: u.permissions?.can_delete_files ?? true,
                                          can_view_reports: u.permissions?.can_view_reports ?? true,
                                          can_view_io: u.permissions?.can_view_io ?? true,
                                          can_create_io: u.permissions?.can_create_io ?? true,
                                          can_update_io: u.permissions?.can_update_io ?? true,
                                          can_delete_io: u.permissions?.can_delete_io ?? true,
                                          can_bank_statement_analysis: Boolean(u.permissions?.can_bank_statement_analysis),
                                          can_ncrp_statement_analysis: Boolean(u.permissions?.can_ncrp_statement_analysis),
                                          can_gst_advance_search: Boolean(u.permissions?.can_gst_advance_search ?? u.permissions?.gst_advance_search),
                                          can_cin_advance_search: Boolean(u.permissions?.can_cin_advance_search ?? u.permissions?.cin_advance_search),
                                        });
                                        setEditRightsError("");
                                      }}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition self-start"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                      </svg>
                                      Manage Rights
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* JOINED */}
                              <td className="px-6 py-4 text-right text-slate-500 text-[11px]">
                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                              </td>

                              {/* ACTIONS */}
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleViewUser(u)}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#172554] shadow-2xs transition"
                                    title="View User"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs transition"
                                    title="Edit User"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-rose-200 bg-rose-50/60 text-rose-800 hover:bg-rose-100 hover:border-rose-300 shadow-2xs transition"
                                    title="Delete User"
                                  >
                                    Delete
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
          ADD TEAM MEMBER MODAL
      ========================================================== */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
              setModalTab("credentials");
            }
          }}
        >
          <div 
            className="relative flex flex-col w-full max-w-[620px] max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] rounded-2xl border border-slate-200 bg-white shadow-2xl text-[#172033] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-6 pt-5 pb-4 sm:px-7">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                    New Member Onboarding
                  </span>
                  <h2 id="add-user-modal-title" className="text-lg font-extrabold text-[#172554]">Add Team Member</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalTab("credentials");
                  }}
                  aria-label="Close modal"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* TAB SELECTOR */}
              <div className="mt-3.5 flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalTab("credentials")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    modalTab === "credentials"
                      ? "bg-white text-[#172554] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  1. Account Details
                </button>
                {formData.role !== "client_admin" && (
                  <button
                    type="button"
                    onClick={() => setModalTab("rights")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      modalTab === "rights"
                        ? "bg-white text-[#172554] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>2. Access Rights</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="flex flex-1 flex-col min-h-0 overflow-hidden">
              {/* SCROLLABLE BODY */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 sm:px-7 space-y-4">
                {modalError && (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
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
                      aria-label="Dismiss error"
                      className="text-rose-600 hover:text-rose-900 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {modalTab === "credentials" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. investigator_01"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. user@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Temporary Initial Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="At least 6 characters"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        The user will be prompted to change or retain this password upon their first login.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                      >
                        <option value="user">User / Investigator</option>
                        <option value="client_admin">Client Admin</option>
                      </select>
                    </div>

                    {formData.role === "user" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[11px] text-emerald-900 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#172554]">Default Rights Assigned</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            Create cases, upload, update &amp; delete files are enabled.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModalTab("rights")}
                          className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shrink-0 shadow-2xs"
                        >
                          Customize Rights →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* RIGHTS CONFIGURATION TAB */
                  <div className="space-y-4">
                    {/* Immutable Case Policy Notice */}
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                      <svg
                        className="h-4 w-4 shrink-0 text-amber-600 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <strong className="font-bold text-amber-950">Case Integrity Rule:</strong> Once created, cases
                        cannot be deleted by anyone. Parent cases cannot be edited; all updates and new data belong
                        under that case.
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Presets:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormPermissions({
                            can_view_cases: true,
                            can_create_case: true,
                            can_upload_files: true,
                            can_delete_files: true,
                            can_view_reports: true,
                            can_view_io: true,
                            can_create_io: true,
                            can_update_io: true,
                            can_delete_io: true,
                            can_bank_statement_analysis: true,
                            can_ncrp_statement_analysis: true,
                            can_gst_advance_search: true,
                            can_cin_advance_search: true,
                          })
                        }
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                      >
                        Full Investigator
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormPermissions({
                            can_view_cases: true,
                            can_create_case: true,
                            can_upload_files: true,
                            can_delete_files: false,
                            can_view_reports: true,
                            can_view_io: true,
                            can_create_io: true,
                            can_update_io: true,
                            can_delete_io: false,
                            can_bank_statement_analysis: true,
                            can_ncrp_statement_analysis: true,
                            can_gst_advance_search: true,
                            can_cin_advance_search: true,
                          })
                        }
                        className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
                      >
                        Upload &amp; Work (No Delete)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormPermissions({
                            can_view_cases: true,
                            can_create_case: false,
                            can_upload_files: false,
                            can_delete_files: false,
                            can_view_reports: true,
                            can_view_io: true,
                            can_create_io: false,
                            can_update_io: false,
                            can_delete_io: false,
                            can_bank_statement_analysis: true,
                            can_ncrp_statement_analysis: true,
                            can_gst_advance_search: true,
                            can_cin_advance_search: true,
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition shadow-2xs"
                      >
                        Read-Only Analyst
                      </button>
                    </div>

                    {/* 1. Case Rights */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        📁 Case Rights
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">View Cases</div>
                          <div className="text-[10px] text-slate-500">Allow user to view and search assigned cases</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_view_cases: !formPermissions.can_view_cases,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_view_cases !== false ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_view_cases !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Create New Cases</div>
                          <div className="text-[10px] text-slate-500">
                            Allow user to initiate and create investigation cases
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_create_case: !formPermissions.can_create_case,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_create_case ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_create_case ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 opacity-70 cursor-not-allowed">
                        <div>
                          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                            Delete Cases
                            <span className="rounded bg-rose-100 border border-rose-200 px-1 py-0.5 text-[9px] font-bold text-rose-800">
                              Locked by Policy
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">Cases cannot be deleted once created</div>
                        </div>
                        <button
                          type="button"
                          disabled
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-slate-300"
                        >
                          <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-400 shadow ring-0 translate-x-0" />
                        </button>
                      </div>
                    </div>

                    {/* 2. File Rights (Under Case) */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                        📄 File Rights (Under Case)
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Upload Files</div>
                          <div className="text-[10px] text-slate-500">
                            Allow uploading bank statements &amp; documents under case
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_upload_files: !formPermissions.can_upload_files,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_upload_files ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_upload_files ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Delete Files</div>
                          <div className="text-[10px] text-slate-500">
                            Allow removing uploaded files and statements from cases
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_delete_files: !formPermissions.can_delete_files,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_delete_files ? "bg-emerald-600" : "bg-slate-300"
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

                    {/* 3. Report Rights */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">
                        📊 Reports Rights
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">View Reports</div>
                          <div className="text-[10px] text-slate-500">
                            Allow viewing analytical reports, transaction summaries &amp; charts
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_view_reports: !formPermissions.can_view_reports,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_view_reports !== false ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_view_reports !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 4. IO Rights */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        👮 Investigating Officer (IO) Rights
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">View IOs</div>
                          <div className="text-[10px] text-slate-500">
                            Allow viewing assigned Investigating Officers
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_view_io: !formPermissions.can_view_io,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_view_io !== false ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_view_io !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Create IO</div>
                          <div className="text-[10px] text-slate-500">
                            Allow registering new Investigating Officers
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_create_io: !formPermissions.can_create_io,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_create_io ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_create_io ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Update IO</div>
                          <div className="text-[10px] text-slate-500">
                            Allow updating officer name, rank, or police station
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_update_io: !formPermissions.can_update_io,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_update_io ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_update_io ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Delete IO</div>
                          <div className="text-[10px] text-slate-500">Allow removing assigned Investigating Officers</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_delete_io: !formPermissions.can_delete_io,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_delete_io ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_delete_io ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 5. Analysis Modules Rights */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                        ⚡ 5. Analysis Modules Rights
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">Bank Statement Analysis</div>
                          <div className="text-[10px] text-slate-500">
                            Allows the user to access bank statement upload and bank statement analysis features.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_bank_statement_analysis: !formPermissions.can_bank_statement_analysis,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_bank_statement_analysis ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_bank_statement_analysis ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">NCRP Statement Analysis</div>
                          <div className="text-[10px] text-slate-500">
                            Allows the user to access NCRP statement upload and NCRP transaction analysis features.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_ncrp_statement_analysis: !formPermissions.can_ncrp_statement_analysis,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_ncrp_statement_analysis ? "bg-purple-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_ncrp_statement_analysis ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 6. FACT Services Rights */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        🌐 6. FACT SERVICES RIGHTS
                      </div>

                      {/* GST Advance Search */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">GST Advance Search</div>
                          <div className="text-[10px] text-slate-500">
                            Allows the user to access FACT GST Advance Search, submit GSTIN queries, and view GST results.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_gst_advance_search: !formPermissions.can_gst_advance_search,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_gst_advance_search ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_gst_advance_search ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* CIN Advance Search */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-[#172554]">CIN Advance Search</div>
                          <div className="text-[10px] text-slate-500">
                            Allows the user to access FACT CIN Advance Search, submit company identification searches, and view CIN results.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormPermissions({
                              ...formPermissions,
                              can_cin_advance_search: !formPermissions.can_cin_advance_search,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            formPermissions.can_cin_advance_search ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formPermissions.can_cin_advance_search ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STICKY FOOTER */}
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white px-6 py-4 sm:px-7">
                {modalTab === "credentials" ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-1/3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    {formData.role === "user" ? (
                      <div className="flex w-2/3 gap-2">
                        <button
                          type="button"
                          onClick={() => setModalTab("rights")}
                          className="w-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                        >
                          Next: Rights →
                        </button>
                        <button
                          type="submit"
                          disabled={createLoading}
                          className="w-1/2 rounded-xl bg-[#059669] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                        >
                          {createLoading ? "Creating..." : "Create"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={createLoading}
                        className="w-2/3 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                      >
                        {createLoading ? "Creating..." : "Create Admin"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setModalTab("credentials")}
                      className="w-1/3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-2/3 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                    >
                      {createLoading ? "Creating..." : "Create User with Rights"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          EDIT USER DETAILS MODAL
      ========================================================== */}
      {editUserModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditUserModal(null);
          }}
        >
          <div 
            className="relative flex flex-col w-full max-w-md max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] rounded-2xl border border-slate-200 bg-white shadow-2xl text-[#172033] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-base font-extrabold text-[#172554]">Edit User Details</h2>
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                aria-label="Close modal"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={submitEditUser} className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 space-y-4">
                {modalError && (
                  <div className="text-rose-800 text-xs bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-semibold">
                    {modalError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Password (Leave blank to keep unchanged)
                  </label>
                  <input
                    type="password"
                    minLength="6"
                    placeholder="Leave empty to retain existing"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-[#059669] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW USER DETAILS MODAL
      ========================================================== */}
      {viewUserModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewUserModal(null);
          }}
        >
          <div 
            className="relative flex flex-col w-full max-w-md max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] rounded-2xl border border-slate-200 bg-white shadow-2xl text-[#172033] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-base font-extrabold text-[#172554]">User Details</h2>
              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                aria-label="Close modal"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Username:</span>
                <span className="col-span-2 font-bold text-[#172554] text-sm">{viewUserModal.username}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Email:</span>
                <span className="col-span-2 text-slate-700 font-medium">{viewUserModal.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Role:</span>
                <span className="col-span-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      viewUserModal.role === "client_admin"
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {viewUserModal.role === "client_admin" ? "Company Admin" : "Investigator"}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Status:</span>
                <span className="col-span-2 font-bold">
                  {viewUserModal.is_active !== false ? (
                    <span className="text-emerald-700">Active (Access Allowed)</span>
                  ) : (
                    <span className="text-rose-600">Inactive (Barred)</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Joined:</span>
                <span className="col-span-2 text-slate-600">
                  {viewUserModal.created_at ? new Date(viewUserModal.created_at).toLocaleString() : "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Bank Analysis:</span>
                <span className="col-span-2 font-bold">
                  {viewUserModal.role === "client_admin" || viewUserModal.permissions?.can_bank_statement_analysis ? (
                    <span className="text-emerald-700">Allowed</span>
                  ) : (
                    <span className="text-slate-400">Restricted</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">NCRP Analysis:</span>
                <span className="col-span-2 font-bold">
                  {viewUserModal.role === "client_admin" || viewUserModal.permissions?.can_ncrp_statement_analysis ? (
                    <span className="text-purple-700">Allowed</span>
                  ) : (
                    <span className="text-slate-400">Restricted</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">GST Advance Search:</span>
                <span className="col-span-2 font-bold">
                  {viewUserModal.role === "client_admin" || (viewUserModal.permissions?.can_gst_advance_search ?? viewUserModal.permissions?.gst_advance_search) ? (
                    <span className="text-emerald-700">Allowed</span>
                  ) : (
                    <span className="text-slate-400">Restricted</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">CIN Advance Search:</span>
                <span className="col-span-2 font-bold">
                  {viewUserModal.role === "client_admin" || (viewUserModal.permissions?.can_cin_advance_search ?? viewUserModal.permissions?.cin_advance_search) ? (
                    <span className="text-blue-700">Allowed</span>
                  ) : (
                    <span className="text-slate-400">Restricted</span>
                  )}
                </span>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          EDIT RIGHTS MODAL (For existing members)
      ========================================================== */}
      {editRightsUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-rights-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditRightsUser(null);
          }}
        >
          <div 
            className="relative flex flex-col w-full max-w-[620px] max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] rounded-2xl border border-slate-200 bg-white shadow-2xl text-[#172033] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. STICKY HEADER */}
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:px-7">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Access Permissions &amp; Rights
                </span>
                <h2 id="edit-rights-modal-title" className="text-lg font-extrabold text-[#172554] flex items-center gap-2">
                  <span>{editRightsUser.username}</span>
                  <span className="text-xs text-slate-500 font-normal">({editRightsUser.email})</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditRightsUser(null)}
                aria-label="Close permissions modal"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* FORM WRAPPING BODY & FOOTER */}
            <form onSubmit={handleSaveEditedPermissions} className="flex flex-1 flex-col min-h-0 overflow-hidden">
              {/* 2. SCROLLABLE BODY */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 sm:px-7 space-y-4">
                {editRightsError && (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
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
                      <span>{editRightsError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditRightsError("")}
                      aria-label="Dismiss error"
                      className="text-rose-600 hover:text-rose-900 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Immutable Case Policy Notice */}
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <svg
                    className="h-4 w-4 shrink-0 text-amber-600 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <strong className="font-bold text-amber-950">Case Integrity Rule:</strong> Once created, cases
                    cannot be deleted. Parent cases cannot be modified; all operations are performed on files under the
                    case.
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Presets:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditPermissions({
                        can_view_cases: true,
                        can_create_case: true,
                        can_upload_files: true,
                        can_delete_files: true,
                        can_view_reports: true,
                        can_view_io: true,
                        can_create_io: true,
                        can_update_io: true,
                        can_delete_io: true,
                        can_bank_statement_analysis: true,
                        can_ncrp_statement_analysis: true,
                        can_gst_advance_search: true,
                        can_cin_advance_search: true,
                      })
                    }
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                  >
                    Full Investigator
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditPermissions({
                        can_view_cases: true,
                        can_create_case: true,
                        can_upload_files: true,
                        can_delete_files: false,
                        can_view_reports: true,
                        can_view_io: true,
                        can_create_io: true,
                        can_update_io: true,
                        can_delete_io: false,
                        can_bank_statement_analysis: true,
                        can_ncrp_statement_analysis: true,
                        can_gst_advance_search: true,
                        can_cin_advance_search: true,
                      })
                    }
                    className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
                  >
                    Upload &amp; Work (No Delete)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditPermissions({
                        can_view_cases: true,
                        can_create_case: false,
                        can_upload_files: false,
                        can_delete_files: false,
                        can_view_reports: true,
                        can_view_io: true,
                        can_create_io: false,
                        can_update_io: false,
                        can_delete_io: false,
                        can_bank_statement_analysis: true,
                        can_ncrp_statement_analysis: true,
                        can_gst_advance_search: true,
                        can_cin_advance_search: true,
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition shadow-2xs"
                  >
                    Read-Only Analyst
                  </button>
                </div>

                {/* 1. Case Rights */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    📁 Case Rights
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">View Cases</div>
                      <div className="text-[10px] text-slate-500">Allow user to view and search assigned cases</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_view_cases: !editPermissions.can_view_cases,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_view_cases !== false ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_view_cases !== false ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Create New Cases</div>
                      <div className="text-[10px] text-slate-500">
                        Allow user to initiate and create investigation cases
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_create_case: !editPermissions.can_create_case,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_create_case ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_create_case ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 opacity-70 cursor-not-allowed">
                    <div>
                      <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        Delete Cases
                        <span className="rounded bg-rose-100 border border-rose-200 px-1 py-0.5 text-[9px] font-bold text-rose-800">
                          Locked by Policy
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">Cases cannot be deleted once created</div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-slate-300"
                    >
                      <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-400 shadow ring-0 translate-x-0" />
                    </button>
                  </div>
                </div>

                {/* 2. File Rights (Under Case) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    📄 File Rights (Under Case)
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Upload Files</div>
                      <div className="text-[10px] text-slate-500">
                        Allow uploading bank statements &amp; documents under case
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_upload_files: !editPermissions.can_upload_files,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_upload_files ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_upload_files ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Delete Files</div>
                      <div className="text-[10px] text-slate-500">
                        Allow removing uploaded files and statements from cases
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_delete_files: !editPermissions.can_delete_files,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_delete_files ? "bg-emerald-600" : "bg-slate-300"
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

                {/* 3. Report Rights */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">
                    📊 Reports Rights
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">View Reports</div>
                      <div className="text-[10px] text-slate-500">
                        Allow viewing analytical reports, transaction summaries &amp; charts
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_view_reports: !editPermissions.can_view_reports,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_view_reports !== false ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_view_reports !== false ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 4. IO Rights */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    👮 Investigating Officer (IO) Rights
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">View IOs</div>
                      <div className="text-[10px] text-slate-500">
                        Allow viewing assigned Investigating Officers
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_view_io: !editPermissions.can_view_io,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_view_io !== false ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_view_io !== false ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Create IO</div>
                      <div className="text-[10px] text-slate-500">
                        Allow registering new Investigating Officers
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_create_io: !editPermissions.can_create_io,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_create_io ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_create_io ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Update IO</div>
                      <div className="text-[10px] text-slate-500">
                        Allow updating officer name, rank, or police station
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_update_io: !editPermissions.can_update_io,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_update_io ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_update_io ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Delete IO</div>
                      <div className="text-[10px] text-slate-500">Allow removing assigned Investigating Officers</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_delete_io: !editPermissions.can_delete_io,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_delete_io ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_delete_io ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 5. Analysis Modules Rights */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                    ⚡ 5. Analysis Modules Rights
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">Bank Statement Analysis</div>
                      <div className="text-[10px] text-slate-500">
                        Allows the user to access bank statement upload and bank statement analysis features.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_bank_statement_analysis: !editPermissions.can_bank_statement_analysis,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_bank_statement_analysis ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_bank_statement_analysis ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">NCRP Statement Analysis</div>
                      <div className="text-[10px] text-slate-500">
                        Allows the user to access NCRP statement upload and NCRP transaction analysis features.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_ncrp_statement_analysis: !editPermissions.can_ncrp_statement_analysis,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_ncrp_statement_analysis ? "bg-purple-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_ncrp_statement_analysis ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 6. FACT Services Rights */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    🌐 FACT SERVICES RIGHTS
                  </div>

                  {/* GST Advance Search */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">GST Advance Search</div>
                      <div className="text-[10px] text-slate-500">
                        Allows the user to access FACT GST Advance Search, submit GSTIN queries, and view GST results.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_gst_advance_search: !editPermissions.can_gst_advance_search,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_gst_advance_search ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_gst_advance_search ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* CIN Advance Search */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-[#172554]">CIN Advance Search</div>
                      <div className="text-[10px] text-slate-500">
                        Allows the user to access FACT CIN Advance Search, submit company identification searches, and view CIN results.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions({
                          ...editPermissions,
                          can_cin_advance_search: !editPermissions.can_cin_advance_search,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        editPermissions.can_cin_advance_search ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editPermissions.can_cin_advance_search ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. STICKY FOOTER */}
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white px-6 py-4 sm:px-7">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditRightsUser(null)}
                    className="w-1/3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editRightsLoading}
                    className="w-2/3 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-900/10 hover:bg-[#047857] transition disabled:opacity-50"
                  >
                    {editRightsLoading ? "Saving Rights..." : "Save Rights"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  );
}
