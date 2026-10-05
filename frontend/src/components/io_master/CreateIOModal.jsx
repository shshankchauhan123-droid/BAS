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
}) {
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
    if (isOpen) {
      setFormData({
        officer_name: "",
        designation: "Sub-Inspector (SI)",
        custom_designation: "",
        police_station: "",
      });
      setError("");
      if (isClientAdmin) {
        loadCompanyUsers();
      } else {
        setCompanyUsers([]);
        setSelectedUserId("");
      }
    }
  }, [isOpen, isClientAdmin]);

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

    if (isClientAdmin && !selectedUserId) {
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
        isClientAdmin ? Number(selectedUserId) : null
      );
    } catch (err) {
      console.error("Create IO error:", err);
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "You do not have permission to create Investigating Officers.";
      setError(message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div
        className="relative z-10 w-full max-w-lg rounded-3xl border border-emerald-400/25 bg-[#071310] p-7 text-white shadow-2xl shadow-emerald-950/40"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-emerald-400/10 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
              <svg
                width="24"
                height="24"
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
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Add Investigating Officer (IO)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Register an IO master record to link with cases
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white transition disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Assigned Investigator for Client Admin */}
          {isClientAdmin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Assign to Investigator <span className="text-emerald-400">*</span>
              </label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  Loading investigators...
                </div>
              ) : companyUsers.length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
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
                  className="w-full rounded-xl border border-emerald-400/20 bg-[#040e0b] px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  {companyUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#040e0b] text-white">
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Officer Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Officer Name <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              name="officer_name"
              value={formData.officer_name}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. Rajesh Kumar Sharma"
              className="w-full rounded-xl border border-emerald-400/20 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Designation / Rank <span className="text-emerald-400">*</span>
            </label>
            <select
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-emerald-400/20 bg-[#040e0b] px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {DESIGNATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-[#040e0b] text-white">
                  {opt}
                </option>
              ))}
            </select>

            {/* When Other is selected: writing line directly below it */}
            {formData.designation === "Other" && (
              <div className="mt-3">
                <input
                  type="text"
                  name="custom_designation"
                  value={formData.custom_designation}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="Specify other designation / rank..."
                  className="w-full border-0 border-b-2 border-emerald-400/60 bg-transparent px-1 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Police Station / Branch */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Police Station / Branch <span className="text-emerald-400">*</span>
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Officer's current posting police station, thana, or unit branch
            </p>
            <input
              type="text"
              name="police_station"
              value={formData.police_station}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. Navrangpura Police Station / Cyber Crime Branch"
              className="w-full rounded-xl border border-emerald-400/20 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-400/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-2.5 text-xs font-bold text-black transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Saving...
                </>
              ) : (
                "Save IO Record"
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
