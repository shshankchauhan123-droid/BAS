import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getUsers } from "../../services/api/user";

const DESIGNATION_OPTIONS = [
  "Sub-Inspector (SI)",
  "Inspector (PI)",
  "Assistant Sub-Inspector (ASI)",
  "Deputy Superintendent of Police (DySP / ACP)",
  "Superintendent of Police (SP / DCP)",
  "Investigating Officer / Investigator",
  "Other",
];

function CreateIOModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  isClientAdmin = false,
  isSuperAdmin = false,
  availableUsers = null,
  editingOfficer = null,
}) {
  const isEditMode = Boolean(editingOfficer);

  const [formData, setFormData] = useState({
    officer_name: "",
    designation: "Sub-Inspector (SI)",
    custom_designation: "",
    police_station: "",
  });

  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  const loadCompanyUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await getUsers();
      const list = res?.users || res?.items || (Array.isArray(res) ? res : []);
      const activeInvestigators = list.filter(
        (u) => u.role === "user" && u.is_active === true
      );
      setCompanyUsers(activeInvestigators);
      if (activeInvestigators.length > 0) {
        setSelectedUserId(String(activeInvestigators[0].id));
      } else {
        setSelectedUserId("");
      }
    } catch (err) {
      console.error("Failed to load company investigators for IO creation:", err);
      setCompanyUsers([]);
      setSelectedUserId("");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setError("");

    if (editingOfficer) {
      const rawDesig = editingOfficer.designation || "";
      const isStandard = DESIGNATION_OPTIONS.includes(rawDesig) && rawDesig !== "Other";

      setFormData({
        officer_name: editingOfficer.officer_name || "",
        designation: isStandard ? rawDesig : "Other",
        custom_designation: isStandard ? "" : rawDesig,
        police_station: editingOfficer.police_station || "",
      });
      setSelectedUserId(editingOfficer.created_by ? String(editingOfficer.created_by) : "");
    } else {
      setFormData({
        officer_name: "",
        designation: "Sub-Inspector (SI)",
        custom_designation: "",
        police_station: "",
      });
      if (Array.isArray(availableUsers) && availableUsers.length > 0) {
        setCompanyUsers(availableUsers);
        setSelectedUserId(String(availableUsers[0].id));
      } else if (isClientAdmin || isSuperAdmin) {
        loadCompanyUsers();
      } else {
        setCompanyUsers([]);
        setSelectedUserId("");
      }
    }
  }, [isOpen, editingOfficer, isClientAdmin, isSuperAdmin, availableUsers]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const officerName = formData.officer_name.trim();
    let designation = formData.designation.trim();
    const policeStation = formData.police_station.trim();

    if (!officerName) {
      setError("Officer name is required.");
      return;
    }
    if (officerName.length < 2) {
      setError("Officer name must be at least 2 characters.");
      return;
    }
    if (officerName.length > 150) {
      setError("Officer name must not exceed 150 characters.");
      return;
    }
    if (!designation) {
      setError("Designation / Rank is required.");
      return;
    }
    if (designation === "Other") {
      const customDesignation = formData.custom_designation?.trim();
      if (!customDesignation) {
        setError("Please specify the designation / rank.");
        return;
      }
      if (customDesignation.length < 2) {
        setError("Designation / Rank must be at least 2 characters.");
        return;
      }
      if (customDesignation.length > 100) {
        setError("Designation / Rank must not exceed 100 characters.");
        return;
      }
      designation = customDesignation;
    }
    if (!policeStation) {
      setError("Police Station / Branch is required.");
      return;
    }
    if (policeStation.length > 200) {
      setError("Police Station / Branch must not exceed 200 characters.");
      return;
    }

    if (!isEditMode && isClientAdmin && !selectedUserId) {
      setError("Please select an investigator for this IO record.");
      return;
    }

    try {
      await onSubmit(
        {
          officer_name: officerName,
          designation,
          police_station: policeStation,
        },
        !isEditMode && isClientAdmin ? Number(selectedUserId) : null
      );
    } catch (err) {
      console.error(isEditMode ? "Update IO error:" : "Create IO error:", err);
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        (isEditMode
          ? "Failed to update Investigating Officer record."
          : "You do not have permission to create Investigating Officers.");
      setError(message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-sm transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-7 text-[#172033] shadow-2xl shadow-slate-900/15"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-[#ECFDF5] text-[#059669]">
              {isEditMode ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#172554]">
                {isEditMode ? "Edit Investigating Officer" : "Add Investigating Officer (IO)"}
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isEditMode
                  ? "Update officer details, rank, and station assignment"
                  : "Register an IO master record to link with cases"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[#E2E8F0] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Assigned Investigator for Client Admin / Super Admin */}
          {(isClientAdmin || isSuperAdmin) && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Assigned Investigator {!isEditMode && <span className="text-[#059669]">*</span>}
              </label>
              {isEditMode ? (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs font-semibold text-blue-900">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>Assigned to: {editingOfficer.assigned_user_name || "Primary User"}</span>
                </div>
              ) : loadingUsers ? (
                <div className="flex items-center gap-2 text-xs text-[#64748B] py-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
                  Loading investigators...
                </div>
              ) : companyUsers.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  No active investigators found in your company. Please create or activate an investigator first.
                </div>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-medium text-[#172033] outline-none transition focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                >
                  {companyUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Officer Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Officer Name <span className="text-[#059669]">*</span>
            </label>
            <input
              type="text"
              name="officer_name"
              value={formData.officer_name}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. Rajesh Kumar Sharma"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#172033] placeholder-slate-400 outline-none transition focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Designation / Rank <span className="text-[#059669]">*</span>
            </label>
            <select
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#172033] outline-none transition focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            >
              {DESIGNATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {/* When Other is selected: text input below it */}
            {formData.designation === "Other" && (
              <div className="mt-2.5">
                <input
                  type="text"
                  name="custom_designation"
                  value={formData.custom_designation}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="Specify other designation / rank..."
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3.5 py-2 text-xs sm:text-sm font-medium text-[#172033] placeholder-slate-400 outline-none transition focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Police Station / Branch */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1">
              Police Station / Branch <span className="text-[#059669]">*</span>
            </label>
            <p className="text-[11px] text-[#64748B] mb-1.5">
              Officer's current posting police station, thana, or unit branch
            </p>
            <input
              type="text"
              name="police_station"
              value={formData.police_station}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. Navrangpura Police Station / Cyber Crime Branch"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#172033] placeholder-slate-400 outline-none transition focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-xs font-bold text-[#172554] hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isEditMode ? "Updating..." : "Saving..."}
                </>
              ) : (
                isEditMode ? "Update IO Record" : "Save IO Record"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default CreateIOModal;
