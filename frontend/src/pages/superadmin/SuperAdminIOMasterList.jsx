import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import {
  getIOMasters,
  createIOMaster,
  updateIOMaster,
  deleteIOMaster,
} from "../../services/api/ioMaster";
import { getClients } from "../../services/api/clients";
import { getUsers } from "../../services/api/user";
import CreateIOModal from "../../components/io_master/CreateIOModal";
import UserNavbar from "../../components/layout/UserNavbar";
import UserFooter from "../../components/layout/UserFooter";

const Icon = ({ name, size = 18, className = "" }) => {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true",
  };

  const paths = {
    badge: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </>
    ),
    refresh: (
      <>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    filter: (
      <>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    ),
    station: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    mail: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    ),
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  };

  return <svg {...shared}>{paths[name] || paths.badge}</svg>;
};

function StatCard({ label, value, note, icon, tone, loading, delay }) {
  const tones = {
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      number: "text-emerald-700",
      top: "bg-emerald-500",
    },
    blue: {
      icon: "bg-blue-50 text-blue-700 ring-blue-100",
      number: "text-[#172554]",
      top: "bg-blue-500",
    },
    indigo: {
      icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
      number: "text-indigo-600",
      top: "bg-indigo-500",
    },
  };
  const t = tones[tone] || tones.emerald;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${delay}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${t.top}`} />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            {label}
          </p>
          <div className="mt-2.5 flex items-baseline gap-2">
            {loading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <span className={`text-2xl font-black tracking-tight sm:text-3xl ${t.number}`}>
                {value}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-500">{note}</p>
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 shadow-xs ${t.icon}`}>
          <Icon name={icon} size={20} />
        </div>
      </div>
    </article>
  );
}

