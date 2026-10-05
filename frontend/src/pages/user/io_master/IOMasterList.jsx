import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import {
  getIOMasters,
  createIOMaster,
  deleteIOMaster,
} from "../../../services/api/ioMaster";

import CreateIOModal from "../../../components/io_master/CreateIOModal";
import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

function IOMasterList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";

  const canViewIO =
    isSuperAdmin ||
    isClientAdmin ||
    user?.permissions?.can_view_io !== false;

  const canCreateIO =
    isSuperAdmin ||
    isClientAdmin ||
    user?.permissions?.can_create_io !== false;

  const canDeleteIO =
    isSuperAdmin ||
    isClientAdmin ||
    user?.permissions?.can_delete_io !== false;

  const [ioList, setIoList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      const list = Array.isArray(response?.data) ? response.data : [];
      setIoList(list);
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

  const handleCreateIO = async (data, targetUserId = null) => {
    try {
      setIsSubmitting(true);
      const res = await createIOMaster(data, targetUserId);
      setIsModalOpen(false);

      await Swal.fire({
        icon: "success",
        title: "IO Record Added",
        text: `${data.officer_name} (${data.designation}) has been registered successfully.`,
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#34d399",
        confirmButtonColor: "#059669",
      });

      await loadIOs();
    } catch (err) {
      console.error("Create IO failed:", err);
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to save IO record.";

      await Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: message,
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#f87171",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIO = async (io) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete IO Record?",
      text: `Are you sure you want to remove ${io.officer_name}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      background: "#07110f",
      color: "#f8fafc",
      iconColor: "#f59e0b",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#334155",
    });

    if (result.isConfirmed) {
      try {
        await deleteIOMaster(io.id);
        await Swal.fire({
          icon: "success",
          title: "Deleted",
          text: "IO record has been deleted.",
          background: "#07110f",
          color: "#f8fafc",
          iconColor: "#34d399",
          confirmButtonColor: "#059669",
        });
        await loadIOs();
      } catch (err) {
        console.error("Delete IO error:", err);
        Swal.fire({
          icon: "error",
          title: "Deletion Failed",
          text: err?.response?.data?.detail || "Could not delete IO record.",
          background: "#07110f",
          color: "#f8fafc",
          iconColor: "#f87171",
          confirmButtonColor: "#dc2626",
        });
      }
    }
  };

  const filteredIOs = useMemo(() => {
    if (!searchTerm.trim()) return ioList;
    const term = searchTerm.toLowerCase();
    return ioList.filter(
      (item) =>
        item.officer_name.toLowerCase().includes(term) ||
        item.designation.toLowerCase().includes(term) ||
        item.police_station.toLowerCase().includes(term) ||
        (item.assigned_user_name && item.assigned_user_name.toLowerCase().includes(term))
    );
  }, [ioList, searchTerm]);

  return (
    <div className="relative min-h-screen bg-[#020b09] text-white">
      <BASNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-400/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <span>Investigation</span>
              <span>/</span>
              <span>Masters</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Investigating Officer (IO) Master
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Manage Investigating Officers before assigning them to investigation cases.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/cases")}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5 transition"
            >
              Go to Cases
            </button>
            {canCreateIO && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-bold text-black transition shadow-lg shadow-emerald-500/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add New IO
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {!canViewIO ? (
          <div className="mt-12 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white">Access Denied</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              You do not have permission to view Investigating Officers. Please contact your administrator.
            </p>
          </div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isClientAdmin ? "Search by Officer, User, Rank or Station..." : "Search by Officer Name, Rank or Station..."}
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/40 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <svg
                  className="absolute left-3 top-3 text-slate-500"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <div className="text-xs text-slate-400">
                Total Officers: <span className="font-semibold text-emerald-400">{filteredIOs.length}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-12 flex flex-col items-center justify-center gap-3">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                <p className="text-xs text-slate-400">Loading Investigating Officers...</p>
              </div>
            ) : error ? (
              <div className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
                {error}
              </div>
            ) : filteredIOs.length === 0 ? (
              <div className="mt-12 rounded-3xl border border-emerald-400/10 bg-[#071310] p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">No Investigating Officers Found</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Add your investigating officers here before creating cases so you can link them directly.
                </p>
                {canCreateIO && (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-bold text-black transition"
                  >
                    Add First IO
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-400/15 bg-[#06120f]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-emerald-400/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="py-4 px-6">#</th>
                        {isClientAdmin && (
                          <th className="py-4 px-6">Assigned User</th>
                        )}
                        <th className="py-4 px-6">Officer Name</th>
                        <th className="py-4 px-6">Designation / Rank</th>
                        <th className="py-4 px-6">Police Station / Branch</th>
                        <th className="py-4 px-6">Added On</th>
                        {canDeleteIO && <th className="py-4 px-6 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs">
                      {filteredIOs.map((io, idx) => (
                        <tr key={io.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-4 px-6 font-mono text-slate-500">{idx + 1}</td>
                          {isClientAdmin && (
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                {io.assigned_user_name || "-"}
                              </span>
                            </td>
                          )}
                          <td className="py-4 px-6 font-semibold text-white">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 font-bold text-emerald-400">
                                {io.officer_name.charAt(0).toUpperCase()}
                              </div>
                              <span>{io.officer_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                              {io.designation}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-300">{io.police_station}</td>
                          <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                            {io.created_at ? new Date(io.created_at).toLocaleDateString() : "-"}
                          </td>
                          {canDeleteIO && (
                            <td className="py-4 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteIO(io)}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <CreateIOModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateIO}
        isSubmitting={isSubmitting}
        isClientAdmin={isClientAdmin}
      />

      <BASFooter />
    </div>
  );
}

export default IOMasterList;
