import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getIOMasters, createIOMaster } from "../../services/api/ioMaster";
import CreateIOModal from "../io_master/CreateIOModal";

function CreateCaseModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    case_name: "",
    description: "",
    io_id: "",
  });

  const [ioList, setIoList] = useState([]);
  const [loadingIOs, setLoadingIOs] = useState(false);
  const [isIOModalOpen, setIsIOModalOpen] = useState(false);
  const [isCreatingIO, setIsCreatingIO] = useState(false);

  const [error, setError] = useState("");

  const hasZeroIOs = !loadingIOs && ioList.length === 0;

  const selectedIO = ioList.find(
    (io) => String(io.id) === String(formData?.io_id)
  );

  // ------------------------------------------------------------
  // Reset form when modal opens
  // ------------------------------------------------------------

  const loadIOList = async () => {
    try {
      setLoadingIOs(true);
      const res = await getIOMasters();
      const list = Array.isArray(res?.data) ? res.data : [];
      setIoList(list);

      // If officers exist and no IO is currently selected, auto-select the first one
      if (list.length > 0) {
        setFormData((prev) => ({
          ...prev,
          io_id: prev.io_id || String(list[0].id),
        }));
      }
    } catch (e) {
      console.error("Failed to load IO list:", e);
    } finally {
      setLoadingIOs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({
        case_name: "",
        description: "",
        io_id: "",
      });

      setError("");
      loadIOList();
    }
  }, [isOpen]);

  const handleCreateIOQuick = async (data) => {
    try {
      setIsCreatingIO(true);
      const res = await createIOMaster(data);
      const createdIO = res?.data;
      setIsIOModalOpen(false);
      await loadIOList();
      if (createdIO?.id) {
        setFormData((prev) => ({
          ...prev,
          io_id: String(createdIO.id),
        }));
      }
    } catch (err) {
      console.error("Failed to create IO:", err);
      throw err;
    } finally {
      setIsCreatingIO(false);
    }
  };

  // ------------------------------------------------------------
  // Don't render when closed
  // ------------------------------------------------------------

  if (!isOpen) {
    return null;
  }

  // ------------------------------------------------------------
  // Input change
  // ------------------------------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  // ------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    const caseName = String(
      formData?.case_name || ""
    ).trim();

    const description = String(
      formData?.description || ""
    ).trim();

    // 1. Validate Investigating Officer (Mandatory first step)
    if (hasZeroIOs) {
      setError("You must register an Investigating Officer (IO) first before creating your first case.");
      setIsIOModalOpen(true);
      return;
    }

    if (!formData?.io_id) {
      setError("Please select an Investigating Officer (IO) first.");
      return;
    }

    // 2. Validate case name
    if (!caseName) {
      setError("Case name is required.");
      return;
    }

    if (caseName.length < 2) {
      setError(
        "Case name must contain at least 2 characters."
      );
      return;
    }

    if (caseName.length > 255) {
      setError(
        "Case name cannot exceed 255 characters."
      );
      return;
    }

    // Validate description

    if (description.length > 5000) {
      setError(
        "Description cannot exceed 5000 characters."
      );
      return;
    }

    try {
      await onSubmit({
        case_name: caseName,
        description: description || null,
        io_id: formData.io_id ? Number(formData.io_id) : null,
      });
    } catch (submitError) {
      console.error(
        "Create case modal submit error:",
        submitError
      );
    }
  };

  // ------------------------------------------------------------
  // Close modal
  // ------------------------------------------------------------

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    setError("");
    onClose();
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-start
        justify-center
        overflow-y-auto
        bg-[#010605]/85
        p-4
        sm:p-6
        backdrop-blur-md
      "
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >

      {/* =====================================================
          MODAL
      ====================================================== */}

      <div
        className="
          relative
          my-auto
          w-full
          max-w-xl
          overflow-hidden
          rounded-[24px]
          border
          border-white/[0.09]
          bg-[#061411]
          shadow-[0_30px_100px_rgba(0,0,0,0.45)]
        "
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >

        {/* ===================================================
            TOP GLOW
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            left-0
            right-0
            top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-emerald-400/50
            to-transparent
          "
        />

        {/* ===================================================
            HEADER
        ==================================================== */}

        <div
          className="
            flex
            items-start
            justify-between
            border-b
            border-white/[0.06]
            px-7
            py-6
          "
        >

          <div>

            {/* BAS label */}

            <div className="flex items-center gap-2">

              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_10px_rgba(52,211,153,0.8)]
                "
              />

              <span
                className="
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.25em]
                  text-emerald-400/70
                "
              >
                BAS / Investigation
              </span>

            </div>

            {/* Title */}

            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Create New Case
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Create a financial investigation case.
            </p>

          </div>

          {/* Close button */}

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-white/[0.08]
              bg-white/[0.02]
              text-slate-500
              transition-all
              duration-200
              hover:border-white/[0.15]
              hover:bg-white/[0.05]
              hover:text-slate-200
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M6 6l12 12"
                strokeLinecap="round"
              />

              <path
                d="M18 6L6 18"
                strokeLinecap="round"
              />
            </svg>
          </button>

        </div>

        {/* ===================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
          className="px-7 py-7"
        >

          <div className="space-y-6">

            {/* =================================================
                STEP 1: INVESTIGATING OFFICER (IO) - MANDATORY
            ================================================== */}

            <div>
              {hasZeroIOs ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-lg font-bold text-amber-300">
                      ⚠️
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Mandatory First Step
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-semibold text-white">
                        Investigating Officer (IO) Required
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        Before creating your first case, you must register an Investigating Officer (IO).
                        For future cases, this officer can be reused automatically, or you can register a new one anytime.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsIOModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#020b09] shadow-[0_6px_20px_rgba(52,211,153,0.25)] transition-all hover:bg-emerald-300 active:scale-95"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Register Investigating Officer Now
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="io_id"
                      className="
                        block
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.16em]
                        text-slate-400
                      "
                    >
                      1. Investigating Officer (IO)
                      <span className="ml-1 text-emerald-400">*</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard/io-master")}
                        className="text-[10px] font-semibold text-slate-400 hover:text-emerald-300 transition"
                      >
                        Manage IOs ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsIOModalOpen(true)}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        + Add New IO
                      </button>
                    </div>
                  </div>

                  <select
                    id="io_id"
                    name="io_id"
                    value={formData?.io_id || ""}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="
                      w-full
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-[#020b09]
                      px-4
                      py-3.5
                      text-sm
                      text-white
                      outline-none
                      transition-all
                      duration-200
                      hover:border-white/[0.12]
                      focus:border-emerald-400/30
                      focus:bg-[#03100d]
                      focus:ring-4
                      focus:ring-emerald-400/[0.05]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    <option value="" className="bg-[#03100d] text-slate-400">
                      {loadingIOs
                        ? "Loading officers..."
                        : "-- Select Investigating Officer * --"}
                    </option>
                    {ioList.map((io) => (
                      <option
                        key={io.id}
                        value={io.id}
                        className="bg-[#03100d] text-white"
                      >
                        {io.officer_name} ({io.designation} - {io.police_station})
                      </option>
                    ))}
                  </select>

                  {/* Selected IO Summary & Designation Badge */}
                  {selectedIO ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Officer Assigned to Case
                        </span>
                        <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                          {selectedIO.designation}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-white">
                        {selectedIO.officer_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Station / Branch: <span className="text-slate-200">{selectedIO.police_station}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Select an IO from the list above, or click "+ Add New IO" to register a different officer.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* =================================================
                STEP 2: CASE NAME
            ================================================== */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <label
                  htmlFor="case_name"
                  className="
                    block
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-slate-400
                  "
                >
                  2. Case Name
                  <span className="ml-1 text-emerald-400">
                    *
                  </span>
                </label>

                <span className="text-[9px] text-slate-600">
                  {String(
                    formData?.case_name || ""
                  ).length}
                  /255
                </span>

              </div>

              <input
                id="case_name"
                name="case_name"
                type="text"
                value={formData?.case_name || ""}
                onChange={handleChange}
                disabled={isSubmitting || hasZeroIOs}
                placeholder={hasZeroIOs ? "Register an Investigating Officer above to unlock" : "Enter case name (e.g. Cyber Fraud Case #402)"}
                maxLength={255}
                autoComplete="off"
                className="
                  w-full
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-[#020b09]
                  px-4
                  py-3.5
                  text-sm
                  text-white
                  outline-none
                  transition-all
                  duration-200
                  placeholder:text-slate-600
                  hover:border-white/[0.12]
                  focus:border-emerald-400/30
                  focus:bg-[#03100d]
                  focus:ring-4
                  focus:ring-emerald-400/[0.05]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />

              <p className="mt-2 text-[10px] text-slate-600">
                {hasZeroIOs ? "Investigating Officer registration is required before naming the case." : "Enter a name that clearly identifies this investigation."}
              </p>

            </div>

            {/* =================================================
                DESCRIPTION
            ================================================== */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <label
                  htmlFor="description"
                  className="
                    block
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-slate-400
                  "
                >
                  Description
                </label>

                <span className="text-[9px] text-slate-600">
                  {String(
                    formData?.description || ""
                  ).length}
                  /5000
                </span>

              </div>

              <textarea
                id="description"
                name="description"
                value={formData?.description || ""}
                onChange={handleChange}
                disabled={isSubmitting || hasZeroIOs}
                placeholder={hasZeroIOs ? "Register an Investigating Officer above to unlock" : "Enter case description..."}
                maxLength={5000}
                rows={4}
                className="
                  w-full
                  resize-none
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-[#020b09]
                  px-4
                  py-3.5
                  text-sm
                  leading-6
                  text-white
                  outline-none
                  transition-all
                  duration-200
                  placeholder:text-slate-600
                  hover:border-white/[0.12]
                  focus:border-emerald-400/30
                  focus:bg-[#03100d]
                  focus:ring-4
                  focus:ring-emerald-400/[0.05]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />

              <p className="mt-2 text-[10px] text-slate-600">
                Add any relevant information about this investigation.
              </p>

            </div>

            {/* =================================================
                ERROR
            ================================================== */}

            {error && (
              <div
                className="
                  rounded-xl
                  border
                  border-red-400/20
                  bg-red-400/[0.05]
                  px-4
                  py-3.5
                "
              >

                <div className="flex items-start gap-3">

                  <div
                    className="
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      bg-red-400/[0.08]
                    "
                  >

                    <svg
                      className="h-4 w-4 text-red-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                      />

                      <path
                        d="M12 8v5"
                        strokeLinecap="round"
                      />

                      <path
                        d="M12 16h.01"
                        strokeLinecap="round"
                      />
                    </svg>

                  </div>

                  <div>

                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">
                      Validation Error
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-300/80">
                      {error}
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* =================================================
              ACTIONS
          ================================================== */}

          <div
            className="
              mt-7
              flex
              flex-col-reverse
              gap-3
              border-t
              border-white/[0.06]
              pt-6
              sm:flex-row
              sm:items-center
              sm:justify-end
            "
          >

            {/* Cancel */}

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="
                rounded-xl
                border
                border-white/[0.08]
                bg-white/[0.02]
                px-5
                py-3
                text-xs
                font-semibold
                text-slate-400
                transition-all
                duration-200
                hover:border-white/[0.15]
                hover:bg-white/[0.04]
                hover:text-slate-200
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              Cancel
            </button>

            {/* Create */}

            <button
              type="submit"
              disabled={isSubmitting || hasZeroIOs}
              className="
                flex
                min-w-[145px]
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-emerald-400
                px-5
                py-3
                text-xs
                font-semibold
                text-[#03100d]
                shadow-[0_8px_25px_rgba(52,211,153,0.10)]
                transition-all
                duration-200
                hover:bg-emerald-300
                hover:shadow-[0_10px_30px_rgba(52,211,153,0.15)]
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-40
                disabled:shadow-none
              "
            >
              {isSubmitting ? (
                <>
                  <span
                    className="
                      h-3.5
                      w-3.5
                      animate-spin
                      rounded-full
                      border-2
                      border-slate-950/30
                      border-t-slate-950
                    "
                  />

                  Creating...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M12 5v14"
                      strokeLinecap="round"
                    />

                    <path
                      d="M5 12h14"
                      strokeLinecap="round"
                    />
                  </svg>

                  Create Case
                </>
              )}
            </button>

          </div>

        </form>

      </div>

      <CreateIOModal
        isOpen={isIOModalOpen}
        onClose={() => setIsIOModalOpen(false)}
        onSubmit={handleCreateIOQuick}
        isSubmitting={isCreatingIO}
      />

    </div>
  );
}

export default CreateCaseModal;