function formatDate(date) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SuperAdminIOMasterList() {
  const [officers, setOfficers] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load All Primary Data
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [ioRes, clientsRes, usersRes] = await Promise.all([
        getIOMasters(),
        getClients().catch((e) => {
          console.error("Failed to load clients:", e);
          return { data: [] };
        }),
        getUsers().catch((e) => {
          console.error("Failed to load users:", e);
          return { users: [] };
        }),
      ]);

      setOfficers(Array.isArray(ioRes?.data) ? ioRes.data : []);

      const clientList = Array.isArray(clientsRes?.data)
        ? clientsRes.data
        : Array.isArray(clientsRes)
          ? clientsRes
          : [];
      setClients(clientList);

      const userList =
        usersRes?.users ||
        usersRes?.items ||
        (Array.isArray(usersRes?.data) ? usersRes.data : Array.isArray(usersRes) ? usersRes : []);
      setUsers(userList);
    } catch (err) {
      console.error("Error loading Super Admin IO Master data:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to Load Records",
        text: err?.response?.data?.detail || err?.message || "An error occurred while loading data.",
        background: "#ffffff",
        color: "#172033",
        confirmButtonColor: "#059669",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Client Filter Change
  const handleCompanyChange = (e) => {
    const nextCompany = e.target.value;
    setSelectedCompany(nextCompany);

    // If changing company, reset user filter if selected user does not belong to the newly selected company
    if (selectedUser !== "ALL" && nextCompany !== "ALL") {
      const activeUser = users.find((u) => String(u.id) === String(selectedUser));
      if (!activeUser || String(activeUser.client_id) !== nextCompany) {
        setSelectedUser("ALL");
      }
    }
  };

  // Build Company Options for Filter Dropdown
  const companyOptions = useMemo(() => {
    const map = new Map();

    clients.forEach((c) => {
      if (c?.id) {
        map.set(String(c.id), {
          id: String(c.id),
          name: c.name || `Company #${c.id}`,
          code: c.company_code || "",
        });
      }
    });

    // Also include companies represented in officer records
    officers.forEach((o) => {
      const cid = o.client_id;
      if (cid && !map.has(String(cid))) {
        map.set(String(cid), {
          id: String(cid),
          name: o.client_name || `Company #${cid}`,
          code: o.company_code || "",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, officers]);

  // Filtered Users Available for User Filter Dropdown
  const availableUsersForFilter = useMemo(() => {
    let list = users;
    if (selectedCompany !== "ALL") {
      list = list.filter((u) => String(u.client_id) === String(selectedCompany));
    }
    return list.slice().sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [users, selectedCompany]);

  // Filtered Officers List
  const filteredOfficers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return officers.filter((officer) => {
      // 1. Client Company Filter
      if (selectedCompany !== "ALL") {
        const officerClientId = String(officer.client_id || "");
        if (officerClientId !== selectedCompany) {
          return false;
        }
      }

      // 2. User Filter
      if (selectedUser !== "ALL") {
        const officerUserId = String(officer.created_by || "");
        if (officerUserId !== selectedUser) {
          return false;
        }
      }

      // 3. Search Query
      if (!search) return true;

      return [
        officer.officer_name,
        officer.designation,
        officer.police_station,
        officer.client_name,
        officer.company_code,
        officer.assigned_user_name,
        officer.assigned_user_email,
      ].some((field) =>
        String(field || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [officers, selectedCompany, selectedUser, searchTerm]);

  // KPIs Calculated from Filtered Records
  const totalOfficersCount = filteredOfficers.length;

  const uniqueCompaniesCount = useMemo(() => {
    const set = new Set();
    filteredOfficers.forEach((o) => {
      if (o.client_id) {
        set.add(String(o.client_id));
      } else if (o.client_name) {
        set.add(o.client_name);
      }
    });
    return set.size;
  }, [filteredOfficers]);

  const uniqueUsersCount = useMemo(() => {
    const set = new Set();
    filteredOfficers.forEach((o) => {
      if (o.created_by) {
        set.add(String(o.created_by));
      } else if (o.assigned_user_name) {
        set.add(o.assigned_user_name);
      }
    });
    return set.size;
  }, [filteredOfficers]);

  // Create Officer Action
  const handleOpenCreateModal = () => {
    setEditingOfficer(null);
    setIsModalOpen(true);
  };

  // Edit Officer Action
  const handleOpenEditModal = (officer) => {
    setEditingOfficer(officer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingOfficer(null);
  };

  const handleSaveOfficer = async (data, targetUserId = null) => {
    try {
      setIsSubmitting(true);

      if (editingOfficer) {
        await updateIOMaster(editingOfficer.id, data);
        setIsModalOpen(false);
        setEditingOfficer(null);

        await Swal.fire({
          icon: "success",
          title: "Officer Updated",
          text: `${data.officer_name} has been updated successfully.`,
          background: "#ffffff",
          color: "#172033",
          iconColor: "#059669",
          confirmButtonColor: "#059669",
          customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
        });
      } else {
        await createIOMaster(data, targetUserId);
        setIsModalOpen(false);

        await Swal.fire({
          icon: "success",
          title: "Officer Registered",
          text: `${data.officer_name} has been successfully registered in the IO Master.`,
          background: "#ffffff",
          color: "#172033",
          iconColor: "#059669",
          confirmButtonColor: "#059669",
          customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
        });
      }

      await loadData();
    } catch (err) {
      console.error("Failed to save IO:", err);
      Swal.fire({
        icon: "error",
        title: "Action Failed",
        text: err?.response?.data?.detail || err?.message || "Unable to save IO details.",
        background: "#ffffff",
        color: "#172033",
        confirmButtonColor: "#059669",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Officer Action
  const handleDeleteOfficer = async (officer) => {
    const result = await Swal.fire({
      title: "Delete Investigating Officer?",
      text: `Are you sure you want to delete ${officer.officer_name}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#E11D48",
      cancelButtonColor: "#64748B",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      background: "#ffffff",
      color: "#172033",
      iconColor: "#E11D48",
      customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
    });

    if (!result.isConfirmed) return;

    try {
      await deleteIOMaster(officer.id);

      await Swal.fire({
        icon: "success",
        title: "Officer Deleted",
        text: `${officer.officer_name} has been removed from the directory.`,
        background: "#ffffff",
        color: "#172033",
        iconColor: "#059669",
        confirmButtonColor: "#059669",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });

      await loadData();
    } catch (err) {
      console.error("Failed to delete IO:", err);
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err?.response?.data?.detail || err?.message || "Could not delete this officer.",
        background: "#ffffff",
        color: "#172033",
        confirmButtonColor: "#059669",
        customClass: { popup: "border border-slate-200 rounded-2xl shadow-xl" },
      });
    }
  };

  const hasActiveFilters =
    searchTerm.trim() !== "" || selectedCompany !== "ALL" || selectedUser !== "ALL";

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCompany("ALL");
    setSelectedUser("ALL");
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#172033]">
      <UserNavbar />

      <main className="relative isolate min-h-[calc(100vh-80px)] overflow-hidden">
        {/* Subtle decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="absolute -left-32 top-80 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          {/* Page Header */}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-800">
                  COMPANY ADMINISTRATION • GLOBAL INVESTIGATING OFFICERS
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                Investigating Officer Master
              </h1>

              <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Cross-tenant directory of all investigating officers, law enforcement ranks, and assigned cases across client organizations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isLoading || isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
              >
                <Icon
                  name="refresh"
                  size={15}
                  className={`text-slate-500 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>{isRefreshing ? "Reloading..." : "Refresh"}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#059669] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#047857] focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-95"
              >
                <Icon name="plus" size={16} />
                <span>Register Investigating Officer</span>
              </button>
            </div>
          </header>

          {/* KPI Cards */}
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total Investigating Officers"
              value={totalOfficersCount}
              note="Across all client organizations"
              icon="badge"
              tone="emerald"
              loading={isLoading}
              delay="delay-0"
            />
            <StatCard
              label="Total Client Companies Represented"
              value={uniqueCompaniesCount}
              note="Distinct client organizations"
              icon="building"
              tone="blue"
              loading={isLoading}
              delay="delay-75"
            />
            <StatCard
              label="Total Associated Users"
              value={uniqueUsersCount}
              note="Investigators and administrators"
              icon="users"
              tone="indigo"
              loading={isLoading}
              delay="delay-150"
            />
          </section>

          {/* Officers Directory Section */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
            {/* Filter and Search Bar */}
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Search Input */}
                <div className="relative min-w-[280px] flex-1">
                  <Icon
                    name="search"
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by officer name, rank, police station, client company, username, or email..."
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdowns */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Client Company Filter */}
                  <div className="relative">
                    <select
                      value={selectedCompany}
                      onChange={handleCompanyChange}
                      aria-label="Filter by Client Company"
                      className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                    >
                      <option value="ALL">All Clients ({companyOptions.length})</option>
                      {companyOptions.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name} {comp.code ? `(${comp.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Associated User Filter */}
                  <div className="relative">
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      aria-label="Filter by Associated User"
                      className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 sm:text-sm"
                    >
                      <option value="ALL">All Users ({availableUsersForFilter.length})</option>
                      {availableUsersForFilter.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Active Filter Pills */}
              {hasActiveFilters && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Active Filters:
                  </span>

                  {searchTerm && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Search: &quot;{searchTerm}&quot;
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-emerald-500 hover:text-emerald-800"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  )}

                  {selectedCompany !== "ALL" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      Client: {companyOptions.find((c) => c.id === selectedCompany)?.name || selectedCompany}
                      <button
                        type="button"
                        onClick={() => setSelectedCompany("ALL")}
                        className="text-blue-500 hover:text-blue-800"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  )}

                  {selectedUser !== "ALL" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      User: {availableUsersForFilter.find((u) => String(u.id) === String(selectedUser))?.username || selectedUser}
                      <button
                        type="button"
                        onClick={() => setSelectedUser("ALL")}
                        className="text-indigo-500 hover:text-indigo-800"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="ml-auto text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>

            {/* Officer Table */}
            <div className="relative overflow-x-auto">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Loading investigating officers...
                  </p>
                </div>
              ) : filteredOfficers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] text-slate-400">
                    <Icon name="badge" size={28} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#172554]">
                    No Investigating Officers Found
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                    {hasActiveFilters
                      ? "No officers match the selected client, user, or search criteria. Try clearing your filters."
                      : "No investigating officer records currently exist in the database. Click 'Register Investigating Officer' to add one."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F8FAFC]">
                      <th className="min-w-[200px] px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Investigating Officer Name
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Designation / Rank
                      </th>
                      <th className="min-w-[180px] px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Police Station / Branch
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Client Company
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Associated Username
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Associated User Email
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Added On
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredOfficers.map((officer) => {
                      const officerInitial = (officer.officer_name?.charAt(0) || "O").toUpperCase();
                      const companyName = officer.client_name || null;
                      const companyCode = officer.company_code || null;
                      const companyInitial = (companyName?.charAt(0) || "C").toUpperCase();
                      const username = officer.assigned_user_name || null;
                      const userRole = officer.assigned_user_role || null;
                      const userEmail = officer.assigned_user_email || null;
                      const userInitial = (username?.charAt(0) || "U").toUpperCase();

                      return (
                        <tr
                          key={officer.id}
                          className="group/row transition-all duration-200 hover:bg-emerald-50/50"
                        >
                          {/* Officer Name */}
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-xs font-extrabold text-emerald-700 shadow-xs">
                                {officerInitial}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#172554] group-hover/row:text-emerald-800">
                                  {officer.officer_name || "-"}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400">
                                  ID #{officer.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Designation / Rank */}
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {officer.designation || "-"}
                            </span>
                          </td>

                          {/* Police Station */}
                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                              <Icon name="station" size={14} className="shrink-0 text-slate-400" />
                              <span className="truncate max-w-[220px]" title={officer.police_station || ""}>
                                {officer.police_station || "-"}
                              </span>
                            </div>
                          </td>

                          {/* Client Company */}
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            {companyName ? (
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-xs font-extrabold text-blue-700 shadow-xs">
                                  {companyInitial}
                                </div>
                                <div className="min-w-0">
                                  <p className="max-w-[160px] truncate text-xs font-bold text-[#172554]" title={companyName}>
                                    {companyName}
                                  </p>
                                  {companyCode ? (
                                    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                      {companyCode}
                                    </span>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">Client Tenant</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Not Assigned
                              </span>
                            )}
                          </td>

                          {/* Associated Username */}
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            {username ? (
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xs font-extrabold text-indigo-700 shadow-xs">
                                  {userInitial}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="max-w-[140px] truncate text-xs font-bold text-[#172554]" title={username}>
                                      {username}
                                    </p>
                                    {userRole && (
                                      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                        {userRole}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Creator / Owner
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Associated User Email */}
                          <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                            {userEmail ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Icon name="mail" size={13} className="shrink-0 text-slate-400" />
                                <span className="max-w-[180px] truncate" title={userEmail}>
                                  {userEmail}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>

                          {/* Added On */}
                          <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500 sm:px-6">
                            {formatDate(officer.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="whitespace-nowrap px-5 py-4 text-right sm:px-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(officer)}
                                title="Edit Officer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:scale-95"
                              >
                                <Icon name="edit" size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteOfficer(officer)}
                                title="Delete Officer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 active:scale-95"
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer Summary */}
            {!isLoading && filteredOfficers.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p>
                  Displaying{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredOfficers.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {officers.length}
                  </span>{" "}
                  investigating officers
                </p>
                <p className="text-[11px] text-slate-400">
                  Real-time cross-company directory
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <UserFooter />

      {/* Modal for Registering / Editing IO */}
      <CreateIOModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSaveOfficer}
        isSubmitting={isSubmitting}
        isSuperAdmin={true}
        availableUsers={users}
        editingOfficer={editingOfficer}
      />
    </div>
  );
}

export default SuperAdminIOMasterList;
