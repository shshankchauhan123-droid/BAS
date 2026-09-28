import { useEffect, useState } from "react";

function CreateCaseModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const [formData, setFormData] = useState({
    case_name: "",
    description: "",
  });

  const [error, setError] = useState("");

  // ------------------------------------------------------------
  // Reset form when modal opens
  // ------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setFormData({
        case_name: "",
        description: "",
      });

      setError("");
    }
  }, [isOpen]);

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

    // Validate case name

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
        items-center
        justify-center
        bg-[#010605]/80
        p-4
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
                CASE NAME
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
                  Case Name
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
                disabled={isSubmitting}
                placeholder="Enter case name"
                maxLength={255}
                autoComplete="off"
                autoFocus
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
                Enter a name that clearly identifies this investigation.
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
                disabled={isSubmitting}
                placeholder="Enter case description..."
                maxLength={5000}
                rows={6}
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
              disabled={isSubmitting}
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
                disabled:opacity-50
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

    </div>
  );
}

export default CreateCaseModal;