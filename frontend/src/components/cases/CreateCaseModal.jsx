
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getIOMasters, createIOMaster } from "../../services/api/ioMaster";
import { getUsers } from "../../services/api/user";
import { getClients } from "../../services/api/clients";
import { useAuth } from "../../context/AuthContext";
import CreateIOModal from "../io_master/CreateIOModal";

function CreateCaseModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  isClientAdmin: propIsClientAdmin,
  isSuperAdmin: propIsSuperAdmin,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = propIsSuperAdmin ?? (userRole === "superadmin" || userRole === "admin");
  const isClientAdmin = propIsClientAdmin ?? userRole === "client_admin";
  const canViewIO =
    isSuperAdmin || isClientAdmin || user?.permissions?.can_view_io !== false;

  const [formData, setFormData] = useState({
    case_name: "",
    description: "",
    io_id: "",
    assigned_to: "",
    client_id: "",
  });
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [ioList, setIoList] = useState([]);
  const [loadingIOs, setLoadingIOs] = useState(false);
  const [isIOModalOpen, setIsIOModalOpen] = useState(false);
  const [isCreatingIO, setIsCreatingIO] = useState(false);
  const [error, setError] = useState("");

  const selectedClient = clients.find(
    (item) => String(item.id) === String(formData.client_id)
  );
  const selectedIO = ioList.find(
    (io) => String(io.id) === String(formData.io_id)
  );
  const selectedUser = companyUsers.find(
    (item) => String(item.id) === String(formData.assigned_to)
  );
  const hasZeroIOs =
    !loadingIOs &&
    ioList.length === 0 &&
    ((!isClientAdmin && !isSuperAdmin) || !!formData.assigned_to);
  const totalSteps = isSuperAdmin ? 4 : isClientAdmin ? 3 : 2;
  const currentStep = isSuperAdmin
    ? (!formData.client_id
        ? 1
        : !formData.assigned_to
          ? 2
          : !formData.io_id
            ? 3
            : 4)
    : isClientAdmin
      ? (!formData.assigned_to
          ? 1
          : !formData.io_id
            ? 2
            : 3)
      : (!formData.io_id ? 1 : 2);

  const loadClientsList = async () => {
    try {
      setLoadingClients(true);
      const response = await getClients();
      const list = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      setClients(list.filter((c) => c.is_active !== false));
    } catch (loadError) {
      console.error("Failed to load clients:", loadError);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadIOList = async (targetUserId = null) => {
    if (!isClientAdmin && !isSuperAdmin && !canViewIO) {
      setIoList([]);
      setLoadingIOs(false);
      return;
    }

    try {
      setLoadingIOs(true);
      const response = await getIOMasters(targetUserId);
      const list = Array.isArray(response?.data) ? response.data : [];
      setIoList(list);
      setFormData((previous) => ({
        ...previous,
        io_id: list.some(
          (item) => String(item.id) === String(previous.io_id)
        )
          ? previous.io_id
          : list.length
            ? String(list[0].id)
            : "",
      }));
    } catch (loadError) {
      console.error("Failed to load IO list:", loadError);
      setIoList([]);
    } finally {
      setLoadingIOs(false);
    }
  };

  const loadCompanyUsers = async (targetClientId = null) => {
    try {
      setLoadingUsers(true);
      const response = await getUsers(targetClientId);
      const list =
        response?.users ||
        response?.items ||
        (Array.isArray(response) ? response : []);

      setCompanyUsers(
        list.filter(
          (item) => item.role === "user" && item.is_active === true
        )
      );
    } catch (loadError) {
      console.error("Failed to load company investigators:", loadError);
      setCompanyUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      case_name: "",
      description: "",
      io_id: "",
      assigned_to: "",
      client_id: "",
    });
    setError("");
    setIoList([]);
    setCompanyUsers([]);

    if (isSuperAdmin) {
      loadClientsList();
    } else if (isClientAdmin) {
      loadCompanyUsers(null);
    } else if (canViewIO) {
      loadIOList(null);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClientAdmin, isSuperAdmin, canViewIO]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event) => {
      if (event.key === "Escape" && !isSubmitting) handleClose();
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmitting]);

  const handleClientChange = async (event) => {
    const selectedClientId = event.target.value;

    setFormData((previous) => ({
      ...previous,
      client_id: selectedClientId,
      assigned_to: "",
      io_id: "",
    }));
    setError("");
    setIoList([]);

    if (selectedClientId) {
      loadCompanyUsers(selectedClientId);
    } else {
      setCompanyUsers([]);
    }
  };

  const handleUserChange = (event) => {
    const assignedTo = event.target.value;

    setFormData((previous) => ({
      ...previous,
      assigned_to: assignedTo,
      io_id: "",
    }));
    setError("");

    if (assignedTo) loadIOList(assignedTo);
    else setIoList([]);
  };

  const handleCreateIOQuick = async (data) => {
    try {
      setIsCreatingIO(true);

      const targetUserId =
        (isClientAdmin || isSuperAdmin) && formData.assigned_to
          ? formData.assigned_to
          : null;

      const response = await createIOMaster(data, targetUserId);
      const createdIO = response?.data;

      setIsIOModalOpen(false);
      await loadIOList(targetUserId);

      if (createdIO?.id) {
        setFormData((previous) => ({
          ...previous,
          io_id: String(createdIO.id),
        }));
      }
    } catch (createError) {
      console.error("Failed to create IO:", createError);
      throw createError;
    } finally {
      setIsCreatingIO(false);
    }
  };

  
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const caseName = String(formData.case_name || "").trim();
    const description = String(formData.description || "").trim();

    if (isSuperAdmin && !formData.client_id) {
      setError("Please select a Client Company for this case.");
      return;
    }

    if ((isClientAdmin || (isSuperAdmin && companyUsers.length > 0)) && !formData.assigned_to) {
      setError("Please select an active investigator to assign this case to.");
      return;
    }

    if (hasZeroIOs) {
      setError(
        isClientAdmin || isSuperAdmin
          ? `Register an Investigating Officer for ${
              selectedUser?.username || "the assigned investigator"
            } before creating this case.`
          : "Register an Investigating Officer before creating your first case."
      );
      setIsIOModalOpen(true);
      return;
    }

    if (!formData.io_id) {
      setError("Please select an Investigating Officer (IO).");
      return;
    }
    if (!caseName) {
      setError("Case name is required.");
      return;
    }
    if (caseName.length < 2) {
      setError("Case name must contain at least 2 characters.");
      return;
    }
    if (caseName.length > 255) {
      setError("Case name cannot exceed 255 characters.");
      return;
    }
    if (description.length > 5000) {
      setError("Description cannot exceed 5000 characters.");
      return;
    }

    try {
      await onSubmit({
        case_name: caseName,
        description: description || null,
        io_id: formData.io_id ? Number(formData.io_id) : null,
        assigned_to:
          (isClientAdmin || isSuperAdmin) && formData.assigned_to
            ? Number(formData.assigned_to)
            : null,
        client_id:
          isSuperAdmin && formData.client_id
            ? Number(formData.client_id)
            : null,
      });
    } catch (submitError) {
      console.error("Create case modal submit error:", submitError);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white/90 px-4 py-3.5 text-sm font-medium text-[#172033] shadow-[0_3px_12px_rgba(15,23,42,0.025)] outline-none transition duration-200 placeholder:font-normal placeholder:text-slate-400 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

  const labelClass =
    "mb-2.5 block text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-600";

  return (
    <div
      className="case-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0B1530]/65 p-3 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <style>{`
        @keyframes caseModalIn {
          from {
            opacity: 0;
            transform: translateY(24px) scale(.975);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes caseFloat {
          0%, 100% {
            transform: translate3d(0,0,0) rotate(0deg);
          }
          50% {
            transform: translate3d(12px,-10px,0) rotate(5deg);
          }
        }

        @keyframes caseSweep {
          0% {
            transform: translateX(-120%) skewX(-18deg);
          }
          100% {
            transform: translateX(260%) skewX(-18deg);
          }
        }

        @keyframes caseOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes casePulse {
          0%, 100% {
            opacity: .5;
            box-shadow: 0 0 0 0 rgba(52,211,153,.22);
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 0 7px rgba(52,211,153,0);
          }
        }

        .case-modal-enter {
          animation: caseModalIn .42s cubic-bezier(.2,.8,.2,1) both;
        }
        .case-float {
          animation: caseFloat 9s ease-in-out infinite;
        }
        .case-orbit {
          animation: caseOrbit 24s linear infinite;
        }
        .case-sweep {
          animation: caseSweep 6s ease-in-out infinite;
        }
        .case-pulse {
          animation: casePulse 2.4s ease-in-out infinite;
        }
        .case-field {
          animation: caseModalIn .5s both;
        }

        @media (prefers-reduced-motion: reduce) {
          .case-modal-enter,
          .case-float,
          .case-orbit,
          .case-sweep,
          .case-pulse,
          .case-field {
            animation: none !important;
          }
        }
      `}</style>

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-case-title"
        className="case-modal-enter relative my-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/60 bg-[#F4F7FC] shadow-[0_40px_120px_rgba(2,8,23,.38)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Animated navy hero */}
        <header className="relative isolate min-h-[210px] overflow-hidden bg-[#101D3D] px-6 py-7 text-white sm:px-9 sm:py-8">
          <div
            className="absolute inset-0 -z-10 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.17) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.17) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="case-float absolute -right-8 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div
            className="case-float absolute right-36 top-16 -z-10 h-36 w-36 rounded-full bg-blue-400/20 blur-3xl"
            style={{ animationDelay: "-4s" }}
          />

          <div
            className="absolute -right-8 top-0 h-full w-1/2 overflow-hidden opacity-40"
            aria-hidden="true"
          >
            <div className="case-orbit absolute right-8 top-[-90px] h-72 w-72 rounded-full border border-emerald-200/30" />
            <div
              className="case-orbit absolute right-20 top-[-42px] h-52 w-52 rounded-full border border-dashed border-blue-200/30"
              style={{
                animationDirection: "reverse",
                animationDuration: "34s",
              }}
            />
            <div className="absolute right-[155px] top-[75px] h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_22px_rgba(110,231,183,.95)]" />
            <div className="absolute right-[90px] top-[150px] h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,.9)]" />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent" />
          <div
            className="case-sweep absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
            aria-hidden="true"
          />

          <div className="relative flex items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.2em] text-emerald-200">
                  <span className="case-pulse h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  ARTHBODH · BAS
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">
                  Investigation workspace / 01
                </span>
              </div>

              <h2
                id="create-case-title"
                className="mt-5 text-3xl font-black tracking-[-.04em] text-white sm:text-4xl"
              >
                Create a new{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
                  case.
                </span>
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Build the investigation record, assign ownership, and connect
                the right officer — all in one workspace.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Secure case setup
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                  Guided assignment
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Close create case dialog"
              className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[.07] text-slate-300 backdrop-blur transition duration-200 hover:rotate-90 hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-300/20 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Animated progress rail */}
        <div className="relative border-b border-slate-200/80 bg-white/85 px-6 py-4 sm:px-9">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-slate-400">
                Creation sequence
              </p>
              <p className="mt-1 text-xs font-bold text-[#172554]">
                Step {currentStep}{" "}
                <span className="font-medium text-slate-400">
                  of {totalSteps}
                </span>
              </p>
            </div>

            <div
              className="flex items-center gap-1.5"
              aria-label={`Step ${currentStep} of ${totalSteps}`}
            >
              {Array.from(
                { length: totalSteps },
                (_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      index + 1 <= currentStep
                        ? "w-9 bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "w-5 bg-slate-200"
                    }`}
                  />
                )
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8"
        >
          <div className="min-w-0 space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50/70 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-extrabold text-[#172554]">A clear record starts here</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Complete the required details below. Your case name and officer assignment help keep investigations organized.
                </p>
              </div>
            </div>

            {isSuperAdmin && (
              <section
                className="case-field rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.035)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,.06)] sm:p-5"
                style={{ animationDelay: "50ms" }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label htmlFor="client_id" className={labelClass}>
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[10px] text-blue-700 ring-1 ring-blue-100">01</span>
                    Client company <span className="text-emerald-600">*</span>
                  </label>
                  <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-400">
                    {loadingClients ? "Loading…" : `${clients.length} companies`}
                  </span>
                </div>

                <select
                  id="client_id"
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleClientChange}
                  disabled={isSubmitting || loadingClients}
                  className={inputClass}
                >
                  <option value="">
                    {loadingClients
                      ? "Loading client companies…"
                      : clients.length === 0
                        ? "No active companies found"
                        : "Choose a Client Company"}
                  </option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.company_code})
                    </option>
                  ))}
                </select>

                {selectedClient && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs text-blue-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white font-extrabold ring-1 ring-blue-100">
                      {selectedClient.name?.charAt(0)?.toUpperCase() || "C"}
                    </span>
                    <span>Company: <strong>{selectedClient.name}</strong> ({selectedClient.company_code})</span>
                    <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </div>
                )}
              </section>
            )}

            {(isClientAdmin || (isSuperAdmin && formData.client_id)) && (
              <section
                className="case-field rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.035)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,.06)] sm:p-5"
                style={{ animationDelay: "60ms" }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label htmlFor="assigned_to" className={labelClass}>
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-[10px] text-emerald-700 ring-1 ring-emerald-100">
                      {isSuperAdmin ? "02" : "01"}
                    </span>
                    Assign investigator <span className="text-emerald-600">*</span>
                  </label>
                  <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-400">
                    {loadingUsers ? "Loading…" : `${companyUsers.length} available`}
                  </span>
                </div>

                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleUserChange}
                  disabled={isSubmitting || loadingUsers}
                  className={inputClass}
                >
                  <option value="">
                    {loadingUsers
                      ? "Loading company investigators…"
                      : companyUsers.length === 0
                        ? "No active investigators found"
                        : "Choose an investigator"}
                  </option>
                  {companyUsers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.username} ({item.email})
                    </option>
                  ))}
                </select>

                {selectedUser && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white font-extrabold ring-1 ring-emerald-100">
                      {selectedUser.username?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                    <span>Assigned to <strong>{selectedUser.username}</strong></span>
                    <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </div>
                )}
              </section>
            )}

            {isSuperAdmin && !formData.client_id ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="15" rx="2" />
                    <path d="M7 9h10M7 13h6" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-700">Choose a client company first</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The company's investigators and Investigating Officers will load after selecting a client.
                </p>
              </div>
            ) : (isClientAdmin || (isSuperAdmin && companyUsers.length > 0)) && !formData.assigned_to ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="15" rx="2" />
                    <path d="M7 9h10M7 13h6" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-700">Choose an investigator first</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The relevant Investigating Officers will load after you select an investigator.
                </p>
              </div>
            ) : (
              <section
                className="case-field rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.035)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,.06)] sm:p-5"
                style={{ animationDelay: "120ms" }}
              >
                {hasZeroIOs ? (
                  <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                          <path d="M12 9v4M12 16h.01" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-amber-800">Required action</p>
                        <h3 className="mt-1 text-sm font-extrabold text-slate-900">No Investigating Officer found</h3>
                        <p className="mt-1.5 text-xs leading-5 text-slate-600">
                          {isClientAdmin || isSuperAdmin
                            ? `${selectedUser?.username || "The selected investigator"} has no registered IO. Add one to continue.`
                            : "Register an Investigating Officer before creating this case."}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsIOModalOpen(true)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-700"
                        >
                          <span className="text-base leading-none">+</span> Register officer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="io_id" className={labelClass}>
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-[10px] text-emerald-700 ring-1 ring-emerald-100">
                          {isSuperAdmin ? "03" : isClientAdmin ? "02" : "01"}
                        </span>
                        Investigating officer <span className="text-emerald-600">*</span>
                      </label>
                      <div className="flex items-center gap-3 pb-2">
                        {!isClientAdmin && !isSuperAdmin && (
                          <button type="button" onClick={() => navigate("/dashboard/io-master")} className="text-[10px] font-bold text-slate-500 transition hover:text-emerald-700">
                            Manage IOs ↗
                          </button>
                        )}
                        <button type="button" onClick={() => setIsIOModalOpen(true)} className="text-[10px] font-extrabold text-emerald-700 transition hover:text-emerald-900">
                          + Add new
                        </button>
                      </div>
                    </div>

                    <select
                      id="io_id"
                      name="io_id"
                      value={formData.io_id}
                      onChange={handleChange}
                      disabled={isSubmitting || loadingIOs}
                      className={inputClass}
                    >
                      <option value="">
                        {loadingIOs ? "Loading officers…" : "Choose an Investigating Officer"}
                      </option>
                      {ioList.map((io) => (
                        <option key={io.id} value={io.id}>
                          {io.officer_name} ({io.designation || "Officer"}{io.police_station ? ` - ${io.police_station}` : ""})
                        </option>
                      ))}
                    </select>

                    {selectedIO && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-xs text-slate-600">
                        <span className="case-pulse h-2 w-2 rounded-full bg-emerald-500" />
                        <strong className="text-emerald-800">{selectedIO.officer_name}</strong>
                        {selectedIO.designation && <span>· {selectedIO.designation}</span>}
                        {selectedIO.police_station && <span>· {selectedIO.police_station}</span>}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            <section
              className="case-field rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.035)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,.06)] sm:p-5"
              style={{ animationDelay: "180ms" }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="case_name" className={labelClass}>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[10px] text-blue-700 ring-1 ring-blue-100">
                    {isSuperAdmin ? "04" : isClientAdmin ? "03" : "02"}
                  </span>
                  Case name <span className="text-emerald-600">*</span>
                </label>
                <span className="text-[10px] font-bold tabular-nums text-slate-400">
                  {formData.case_name.length}<span className="font-medium"> / 255</span>
                </span>
              </div>

              <input
                id="case_name"
                name="case_name"
                type="text"
                value={formData.case_name}
                onChange={handleChange}
                disabled={isSubmitting || hasZeroIOs || (isClientAdmin && !formData.assigned_to)}
                placeholder={
                  isClientAdmin && !formData.assigned_to
                    ? "Select an investigator first"
                    : hasZeroIOs
                      ? "Register an IO to unlock"
                      : "e.g. Cyber Fraud Investigation #402"
                }
                maxLength={255}
                autoComplete="off"
                className={inputClass}
              />
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Use a distinct name your team can recognize quickly.
              </div>
            </section>

            <section
              className="case-field rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.035)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(15,23,42,.06)] sm:p-5"
              style={{ animationDelay: "240ms" }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="description" className={labelClass}>
                  Investigation notes <span className="font-medium normal-case tracking-normal text-slate-400">· Optional</span>
                </label>
                <span className="text-[10px] font-bold tabular-nums text-slate-400">
                  {formData.description.length}<span className="font-medium"> / 5000</span>
                </span>
              </div>

              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={isSubmitting || hasZeroIOs}
                placeholder="Add background, known details, or context for this investigation…"
                maxLength={5000}
                rows={4}
                className={`${inputClass} resize-y leading-6`}
              />
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Keep sensitive case notes relevant and factual.
              </div>
            </section>

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4 text-rose-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-100">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </svg>
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em]">Something needs your attention</p>
                  <p className="mt-1 text-xs leading-5">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Live preview panel */}
          <aside className="relative hidden lg:block">
            <div className="sticky top-2 overflow-hidden rounded-2xl border border-[#20345C] bg-gradient-to-b from-[#172B51] via-[#122345] to-[#0D1932] p-5 text-white shadow-[0_16px_38px_rgba(15,23,42,.16)]">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-extrabold uppercase tracking-[.2em] text-emerald-200">Live preview</span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-bold text-emerald-200">DRAFT</span>
                </div>

                <div className="mt-6 flex h-24 items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/[.07]">
                    <div className="case-orbit absolute inset-2 rounded-full border border-dashed border-emerald-200/35" />
                    <svg className="h-8 w-8 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 3h7l5 5v13H7z" />
                      <path d="M14 3v6h5M10 13h6M10 17h6" />
                    </svg>
                  </div>
                </div>

                <p className="mt-4 break-words text-center text-lg font-extrabold leading-snug">
                  {formData.case_name.trim() || "Your case title"}
                </p>
                <p className="mt-2 line-clamp-4 min-h-[3.5rem] text-center text-xs leading-5 text-slate-300">
                  {formData.description.trim() || "Your investigation summary will appear here as you fill in the form."}
                </p>

                <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                  {isSuperAdmin && (
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${selectedClient ? "bg-blue-300/15 text-blue-200" : "bg-white/10 text-slate-400"}`}>
                        {selectedClient ? "✓" : "01"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Client company</p>
                        <p className="mt-1 truncate text-xs font-semibold text-white">
                          {selectedClient?.name || "Awaiting company"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${selectedUser || (!isClientAdmin && !isSuperAdmin) ? "bg-emerald-300/15 text-emerald-200" : "bg-white/10 text-slate-400"}`}>
                      {selectedUser || (!isClientAdmin && !isSuperAdmin) ? "✓" : isSuperAdmin ? "02" : "01"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Investigator</p>
                      <p className="mt-1 truncate text-xs font-semibold text-white">
                        {selectedUser?.username || ((isClientAdmin || isSuperAdmin) ? "Awaiting assignment" : user?.username || "Current user")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${selectedIO ? "bg-emerald-300/15 text-emerald-200" : "bg-white/10 text-slate-400"}`}>
                      {selectedIO ? "✓" : isSuperAdmin ? "03" : isClientAdmin ? "02" : "01"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Investigating officer</p>
                      <p className="mt-1 truncate text-xs font-semibold text-white">
                        {selectedIO?.officer_name || "Awaiting selection"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${formData.case_name.trim().length >= 2 ? "bg-emerald-300/15 text-emerald-200" : "bg-white/10 text-slate-400"}`}>
                      {formData.case_name.trim().length >= 2 ? "✓" : isSuperAdmin ? "04" : isClientAdmin ? "03" : "02"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Case details</p>
                      <p className="mt-1 text-xs font-semibold text-white">
                        {formData.case_name.trim().length >= 2 ? "Title added" : "Awaiting case title"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/[.045] p-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-200">Ready for review</span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                    Check the assignment and case details before creating the record.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
            <p className="hidden text-[10px] font-medium text-slate-400 sm:block">
              ARTHBODH <span className="mx-1 text-slate-300">/</span> Investigation management
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  hasZeroIOs ||
                  (isSuperAdmin && !formData.client_id) ||
                  ((isClientAdmin || (isSuperAdmin && companyUsers.length > 0)) && !formData.assigned_to)
                }
                className="group/create relative inline-flex min-w-[170px] items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-xs font-extrabold text-white shadow-[0_9px_22px_rgba(5,150,105,.22)] transition duration-300 hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700 hover:shadow-[0_14px_28px_rgba(5,150,105,.28)] focus:outline-none focus:ring-4 focus:ring-emerald-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <span className="absolute inset-y-0 left-0 w-16 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/create:translate-x-[260px]" />
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating case…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Create case
                    <span aria-hidden="true" className="transition-transform group-hover/create:translate-x-1">→</span>
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>

        <CreateIOModal
          isOpen={isIOModalOpen}
          onClose={() => setIsIOModalOpen(false)}
          onSubmit={handleCreateIOQuick}
          isSubmitting={isCreatingIO}
          isClientAdmin={isClientAdmin}
        />
      </section>
    </div>
  );
}

export default CreateCaseModal;
