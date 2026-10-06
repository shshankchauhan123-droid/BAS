function CaseCard({ caseData, onOpen, isClientAdmin }) {
  // ------------------------------------------------------------
  // Status
  // ------------------------------------------------------------

  const status = String(
    caseData?.status || "UNKNOWN"
  ).toUpperCase();

  const statusClasses = {
    DRAFT:
      "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",

    ACTIVE:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

    IN_PROGRESS:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",

    COMPLETED:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

    ARCHIVED:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",

    FAILED:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",

    UNKNOWN:
      "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",
  };

  const statusStyle =
    statusClasses[status] ||
    statusClasses.UNKNOWN;

  // ------------------------------------------------------------
  // Format date
  // ------------------------------------------------------------

  function formatDate(date) {
    if (!date) {
      return "-";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ------------------------------------------------------------
  // Open case
  // ------------------------------------------------------------

  const handleOpen = () => {
    if (typeof onOpen === "function") {
      onOpen(caseData);
    }
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div
      className="
        group
        relative
        overflow-hidden
        rounded-[22px]
        border
        border-white/[0.08]
        bg-[#061411]/80
        p-6
        shadow-[0_20px_60px_rgba(0,0,0,0.12)]
        backdrop-blur-sm
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-emerald-400/20
        hover:bg-[#071814]
        hover:shadow-[0_24px_70px_rgba(0,0,0,0.18)]
      "
    >

      {/* =====================================================
          TOP ACCENT
      ====================================================== */}

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
          via-emerald-400/30
          to-transparent
          opacity-0
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex items-start justify-between gap-4">

        {/* Case information */}

        <div className="min-w-0">

          {/* Case number */}

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />

            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              {caseData?.case_number || "-"}
            </p>

          </div>

          {/* Case name */}

          <h3
            className="
              mt-3
              truncate
              text-lg
              font-semibold
              tracking-tight
              text-white
              transition-colors
              group-hover:text-emerald-50
            "
          >
            {caseData?.case_name || "-"}
          </h3>

        </div>

        {/* Status */}

        <span
          className={`
            shrink-0
            rounded-full
            border
            px-3
            py-1.5
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.12em]
            ${statusStyle}
          `}
        >
          {status.replaceAll("_", " ")}
        </span>

      </div>

      {/* =====================================================
          DESCRIPTION
      ====================================================== */}

      <div className="mt-6 min-h-[58px]">

        <p className="text-sm leading-6 text-slate-500">
          {caseData?.description ||
            "No description provided for this investigation."}
        </p>

      </div>

      {/* =====================================================
          DIVIDER
      ====================================================== */}

      <div className="my-6 h-px bg-white/[0.06]" />

      {/* =====================================================
          CASE INFORMATION
      ====================================================== */}

      <div className="grid grid-cols-2 gap-4">

        {/* Created */}

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Created
          </p>

          <p className="mt-2 text-xs font-medium text-slate-400">
            {formatDate(caseData?.created_at)}
          </p>
        </div>

        {/* Case ID */}

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Case ID
          </p>

          <p className="mt-2 text-xs font-medium text-slate-400">
            #{caseData?.id ?? "-"}
          </p>
        </div>

        {isClientAdmin && caseData?.creator && (
          <div className="col-span-2 pt-2 border-t border-white/[0.04]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-400/80">
              Created By
            </p>
            <p className="mt-1 text-xs font-medium text-slate-200 truncate">
              {caseData.creator.username} <span className="text-slate-400 uppercase text-[10px]">({caseData.creator.role})</span>
            </p>
          </div>
        )}

        {caseData?.io && (
          <div className="col-span-2 pt-2 border-t border-white/[0.04]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400/80">
              Investigating Officer
            </p>
            <p className="mt-1 text-xs font-medium text-slate-200 truncate">
              {caseData.io.officer_name} <span className="text-slate-400">({caseData.io.designation})</span>
            </p>
          </div>
        )}

      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <div className="mt-6 flex items-center justify-between gap-4">

        <div className="flex items-center gap-2">

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />

          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            Investigation Case
          </span>

        </div>

        {/* Open Case */}

        <button
          type="button"
          onClick={handleOpen}
          className="
            inline-flex
            items-center
            gap-2
            rounded-xl
            border
            border-emerald-400/20
            bg-emerald-400/[0.05]
            px-4
            py-2.5
            text-[10px]
            font-semibold
            uppercase
            tracking-[0.12em]
            text-emerald-300
            transition-all
            duration-200
            hover:border-emerald-400/35
            hover:bg-emerald-400/[0.10]
            hover:text-emerald-200
            active:scale-[0.97]
          "
        >
          Open Case

          <svg
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M5 12h14"
              strokeLinecap="round"
            />

            <path
              d="m13 6 6 6-6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>

    </div>
  );
}

export default CaseCard;