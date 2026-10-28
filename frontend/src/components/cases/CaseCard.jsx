
function CaseCard({ caseData, onOpen, isClientAdmin, isSuperAdmin }) {
  const status = String(caseData?.status || "UNKNOWN").toUpperCase();

  const statusClasses = {
    DRAFT: {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      accent: "bg-amber-400",
    },
    ACTIVE: {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
      accent: "bg-emerald-500",
    },
    IN_PROGRESS: {
      badge: "border-blue-200 bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
      accent: "bg-blue-500",
    },
    COMPLETED: {
      badge: "border-green-200 bg-green-50 text-green-700",
      dot: "bg-green-500",
      accent: "bg-green-500",
    },
    ARCHIVED: {
      badge: "border-slate-200 bg-slate-100 text-slate-600",
      dot: "bg-slate-400",
      accent: "bg-slate-400",
    },
    FAILED: {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
      accent: "bg-rose-500",
    },
    UNKNOWN: {
      badge: "border-slate-200 bg-slate-100 text-slate-600",
      dot: "bg-slate-400",
      accent: "bg-slate-400",
    },
  };

  const statusStyle = statusClasses[status] || statusClasses.UNKNOWN;

  function formatDate(date) {
    if (!date) return "-";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function handleOpen() {
    if (typeof onOpen === "function") {
      onOpen(caseData);
    }
  }

  function handleCardKeyDown(event) {
    // Keep keyboard navigation accessible.
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open case ${caseData?.case_name || caseData?.case_number || caseData?.id || ""}`}
      onClick={handleOpen}
      onKeyDown={handleCardKeyDown}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-4 focus:ring-emerald-100 motion-reduce:transform-none motion-reduce:transition-none"
    >
      {/* Top accent */}
      <div
        className={`absolute inset-x-0 top-0 h-1 ${statusStyle.accent}`}
        aria-hidden="true"
      />

      {/* Soft decorative background */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-100/50 blur-3xl transition duration-500 group-hover:bg-emerald-200/50"
        aria-hidden="true"
      />

      {/* Card header */}
      <div className="relative z-10 flex items-start justify-between gap-3 px-5 pb-0 pt-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-25 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-500/10" />
            </span>

            <p
              title={caseData?.case_number || ""}
              className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-800 sm:text-xs"
            >
              {caseData?.case_number || "CASE UNASSIGNED"}
            </p>
          </div>

          <h3
            title={caseData?.case_name || ""}
            className="mt-3 break-words text-lg font-bold leading-snug tracking-tight text-[#172554] transition-colors group-hover:text-emerald-800 sm:text-xl"
          >
            {caseData?.case_name || "Untitled Case"}
          </h3>
        </div>

        <span
          className={`inline-flex max-w-[46%] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wide sm:px-3 sm:text-[10px] ${statusStyle.badge}`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusStyle.dot}`}
          />
          <span className="truncate">
            {status.replaceAll("_", " ")}
          </span>
        </span>
      </div>

      {/* Description */}
      <div className="relative z-10 mt-4 px-5 sm:px-6">
        <p className="line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-slate-600">
          {caseData?.description ||
            "No description provided for this investigation."}
        </p>
      </div>

      {/* Case details */}
      <div className="relative z-10 mx-5 mt-5 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 sm:mx-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Created date */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 11h18" />
                </svg>
              </span>

              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Created
              </p>
            </div>

            <p className="mt-2 pl-1 text-xs font-bold text-slate-800">
              {formatDate(caseData?.created_at)}
            </p>
          </div>

          {/* Case ID */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path d="M8 9h8M8 13h5" />
                </svg>
              </span>

              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Case ID
              </p>
            </div>

            <p className="mt-2 pl-1 text-xs font-bold text-slate-800">
              #{caseData?.id ?? "-"}
            </p>
          </div>
        </div>

        {/* Documents Summary */}
        <div className="mt-4 border-t border-slate-200/70 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-600">
                Documents & Workbooks
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-700">
              {(caseData?.total_document_count ?? ((caseData?.bank_statement_count || 0) + (caseData?.ncrp_count || 0)))} Total
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="font-bold">{caseData?.bank_statement_count || 0}</span> Bank {caseData?.bank_statement_count === 1 ? "Stmt" : "Stmts"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
              <span className="font-bold">{caseData?.ncrp_count || 0}</span> NCRP {caseData?.ncrp_count === 1 ? "Workbook" : "Workbooks"}
            </span>
          </div>
        </div>

        {/* Client Company */}
        {(isSuperAdmin || caseData?.client || caseData?.client_name) && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-blue-700">
                Client Company
              </p>
            </div>

            {(() => {
              const companyName =
                caseData?.client?.name ||
                caseData?.client_name ||
                null;
              const companyCode =
                caseData?.client?.company_code ||
                caseData?.company_code ||
                null;

              if (!companyName && !companyCode) {
                return (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      Not Assigned
                    </span>
                  </div>
                );
              }

              const initial = (companyName?.charAt(0) || "C").toUpperCase();

              return (
                <div className="mt-2 flex items-center justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-xs font-extrabold text-blue-700 shadow-xs">
                      {initial}
                    </div>
                    <p
                      title={companyName || ""}
                      className="truncate text-sm font-bold text-[#172554]"
                    >
                      {companyName || "Unknown Company"}
                    </p>
                  </div>

                  {companyCode && (
                    <span className="inline-flex shrink-0 items-center rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                      {companyCode}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Case Owner for client admins & managers */}
        {(isClientAdmin || isSuperAdmin || caseData?.creator || caseData?.owner_username) && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-indigo-700">
                Case Owner
              </p>
            </div>

            {(() => {
              const ownerUsername =
                caseData.creator?.username ||
                caseData.owner_username ||
                (caseData.created_by ? `User #${caseData.created_by}` : null);
              const ownerEmail =
                caseData.creator?.email ||
                caseData.owner_email ||
                null;
              const ownerRole = caseData.creator?.role || null;
              const initial = (ownerUsername?.charAt(0) || "U").toUpperCase();

              return (
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xs font-extrabold text-indigo-700 shadow-xs">
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        title={ownerUsername || ""}
                        className="truncate text-sm font-bold text-[#172554]"
                      >
                        {ownerUsername || "Unknown User"}
                      </p>
                      {ownerRole && (
                        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                          {ownerRole}
                        </span>
                      )}
                    </div>

                    {ownerEmail ? (
                      <p
                        title={ownerEmail}
                        className="mt-0.5 truncate text-xs text-[#64748B]"
                      >
                        {ownerEmail}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Case Owner
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Investigating officer */}
        {caseData?.io && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-800">
                Investigating Officer
              </p>
            </div>

            <p
              title={caseData.io.officer_name || ""}
              className="mt-2 truncate text-sm font-bold text-slate-800"
            >
              {caseData.io.officer_name || "-"}
            </p>

            {caseData.io.designation && (
              <p className="mt-1 truncate text-xs text-slate-500">
                {caseData.io.designation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="relative z-10 mt-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 transition-transform duration-300 group-hover:scale-105">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
                <path d="M8 9h8M8 13h5" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-700">
                Investigation
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Case workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm shadow-emerald-600/15 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100 active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none sm:px-4 sm:text-xs"
          >
            Open Case

            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

export default CaseCard;
