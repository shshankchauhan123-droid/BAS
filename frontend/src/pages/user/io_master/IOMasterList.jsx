import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import {
  getIOMasters,
  createIOMaster,
  updateIOMaster,
  deleteIOMaster,
} from "../../../services/api/ioMaster";
import CreateIOModal from "../../../components/io_master/CreateIOModal";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

const Icon = ({ name, size = 20, className = "" }) => {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    station: <><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-5h6v5" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6M14 10v6" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  };

  return <svg {...shared}>{paths[name] || paths.shield}</svg>;
};

function IOMasterList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";

  const canViewIO =
    isSuperAdmin || isClientAdmin ||
    user?.permissions?.can_view_io !== false;

  const canCreateIO =
    isSuperAdmin || isClientAdmin ||
    user?.permissions?.can_create_io !== false;

  const canUpdateIO =
    isSuperAdmin || isClientAdmin ||
    user?.permissions?.can_update_io !== false;

  const canDeleteIO =
    isSuperAdmin || isClientAdmin ||
    user?.permissions?.can_delete_io !== false;

  const [ioList, setIoList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");

  const loadIOs = useCallback(async () => {
    if (!canViewIO) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const response = await getIOMasters();
      setIoList(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load IO records:", err);
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to load IO records."
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewIO]);

  useEffect(() => {
    loadIOs();
  }, [loadIOs]);

  const handleOpenCreateModal = () => {
    setEditingOfficer(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (officer) => {
    setEditingOfficer(officer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingOfficer(null);
  };

  const handleSaveIO = async (data, targetUserId = null) => {
    try {
      setIsSubmitting(true);

      if (editingOfficer) {
        await updateIOMaster(editingOfficer.id, data);
        setIsModalOpen(false);
        setEditingOfficer(null);

        await Swal.fire({
          icon: "success",
          title: "Officer Updated",
          text: `${data.officer_name} details have been updated successfully.`,
          background: "#ffffff",
          color: "#172033",
          iconColor: "#059669",
          confirmButtonColor: "#059669",
          customClass: {
            popup: "border border-slate-200 rounded-2xl shadow-xl",
          },
        });
      } else {
        await createIOMaster(data, targetUserId);
        setIsModalOpen(false);

        await Swal.fire({
          icon: "success",
          title: "IO Record Added",
          text: `${data.officer_name} (${data.designation}) has been registered successfully.`,
          background: "#ffffff",
          color: "#172033",
          iconColor: "#059669",
          confirmButtonColor: "#059669",
          customClass: {
            popup: "border border-slate-200 rounded-2xl shadow-xl",
          },
        });
      }

      await loadIOs();
    } catch (err) {
      console.error(editingOfficer ? "Update IO failed:" : "Create IO failed:", err);
      await Swal.fire({
        icon: "error",
        title: editingOfficer ? "Update Failed" : "Save Failed",
        text:
          err?.response?.data?.detail ||
          err?.message ||
          (editingOfficer ? "Failed to update IO record." : "Failed to save IO record."),
        background: "#ffffff",
        color: "#172033",
        iconColor: "#dc2626",
        confirmButtonColor: "#dc2626",
        customClass: {
          popup: "border border-slate-200 rounded-2xl shadow-xl",
        },
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIO = async (io) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete IO Record?",
      text: `Are you sure you want to remove ${io.officer_name || "this officer"}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      background: "#ffffff",
      color: "#172033",
      iconColor: "#d97706",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "border border-slate-200 rounded-2xl shadow-xl",
      },
    });

    if (!result.isConfirmed) return;

    try {
      await deleteIOMaster(io.id);
      await Swal.fire({
        icon: "success",
        title: "Record Deleted",
        text: "The investigating officer record has been deleted.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#059669",
        confirmButtonColor: "#059669",
        customClass: {
          popup: "border border-slate-200 rounded-2xl shadow-xl",
        },
      });
      await loadIOs();
    } catch (err) {
      console.error("Delete IO error:", err);
      await Swal.fire({
        icon: "error",
        title: "Deletion Failed",
        text:
          err?.response?.data?.detail ||
          "Could not delete IO record.",
        background: "#ffffff",
        color: "#172033",
        iconColor: "#dc2626",
        confirmButtonColor: "#dc2626",
        customClass: {
          popup: "border border-slate-200 rounded-2xl shadow-xl",
        },
      });
    }
  };

  const filteredIOs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return ioList;

    return ioList.filter((item) =>
      [
        item?.officer_name,
        item?.designation,
        item?.police_station,
        item?.assigned_user_name,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [ioList, searchTerm]);

  const totalStations = useMemo(
    () =>
      new Set(
        ioList
          .map((item) => String(item?.police_station || "").trim())
          .filter(Boolean)
      ).size,
    [ioList]
  );

  return (
    <div className="arthbodh-io-master min-h-screen bg-[#F5F8FC] text-[#172033] selection:bg-emerald-100 selection:text-emerald-900">
      <style>{`
        @keyframes arthbodhIOFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes arthbodhIOFloat {
          0%,100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(10px,-12px,0); }
        }
        .arthbodh-io-enter {
          animation: arthbodhIOFade 500ms cubic-bezier(.16,1,.3,1) both;
        }
        .arthbodh-io-stagger-1 { animation-delay: 50ms; }
        .arthbodh-io-stagger-2 { animation-delay: 100ms; }
        .arthbodh-io-card {
          transition: transform 220ms cubic-bezier(.16,1,.3,1),
            box-shadow 220ms cubic-bezier(.16,1,.3,1),
            border-color 220ms ease;
        }
        .arthbodh-io-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 24px -6px rgba(23,37,84,.08),
            0 4px 8px -4px rgba(23,37,84,.04);
        }
        .arthbodh-io-row { transition: background-color 180ms ease; }
        .arthbodh-io-row:hover { background: #F0FDF4; }
        .arthbodh-io-orb { animation: arthbodhIOFloat 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .arthbodh-io-enter, .arthbodh-io-orb { animation: none !important; }
          .arthbodh-io-card, .arthbodh-io-card:hover, .arthbodh-io-row {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <UserNavbar />

      <main className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="arthbodh-io-orb absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="arthbodh-io-orb absolute right-0 top-20 h-[450px] w-[450px] rounded-full bg-blue-200/20 blur-3xl [animation-delay:-3s]" />
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(226,232,240,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(226,232,240,.8) 1px,transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-9">
          <section className="arthbodh-io-enter mb-8 flex flex-col justify-between gap-5 sm:gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#059669]">
                  Banking Analytical System
                </span>
                <span className="h-3 w-px bg-slate-300" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Investigation / Masters
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[#172554] sm:text-3xl lg:text-4xl">
                Investigating Officer{" "}
                <span className="text-[#059669]">Master</span>
              </h1>

              <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-[#64748B]">
                Manage investigating officers, maintain station details, and keep
                officer records ready for case assignment.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard/cases")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs font-bold text-[#172554] shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-[#ECFDF5] hover:text-[#059669]"
              >
                <Icon name="arrow" size={16} className="rotate-180" />
                Go to Cases
              </button>

              {canCreateIO && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#059669] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm shadow-emerald-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#047857] hover:shadow-md hover:shadow-emerald-900/20 active:translate-y-0"
                >
                  <Icon
                    name="plus"
                    size={18}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                  Add New IO
                </button>
              )}
            </div>
          </section>

          {!canViewIO ? (
            <section className="arthbodh-io-enter rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
                <Icon name="lock" size={27} />
              </div>
              <h2 className="mt-4 text-lg font-bold text-[#172554]">
                Access Denied
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                You do not have permission to view investigating officers. Please
                contact your administrator if you need access.
              </p>
            </section>
          ) : (
            <>
              {/* Responsive 2-KPI Card Section */}
              <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <SummaryCard
                  icon="users"
                  label="Total Officers"
                  value={ioList.length}
                  note="Registered officer records"
                  theme="emerald"
                  delay="arthbodh-io-stagger-1"
                />
                <SummaryCard
                  icon="station"
                  label="Stations / Branches"
                  value={totalStations}
                  note="Represented in directory"
                  theme="blue"
                  delay="arthbodh-io-stagger-2"
                />
              </section>

              <section
                className="arthbodh-io-enter overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
                style={{ animationDelay: "120ms" }}
              >
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] p-5 sm:p-6 lg:flex-row lg:items-center">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#059669]">
                      Officer Management
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-[#172554] sm:text-xl">
                      Officer Directory
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[#64748B] sm:text-sm">
                      Search, review, and manage the officers available for
                      investigations.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block w-full sm:w-[340px]">
                      <span className="sr-only">
                        Search investigating officers
                      </span>
                      <Icon
                        name="search"
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={
                          isClientAdmin
                            ? "Search officer, user, rank or station..."
                            : "Search officer name, rank or station..."
                        }
                        className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-3 pl-10 pr-10 text-xs text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 sm:text-sm"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1 text-lg leading-none text-slate-400 hover:text-slate-700"
                        >
                          ×
                        </button>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={loadIOs}
                      disabled={isLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs font-bold text-[#172554] transition hover:border-emerald-300 hover:bg-[#ECFDF5] hover:text-[#059669] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon
                        name="refresh"
                        size={15}
                        className={isLoading ? "animate-spin" : ""}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] px-5 py-3.5 sm:px-6">
                  <p className="text-xs text-[#64748B]">
                    Showing{" "}
                    <span className="font-bold text-[#172554]">
                      {filteredIOs.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-[#172554]">
                      {ioList.length}
                    </span>{" "}
                    officers
                  </p>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[#ECFDF5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#059669]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                    Directory
                  </span>
                </div>

                {isLoading ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-16">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
                    <p className="text-xs font-medium text-[#64748B]">
                      Loading investigating officers...
                    </p>
                  </div>
                ) : error ? (
                  <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center sm:m-6">
                    <p className="text-sm font-semibold text-rose-800">
                      Unable to load officer records
                    </p>
                    <p className="mt-2 text-xs leading-5 text-rose-700">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={loadIOs}
                      className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredIOs.length === 0 ? (
                  <div className="px-6 py-14 text-center sm:py-16">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-[#ECFDF5] text-[#059669]">
                      <Icon name={searchTerm ? "search" : "users"} size={26} />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#172554]">
                      {searchTerm
                        ? "No Matching Officers"
                        : "No Investigating Officers Found"}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#64748B]">
                      {searchTerm
                        ? "Try another name, rank, assigned user, or station."
                        : "Add investigating officers here before assigning them to investigation cases."}
                    </p>

                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="mt-5 rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-bold text-[#172554] hover:bg-slate-50"
                      >
                        Clear Search
                      </button>
                    ) : canCreateIO ? (
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#047857]"
                      >
                        <Icon name="plus" size={15} />
                        Add First IO
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-white text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B] sm:text-[11px]">
                          <th className="px-5 py-4 sm:px-6">#</th>
                          {isClientAdmin && (
                            <th className="px-5 py-4">Assigned User</th>
                          )}
                          <th className="px-5 py-4">Officer</th>
                          <th className="px-5 py-4">Designation / Rank</th>
                          <th className="px-5 py-4">Police Station / Branch</th>
                          <th className="px-5 py-4">Added On</th>
                          {(canUpdateIO || canDeleteIO) && (
                            <th className="px-5 py-4 text-right sm:pr-6">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#E2E8F0]">
                        {filteredIOs.map((io, idx) => {
                          const officerName = String(
                            io?.officer_name || "Unnamed Officer"
                          );
                          const initials = officerName
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part.charAt(0))
                            .join("")
                            .toUpperCase();

                          return (
                            <tr
                              key={io.id ?? `${officerName}-${idx}`}
                              className="arthbodh-io-row"
                            >
                              <td className="px-5 py-4 font-mono text-xs text-slate-400 sm:px-6">
                                {String(idx + 1).padStart(2, "0")}
                              </td>

                              {isClientAdmin && (
                                <td className="px-5 py-4">
                                  <span className="inline-flex max-w-44 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                    <span className="truncate">
                                      {io.assigned_user_name || "—"}
                                    </span>
                                  </span>
                                </td>
                              )}

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-gradient-to-br from-[#ECFDF5] to-blue-50 text-xs font-extrabold text-[#059669]">
                                    {initials || "IO"}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="max-w-52 truncate text-sm font-bold text-[#172554]">
                                      {officerName}
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#64748B]">
                                      Investigating Officer
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-lg border border-emerald-200 bg-[#ECFDF5] px-2.5 py-1.5 text-xs font-semibold text-[#047857]">
                                  {io.designation || "—"}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2 text-sm text-[#64748B]">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                    <Icon name="station" size={15} />
                                  </span>
                                  <span className="max-w-48 truncate">
                                    {io.police_station || "—"}
                                  </span>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2 whitespace-nowrap text-xs text-[#64748B]">
                                  <Icon
                                    name="calendar"
                                    size={14}
                                    className="text-slate-400"
                                  />
                                  {io.created_at
                                    ? new Date(io.created_at).toLocaleDateString(
                                        "en-IN",
                                        {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        }
                                      )
                                    : "—"}
                                </div>
                              </td>

                              {(canUpdateIO || canDeleteIO) && (
                                <td className="px-5 py-4 text-right sm:pr-6 whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    {canUpdateIO && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(io)}
                                        aria-label={`Edit ${officerName}`}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#172554] shadow-sm transition hover:border-emerald-300 hover:bg-[#ECFDF5] hover:text-[#059669]"
                                      >
                                        <Icon name="edit" size={13} />
                                        Edit
                                      </button>
                                    )}

                                    {canDeleteIO && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteIO(io)}
                                        aria-label={`Delete ${officerName}`}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:border-rose-300"
                                      >
                                        <Icon name="trash" size={13} />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isLoading && !error && filteredIOs.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <span>
                      Officer records are shown according to your access
                      permissions.
                    </span>
                    <span className="font-semibold">
                      {filteredIOs.length}{" "}
                      {filteredIOs.length === 1 ? "record" : "records"}
                    </span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <CreateIOModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSaveIO}
        isSubmitting={isSubmitting}
        isClientAdmin={isClientAdmin}
        editingOfficer={editingOfficer}
      />

      <UserFooter />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  note,
  theme = "emerald",
  delay = "",
}) {
  const styles = {
    emerald: {
      icon: "border-emerald-200 bg-[#ECFDF5] text-[#059669]",
      accent: "bg-[#059669]",
    },
    blue: {
      icon: "border-blue-200 bg-blue-50 text-[#2563EB]",
      accent: "bg-[#2563EB]",
    },
    teal: {
      icon: "border-teal-200 bg-teal-50 text-teal-700",
      accent: "bg-teal-600",
    },
  };

  const selected = styles[theme] || styles.emerald;

  return (
    <div
      className={`arthbodh-io-enter arthbodh-io-card relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm ${delay}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${selected.accent}`} />

      <div className="flex items-center justify-between gap-4 pt-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#172554]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">{note}</p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${selected.icon}`}
        >
          <Icon name={icon} size={22} />
        </div>
      </div>
    </div>
  );
}

export default IOMasterList;
