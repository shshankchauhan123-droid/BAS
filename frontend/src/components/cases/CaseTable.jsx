
import React from "react";

function CaseTable({
  cases = [],
  onOpen,
  onOpenCase,
  isClientAdmin = false,
  isSuperAdmin = false,
}) {
  const safeCases = Array.isArray(cases) ? cases : [];

  // Support both callback prop names.
  const openCase =
    typeof onOpenCase === "function" ? onOpenCase : onOpen;

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatus = (value) => {
    const status = String(value || "UNKNOWN").toUpperCase();

    const styles = {
      DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
      ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
      IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
      COMPLETED: "border-green-200 bg-green-50 text-green-700",
      ARCHIVED: "border-slate-200 bg-slate-100 text-slate-600",
      FAILED: "border-rose-200 bg-rose-50 text-rose-700",
      UNKNOWN: "border-slate-200 bg-slate-100 text-slate-600",
    };

    const dots = {
      DRAFT: "bg-amber-500",
      ACTIVE: "bg-emerald-500",
      IN_PROGRESS: "bg-blue-500",
      COMPLETED: "bg-green-500",
      ARCHIVED: "bg-slate-400",
      FAILED: "bg-rose-500",
      UNKNOWN: "bg-slate-400",
    };

    return {
      label: status.replaceAll("_", " "),
      badge: styles[status] || styles.UNKNOWN,
      dot: dots[status] || dots.UNKNOWN,
    };
  };

  const handleOpen = (caseData) => {
    if (typeof openCase === "function") {
      openCase(caseData);
    }
  };

  const handleRowKeyDown = (event, caseData) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen(caseData);
    }
  };

  if (safeCases.length === 0) {
    return (
      <div className="relative animate-[fadeInUp_450ms_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .case-table-row {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>

        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-100/70 blur-3xl" />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10M7 12h6M7 16h4" />
          </svg>
        </div>

        <h3 className="relative mt-5 text-base font-bold text-[#172554]">
          No cases found
        </h3>

        <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          There are no cases to display right now. Create a new case to begin
          your investigation.
        </p>
      </div>
    );
  }

  return (
    <div className="group/table relative animate-[fadeInUp_450ms_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .case-table-row {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />

      <div className="relative overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-[#F8FAFC]">
              <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Case Number
              </th>
              <th className="min-w-[220px] px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Case Name
              </th>

              {isSuperAdmin && (
                <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                  Client Company
                </th>
              )}

              {(isClientAdmin || isSuperAdmin) && (
                <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                  Case Owner
                </th>
              )}

              <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Investigating Officer
              </th>
              <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Status
              </th>
              <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Documents
              </th>
              <th className="whitespace-nowrap px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Created
              </th>
              <th className="whitespace-nowrap px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:px-6">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {safeCases.map((caseData, index) => {
              if (!caseData || typeof caseData !== "object") {
                return null;
              }

              const status = getStatus(caseData.status);
              const caseKey =
                caseData.id ??
                caseData.case_number ??
                `case-${index}`;

              return (
                <tr
                  key={caseKey}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open case ${
                    caseData.case_name ||
                    caseData.case_number ||
                    caseData.id ||
                    ""
                  }`}
                  onClick={() => handleOpen(caseData)}
                  onKeyDown={(event) =>
                    handleRowKeyDown(event, caseData)
                  }
                  style={{
                    animationDelay: `${Math.min(index, 8) * 45}ms`,
                  }}
                  className="case-table-row group/row animate-[fadeInUp_400ms_ease-out_both] cursor-pointer bg-white transition-all duration-200 hover:bg-emerald-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 motion-reduce:transition-none"
                >
                  <td className="whitespace-nowrap px-5 py-5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.10)] transition-transform duration-200 group-hover/row:scale-125" />
                      <span className="text-sm font-bold text-emerald-800">
                        {caseData.case_number || "-"}
                      </span>
                    </div>
                  </td>

                  <td className="max-w-[380px] px-5 py-5 sm:px-6">
                    <p className="truncate text-sm font-bold text-[#172554] transition-colors group-hover/row:text-emerald-800">
                      {caseData.case_name || "Untitled Case"}
                    </p>
                    <p className="mt-1.5 max-w-[340px] truncate text-xs leading-5 text-slate-500">
                      {caseData.description || "No description provided"}
                    </p>
                  </td>

                  {isSuperAdmin && (
                    <td className="whitespace-nowrap px-5 py-5 sm:px-6">
                      {(() => {
                        const companyName =
                          caseData.client?.name ||
                          caseData.client_name ||
                          null;
                        const companyCode =
                          caseData.client?.company_code ||
                          caseData.company_code ||
                          null;

                        if (!companyName && !companyCode) {
                          return (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                              Not Assigned
                            </span>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-xs font-extrabold text-blue-700 shadow-xs">
                              {(companyName || "C").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p
                                title={companyName || ""}
                                className="max-w-[170px] truncate text-sm font-bold text-[#172554]"
                              >
                                {companyName || "Unknown Company"}
                              </p>
                              {companyCode ? (
                                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                  {companyCode}
                                </span>
                              ) : (
                                <p className="text-[10px] text-slate-400">Company</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  )}

                  {(isClientAdmin || isSuperAdmin) && (
                    <td className="whitespace-nowrap px-5 py-5 sm:px-6">
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

                        if (!ownerUsername && !ownerEmail) {
                          return (
                            <span className="text-xs italic text-slate-400">
                              System / Unassigned
                            </span>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2.5">
                            <div
                              title={`Owner: ${ownerUsername || "User"}`}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xs font-extrabold text-indigo-700 shadow-xs"
                            >
                              {initial}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p
                                  title={ownerUsername || ""}
                                  className="max-w-[150px] truncate text-sm font-bold text-[#172554]"
                                >
                                  {ownerUsername || "Unknown"}
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
                                  className="mt-0.5 max-w-[180px] truncate text-xs text-[#64748B]"
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
                    </td>
                  )}

                  <td className="whitespace-nowrap px-5 py-5 sm:px-6">
                    {caseData.io ? (
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-xs font-extrabold text-emerald-700">
                          {caseData.io.officer_name
                            ?.charAt(0)
                            ?.toUpperCase() || "O"}
                        </div>

                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-sm font-semibold text-slate-800">
                            {caseData.io.officer_name || "-"}
                          </p>
                          <p className="mt-0.5 max-w-[200px] truncate text-xs text-slate-500">
                            {caseData.io.designation ||
                              caseData.io.police_station ||
                              "Officer"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs italic text-slate-400">
                        Not Assigned
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 sm:px-6">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${status.badge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                      />
                      {status.label}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 sm:px-6">
                    {(() => {
                      const bankCount = caseData.bank_statement_count || 0;
                      const ncrpCount = caseData.ncrp_count || 0;
                      const totalDocs = caseData.total_document_count ?? (bankCount + ncrpCount);

                      if (totalDocs === 0) {
                        return (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            0 Docs
                          </span>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {bankCount > 0 && (
                              <span
                                title={`${bankCount} Bank Statement${bankCount === 1 ? '' : 's'}`}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                              >
                                <span className="font-bold">{bankCount}</span> Bank
                              </span>
                            )}
                            {ncrpCount > 0 && (
                              <span
                                title={`${ncrpCount} NCRP Workbook${ncrpCount === 1 ? '' : 's'}`}
                                className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700"
                              >
                                <span className="font-bold">{ncrpCount}</span> NCRP
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 pl-0.5">
                            {totalDocs} total {totalDocs === 1 ? 'document' : 'documents'}
                          </span>
                        </div>
                      );
                    })()}
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 text-sm font-medium text-slate-500 sm:px-6">
                    {formatDate(caseData.created_at)}
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpen(caseData);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm shadow-emerald-600/15 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100 active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none sm:px-4 sm:text-xs"
                    >
                      Open

                      <svg
                        className="h-3.5 w-3.5 transition-transform duration-200 group-hover/row:translate-x-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-[#F8FAFC]/80 px-5 py-3 sm:px-6">
        <p className="text-xs text-slate-500">
          Showing{" "}
          <span className="font-bold text-slate-700">
            {safeCases.length}
          </span>{" "}
          {safeCases.length === 1 ? "case" : "cases"}
        </p>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Click a row to open
        </span>
      </div>
    </div>
  );
}

export default CaseTable;
