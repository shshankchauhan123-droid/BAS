import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import {
  createCase,
  getCases,
} from "../../../services/api/case";

import CaseTable from "../../../components/cases/CaseTable";
import CaseCard from "../../../components/cases/CaseCard";
import CreateCaseModal from "../../../components/cases/CreateCaseModal";

import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

function CaseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateCase =
    user?.role === "superadmin" ||
    user?.role === "client_admin" ||
    user?.permissions?.can_create_case !== false;


  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [error, setError] = useState("");

  // ============================================================
  // LOAD CASES
  // ============================================================

  const loadCases = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getCases();

      const caseList = Array.isArray(response?.data)
        ? response.data
        : [];

      setCases(caseList);
    } catch (requestError) {
      console.error(
        "Failed to load cases:",
        requestError
      );

      const message =
        requestError?.response?.data?.detail ||
        requestError?.message ||
        "Unable to load cases.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredCases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return cases;
    }

    return cases.filter((caseData) => {
      return (
        String(caseData.case_number || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.case_name || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.description || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.status || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.io?.officer_name || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.io?.designation || "")
          .toLowerCase()
          .includes(search) ||
        String(caseData.io?.police_station || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [cases, searchTerm]);

  // ============================================================
  // STATUS COUNTS
  // ============================================================

  const totalCases = cases.length;

  const draftCases = cases.filter(
    (item) =>
      String(item.status || "").toUpperCase() ===
      "DRAFT"
  ).length;

  const inProgressCases = cases.filter(
    (item) =>
      String(item.status || "").toUpperCase() ===
      "IN_PROGRESS"
  ).length;

  const completedCases = cases.filter(
    (item) =>
      String(item.status || "").toUpperCase() ===
      "COMPLETED"
  ).length;

  // ============================================================
  // OPEN CASE
  // ============================================================


  function handleOpenCase(caseData) {
  const caseId = caseData?.id;

  console.log("OPEN CASE DATA:", caseData);
  console.log("OPEN CASE ID:", caseId);
  console.log("OPEN CASE ID TYPE:", typeof caseId);

  if (
    caseId === null ||
    caseId === undefined ||
    typeof caseId === "object" ||
    typeof caseId === "function"
  ) {
    console.error("Invalid case ID:", caseId);
    return;
  }

  navigate(`/dashboard/cases/${String(caseId)}`);
}

  // ============================================================
  // CREATE CASE
  // ============================================================

  async function handleCreateCase(data) {
    try {
      setIsCreating(true);

      const response = await createCase(data);

      const createdCase = response?.data;

      setIsModalOpen(false);

      await Swal.fire({
        icon: "success",
        title: "Case Created",
        text: createdCase?.case_number
          ? `${createdCase.case_number} has been created successfully.`
          : "The case has been created successfully.",
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#34d399",
        confirmButtonColor: "#059669",
        confirmButtonText: "Continue",
      });

      await loadCases();

      if (createdCase?.id) {
        navigate(
          `/dashboard/cases/${createdCase.id}`
        );
      }
    } catch (requestError) {
      console.error(
        "Failed to create case:",
        requestError
      );

      const message =
        requestError?.response?.data?.detail ||
        requestError?.message ||
        "Unable to create the case.";

      await Swal.fire({
        icon: "error",
        title: "Case Creation Failed",
        text: message,
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#f87171",
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Try Again",
      });
    } finally {
      setIsCreating(false);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

      {/* ======================================================
          BACKGROUND GRID
      ======================================================= */}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.20]"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(52, 211, 153, 0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(52, 211, 153, 0.035) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "64px 64px",
        }}
      />

      {/* ======================================================
          BACKGROUND GLOW
      ======================================================= */}

      <div
        className="
          pointer-events-none
          absolute
          -top-48
          left-1/3
          h-[500px]
          w-[500px]
          rounded-full
          bg-emerald-400/[0.025]
          blur-3xl
        "
      />

      {/* ======================================================
          PAGE
      ======================================================= */}

      <div className="relative z-10 flex min-h-screen flex-col">

        {/* ====================================================
            NAVBAR
        ===================================================== */}

        <BASNavbar />

        {/* ====================================================
            MAIN
        ===================================================== */}

        <main className="flex-1">

          <div
            className="
              mx-auto
              max-w-[1700px]
              px-5
              py-12
              sm:px-8
              lg:px-10
            "
          >

            {/* ==================================================
                HEADER
            =================================================== */}

            <div
              className="
                flex
                flex-col
                gap-7
                lg:flex-row
                lg:items-center
                lg:justify-between
              "
            >

              {/* LEFT */}

              <div>

                <div className="flex items-center gap-3">

                  <span
                    className="
                      h-2
                      w-2
                      rounded-full
                      bg-emerald-400
                      shadow-[0_0_12px_rgba(52,211,153,0.8)]
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-[0.22em]
                      text-emerald-400
                    "
                  >
                    BANK ANALYTICAL SYSTEM
                  </span>

                </div>

                <h1
                  className="
                    mt-5
                    text-4xl
                    font-semibold
                    tracking-tight
                    text-white
                    md:text-5xl
                  "
                >
                  Case Management
                </h1>

                <p
                  className="
                    mt-3
                    max-w-2xl
                    text-sm
                    leading-6
                    text-slate-400
                    md:text-base
                  "
                >
                  Create and manage financial investigation
                  cases.
                </p>

              </div>

              {/* CREATE BUTTON */}

              {canCreateCase ? (
                <button
                  type="button"
                  onClick={() =>
                    setIsModalOpen(true)
                  }
                  className="
                    inline-flex
                    w-fit
                    items-center
                    justify-center
                    gap-3
                    rounded-xl
                    bg-emerald-400
                    px-6
                    py-3.5
                    text-sm
                    font-semibold
                    text-[#03100d]
                    shadow-[0_10px_30px_rgba(52,211,153,0.08)]
                    transition-all
                    duration-200
                    hover:bg-emerald-300
                    hover:shadow-[0_12px_35px_rgba(52,211,153,0.14)]
                    active:scale-[0.98]
                    lg:px-7
                  "
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
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

                  CREATE NEW CASE
                </button>
              ) : (
                <div
                  className="
                    inline-flex
                    w-fit
                    items-center
                    justify-center
                    gap-2.5
                    rounded-xl
                    border
                    border-white/10
                    bg-slate-800/80
                    px-5
                    py-3.5
                    text-xs
                    font-semibold
                    text-slate-400
                    cursor-not-allowed
                  "
                  title="Case creation is restricted by your organization administrator."
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>CASE CREATION LOCKED</span>
                </div>
              )}


            </div>

            {/* ==================================================
                CASE OVERVIEW
            =================================================== */}

            <section className="mt-10">

              {/* Section title */}

              <div className="mb-5 flex items-center gap-3">

                <span
                  className="
                    h-7
                    w-1
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_12px_rgba(52,211,153,0.45)]
                  "
                />

                <h2
                  className="
                    text-sm
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-slate-300
                  "
                >
                  Case Overview
                </h2>

              </div>

              {/* Stats */}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                {/* TOTAL */}

                <div
                  className="
                    rounded-[22px]
                    border
                    border-white/[0.07]
                    bg-[#061411]/80
                    px-7
                    py-6
                    backdrop-blur-sm
                  "
                >

                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.16em]
                      text-slate-500
                    "
                  >
                    Total Cases
                  </p>

                  <p
                    className="
                      mt-5
                      text-4xl
                      font-semibold
                      tracking-tight
                      text-white
                    "
                  >
                    {totalCases}
                  </p>

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-600
                    "
                  >
                    Total banking cases
                  </p>

                </div>

                {/* DRAFT */}

                <div
                  className="
                    rounded-[22px]
                    border
                    border-white/[0.07]
                    bg-[#061411]/80
                    px-7
                    py-6
                    backdrop-blur-sm
                  "
                >

                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.16em]
                      text-slate-500
                    "
                  >
                    Draft
                  </p>

                  <p
                    className="
                      mt-5
                      text-4xl
                      font-semibold
                      tracking-tight
                      text-white
                    "
                  >
                    {draftCases}
                  </p>

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-600
                    "
                  >
                    Cases being prepared
                  </p>

                </div>

                {/* IN PROGRESS */}

                <div
                  className="
                    rounded-[22px]
                    border
                    border-white/[0.07]
                    bg-[#061411]/80
                    px-7
                    py-6
                    backdrop-blur-sm
                  "
                >

                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.16em]
                      text-slate-500
                    "
                  >
                    In Progress
                  </p>

                  <p
                    className="
                      mt-5
                      text-4xl
                      font-semibold
                      tracking-tight
                      text-cyan-300
                    "
                  >
                    {inProgressCases}
                  </p>

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-600
                    "
                  >
                    Active investigations
                  </p>

                </div>

                {/* COMPLETED */}

                <div
                  className="
                    rounded-[22px]
                    border
                    border-white/[0.07]
                    bg-[#061411]/80
                    px-7
                    py-6
                    backdrop-blur-sm
                  "
                >

                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.16em]
                      text-slate-500
                    "
                  >
                    Completed
                  </p>

                  <p
                    className="
                      mt-5
                      text-4xl
                      font-semibold
                      tracking-tight
                      text-emerald-300
                    "
                  >
                    {completedCases}
                  </p>

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-600
                    "
                  >
                    Completed investigations
                  </p>

                </div>

              </div>

            </section>

            {/* ==================================================
                CASE MANAGEMENT
            =================================================== */}

            <section className="mt-10">

              {/* SECTION HEADER */}

              <div
                className="
                  flex
                  flex-col
                  gap-4
                  sm:flex-row
                  sm:items-end
                  sm:justify-between
                "
              >

                <div>

                  <div className="flex items-center gap-3">

                    <span
                      className="
                        h-7
                        w-1
                        rounded-full
                        bg-emerald-400
                        shadow-[0_0_12px_rgba(52,211,153,0.45)]
                      "
                    />

                    <div>

                      <p
                        className="
                          text-xs
                          font-semibold
                          uppercase
                          tracking-[0.18em]
                          text-emerald-400
                        "
                      >
                        Case Management
                      </p>

                      <h2
                        className="
                          mt-1
                          text-xl
                          font-semibold
                          text-white
                        "
                      >
                        Investigation Cases
                      </h2>

                    </div>

                  </div>

                </div>

                <p
                  className="
                    text-xs
                    text-slate-600
                  "
                >
                  {filteredCases.length}{" "}
                  {filteredCases.length === 1
                    ? "case"
                    : "cases"}
                </p>

              </div>

              {/* =================================================
                  TOOLBAR
              ================================================== */}

              <div
                className="
                  mt-5
                  flex
                  flex-col
                  gap-3
                  rounded-[22px]
                  border
                  border-white/[0.07]
                  bg-[#061411]/60
                  p-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >

                {/* SEARCH */}

                <div className="relative w-full sm:max-w-md">

                  <div
                    className="
                      pointer-events-none
                      absolute
                      left-3.5
                      top-1/2
                      -translate-y-1/2
                      text-slate-600
                    "
                  >

                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                      />

                      <path d="m20 20-4-4" />
                    </svg>

                  </div>

                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(
                        event.target.value
                      )
                    }
                    placeholder="Search cases..."
                    className="
                      w-full
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-[#020b09]
                      py-3
                      pl-10
                      pr-4
                      text-xs
                      text-white
                      outline-none
                      placeholder:text-slate-600
                      focus:border-emerald-400/25
                      focus:ring-4
                      focus:ring-emerald-400/[0.04]
                    "
                  />

                </div>

                {/* ACTIONS */}

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={loadCases}
                    disabled={isLoading}
                    className="
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-white/[0.02]
                      px-4
                      py-2.5
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.12em]
                      text-slate-500
                      transition
                      hover:border-emerald-400/20
                      hover:text-emerald-300
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    Refresh
                  </button>

                  <div
                    className="
                      flex
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-[#020b09]
                      p-1
                    "
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setViewMode("table")
                      }
                      className={`
                        rounded-lg
                        px-3
                        py-2
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.12em]
                        transition
                        ${
                          viewMode === "table"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "text-slate-600 hover:text-slate-300"
                        }
                      `}
                    >
                      Table
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setViewMode("card")
                      }
                      className={`
                        rounded-lg
                        px-3
                        py-2
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.12em]
                        transition
                        ${
                          viewMode === "card"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "text-slate-600 hover:text-slate-300"
                        }
                      `}
                    >
                      Cards
                    </button>

                  </div>

                </div>

              </div>

              {/* =================================================
                  ERROR
              ================================================== */}

              {error && (
                <div
                  className="
                    mt-4
                    rounded-xl
                    border
                    border-red-400/20
                    bg-red-400/[0.04]
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >

                    <div>

                      <p className="text-xs font-semibold text-red-300">
                        Unable to load cases
                      </p>

                      <p className="mt-1 text-[10px] text-red-300/60">
                        {error}
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={loadCases}
                      className="
                        rounded-lg
                        border
                        border-red-400/20
                        px-3
                        py-2
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-wider
                        text-red-300
                        transition
                        hover:bg-red-400/[0.05]
                      "
                    >
                      Retry
                    </button>

                  </div>

                </div>
              )}

              {/* =================================================
                  CONTENT
              ================================================== */}

              <div className="mt-4">

                {isLoading ? (

                  <div
                    className="
                      rounded-[22px]
                      border
                      border-white/[0.07]
                      bg-[#061411]/70
                      p-12
                      text-center
                    "
                  >

                    <div
                      className="
                        mx-auto
                        h-8
                        w-8
                        animate-spin
                        rounded-full
                        border-2
                        border-emerald-400/20
                        border-t-emerald-400
                      "
                    />

                    <p className="mt-4 text-xs text-slate-500">
                      Loading cases...
                    </p>

                  </div>

                ) : filteredCases.length === 0 ? (

                  <div
                    className="
                      rounded-[22px]
                      border
                      border-white/[0.07]
                      bg-[#061411]/70
                      px-6
                      py-14
                      text-center
                    "
                  >

                    <div
                      className="
                        mx-auto
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-emerald-400/15
                        bg-emerald-400/[0.04]
                      "
                    >

                      <svg
                        className="h-5 w-5 text-emerald-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M6 3h9l4 4v14H6z" />

                        <path d="M14 3v5h5" />
                      </svg>

                    </div>

                    <p className="mt-5 text-sm font-medium text-slate-300">
                      {searchTerm
                        ? "No matching cases"
                        : "No cases available"}
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      {searchTerm
                        ? "Try another search term."
                        : "Create your first investigation case."}
                    </p>

                    {!searchTerm && (
                      <button
                        type="button"
                        onClick={() =>
                          setIsModalOpen(true)
                        }
                        className="
                          mt-5
                          rounded-xl
                          bg-emerald-400
                          px-4
                          py-2.5
                          text-xs
                          font-semibold
                          text-slate-950
                          transition
                          hover:bg-emerald-300
                        "
                      >
                        Create First Case
                      </button>
                    )}

                  </div>

                ) : viewMode === "table" ? (

                  <CaseTable
                    cases={filteredCases}
                    onOpen={handleOpenCase}
                  />

                ) : (

                  <div
                    className="
                      grid
                      gap-4
                      md:grid-cols-2
                      xl:grid-cols-3
                    "
                  >

                    {filteredCases.map(
                      (caseData) => (
                        <CaseCard
                          key={caseData.id}
                          caseData={caseData}
                          onOpen={handleOpenCase}
                        />
                      )
                    )}

                  </div>

                )}

              </div>

            </section>

          </div>

        </main>

        {/* ====================================================
            FOOTER
        ===================================================== */}

        <BASFooter />

      </div>

      {/* ======================================================
          CREATE CASE MODAL
      ======================================================= */}

      <CreateCaseModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isCreating) {
            setIsModalOpen(false);
          }
        }}
        onSubmit={handleCreateCase}
        isSubmitting={isCreating}
      />

    </div>
  );
}

export default CaseList;