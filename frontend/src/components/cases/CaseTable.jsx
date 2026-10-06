import React from "react";

function CaseTable({ cases = [], onOpen, isClientAdmin }) {
  // ------------------------------------------------------------
  // Safe cases
  // ------------------------------------------------------------

  const safeCases = Array.isArray(cases)
    ? cases
    : [];

  // ------------------------------------------------------------
  // Format date
  // ------------------------------------------------------------

  const formatDate = (date) => {
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
  };

  // ------------------------------------------------------------
  // Status classes
  // ------------------------------------------------------------

  const getStatusClasses = (status) => {
    const normalizedStatus = String(
      status || ""
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

    return (
      statusClasses[normalizedStatus] ||
      statusClasses.UNKNOWN
    );
  };

  // ------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------

  if (safeCases.length === 0) {
    return (
      <div
        className="
          rounded-[22px]
          border
          border-white/[0.08]
          bg-[#061411]/70
          p-14
          text-center
          shadow-[0_20px_60px_rgba(0,0,0,0.10)]
          backdrop-blur-sm
        "
      >
        {/* Icon */}

        <div
          className="
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            border
            border-emerald-400/15
            bg-emerald-400/[0.04]
          "
        >
          <svg
            className="h-7 w-7 text-emerald-400/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="2"
            />

            <path d="M7 8h10" />
            <path d="M7 12h6" />
            <path d="M7 16h4" />
          </svg>
        </div>

        {/* Title */}

        <p className="mt-5 text-base font-semibold text-white">
          No cases found
        </p>

        {/* Description */}

        <p className="mt-2 text-sm text-slate-500">
          Create a new case to begin your investigation.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Table
  // ------------------------------------------------------------

  return (
    <div
      className="
        overflow-hidden
        rounded-[22px]
        border
        border-white/[0.08]
        bg-[#061411]/75
        shadow-[0_20px_60px_rgba(0,0,0,0.12)]
        backdrop-blur-sm
      "
    >
      <div className="overflow-x-auto">

        <table className="min-w-full">

          {/* ==================================================
              TABLE HEADER
          =================================================== */}

          <thead>
            <tr
              className="
                border-b
                border-white/[0.07]
                bg-white/[0.015]
              "
            >

              {/* Case Number */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-left
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Case Number
              </th>

              {/* Case Name */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-left
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Case Name
              </th>

              {/* Created By (Client Admin Only) */}
              {isClientAdmin && (
                <th
                  className="
                    whitespace-nowrap
                    px-6
                    py-5
                    text-left
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.18em]
                    text-slate-500
                  "
                >
                  Created By
                </th>
              )}

              {/* Investigating Officer */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-left
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Investigating Officer
              </th>

              {/* Status */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-left
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Status
              </th>

              {/* Created */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-left
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Created
              </th>

              {/* Action */}

              <th
                className="
                  whitespace-nowrap
                  px-6
                  py-5
                  text-right
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-slate-500
                "
              >
                Action
              </th>

            </tr>
          </thead>

          {/* ==================================================
              TABLE BODY
          =================================================== */}

          <tbody>

            {safeCases.map((caseData, index) => {

              // ------------------------------------------------
              // Invalid item protection
              // ------------------------------------------------

              if (
                !caseData ||
                typeof caseData !== "object"
              ) {
                return null;
              }

              const status = String(
                caseData.status || "UNKNOWN"
              ).toUpperCase();

              const caseKey =
                caseData.id ??
                caseData.case_number ??
                `case-${index}`;

              return (
                <tr
                  key={caseKey}
                  className="
                    border-b
                    border-white/[0.05]
                    transition-all
                    duration-200
                    last:border-b-0
                    hover:bg-emerald-400/[0.015]
                  "
                >

                  {/* ==================================================
                      CASE NUMBER
                  =================================================== */}

                  <td className="whitespace-nowrap px-6 py-6">

                    <div className="flex items-center gap-3">

                      {/* Small accent */}

                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />

                      <span
                        className="
                          text-sm
                          font-semibold
                          text-emerald-300
                        "
                      >
                        {caseData.case_number || "-"}
                      </span>

                    </div>

                  </td>

                  {/* ==================================================
                      CASE NAME
                  =================================================== */}

                  <td className="max-w-[380px] px-6 py-6">

                    <p
                      className="
                        truncate
                        text-sm
                        font-semibold
                        text-white
                      "
                    >
                      {caseData.case_name || "-"}
                    </p>

                    {caseData.description ? (
                      <p
                        className="
                          mt-1.5
                          truncate
                          text-xs
                          leading-5
                          text-slate-500
                        "
                      >
                        {caseData.description}
                      </p>
                    ) : (
                      <p
                        className="
                          mt-1.5
                          text-xs
                          text-slate-600
                        "
                      >
                        No description provided
                      </p>
                    )}

                  </td>

                  {/* ==================================================
                      CREATED BY (Client Admin Only)
                  =================================================== */}

                  {isClientAdmin && (
                    <td className="whitespace-nowrap px-6 py-6">
                      {caseData.creator ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-400/10 text-[10px] font-bold text-indigo-400">
                            {caseData.creator.username?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              {caseData.creator.username}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wider">
                              {caseData.creator.role || "User"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 italic">
                          Unknown User
                        </span>
                      )}
                    </td>
                  )}

                  {/* ==================================================
                      INVESTIGATING OFFICER
                  =================================================== */}

                  <td className="whitespace-nowrap px-6 py-6">
                    {caseData.io ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/10 text-[10px] font-bold text-emerald-400">
                            {caseData.io.officer_name?.charAt(0)?.toUpperCase() || "O"}
                          </div>
                          <span className="text-sm font-semibold text-slate-200">
                            {caseData.io.officer_name}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          <span className="text-emerald-400/90 font-medium">{caseData.io.designation}</span>
                          {caseData.io.police_station ? ` • ${caseData.io.police_station}` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 italic">
                        Not Assigned
                      </span>
                    )}
                  </td>

                  {/* ==================================================
                      STATUS
                  =================================================== */}

                  <td className="whitespace-nowrap px-6 py-6">

                    <span
                      className={`
                        inline-flex
                        items-center
                        rounded-full
                        border
                        px-3
                        py-1.5
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.12em]
                        ${getStatusClasses(status)}
                      `}
                    >
                      {status.replaceAll(
                        "_",
                        " "
                      )}
                    </span>

                  </td>

                  {/* ==================================================
                      CREATED
                  =================================================== */}

                  <td
                    className="
                      whitespace-nowrap
                      px-6
                      py-6
                      text-sm
                      text-slate-500
                    "
                  >
                    {formatDate(
                      caseData.created_at
                    )}
                  </td>

                  {/* ==================================================
                      ACTION
                  =================================================== */}

                  <td className="whitespace-nowrap px-6 py-6 text-right">

                    <button
                      type="button"
                      onClick={() => {
  console.log("========== OPEN CLICK ==========");
  console.log("caseData:", caseData);
  console.log("caseData.id:", caseData?.id);
  console.log("typeof id:", typeof caseData?.id);
  console.log(
    "is Promise:",
    caseData?.id instanceof Promise
  );

  if (typeof onOpen === "function") {
    onOpen(caseData);
  }
}}
                      className="
                        rounded-xl
                        border
                        border-white/[0.08]
                        bg-white/[0.015]
                        px-4
                        py-2.5
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.12em]
                        text-slate-400
                        transition-all
                        duration-200
                        hover:border-emerald-400/25
                        hover:bg-emerald-400/[0.05]
                        hover:text-emerald-300
                        active:scale-[0.97]
                      "
                    >
                      Open
                    </button>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>
      </div>
    </div>
  );
}

export default CaseTable;