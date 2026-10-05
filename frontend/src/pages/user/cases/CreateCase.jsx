import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import CreateCaseModal from "../../../components/cases/CreateCaseModal";
import { createCase } from "../../../services/api/case";

import BASNavbar from "../../../components/layout/UserNavbar";
import BASFooter from "../../../components/layout/UserFooter";
import { useAuth } from "../../../context/AuthContext";

function CreateCase() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const canCreateCase = isSuperAdmin || isClientAdmin || user?.permissions?.can_create_case !== false;

  const [isCreating, setIsCreating] = useState(false);

  // ------------------------------------------------------------
  // Create case
  // ------------------------------------------------------------

  async function handleCreateCase(data) {
    try {
      setIsCreating(true);

      const response = await createCase(data);

      const createdCase = response?.data;

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
        confirmButtonText: "Open Case",
      });

      if (createdCase?.id) {
        navigate(
          `/dashboard/cases/${createdCase.id}`,
          {
            replace: true,
          }
        );
      } else {
        navigate("/dashboard/cases", {
          replace: true,
        });
      }
    } catch (error) {
      console.error(
        "Failed to create case:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        error?.message ||
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

      throw error;
    } finally {
      setIsCreating(false);
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b09] text-white">

      {/* =====================================================
          BACKGROUND GRID
      ====================================================== */}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
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

      {/* =====================================================
          BACKGROUND GLOWS
      ====================================================== */}

      <div className="pointer-events-none absolute -top-48 left-1/3 h-[550px] w-[550px] rounded-full bg-emerald-400/[0.025] blur-3xl" />

      <div className="pointer-events-none absolute right-[-180px] top-[500px] h-[450px] w-[450px] rounded-full bg-emerald-400/[0.018] blur-3xl" />

      {/* =====================================================
          PAGE CONTENT
      ====================================================== */}

      <div className="relative z-10 flex min-h-screen flex-col">

        {/* ===================================================
            NAVBAR
        ==================================================== */}

        <BASNavbar />

        {/* ===================================================
            MAIN
        ==================================================== */}

        <main className="flex-1">

          <div className="mx-auto max-w-[1700px] px-5 py-10 sm:px-8 lg:px-10">

            {/* =================================================
                PAGE HEADER
            ================================================== */}

            <div className="mb-8">

              <button
                type="button"
                onClick={() =>
                  navigate("/dashboard/cases")
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-white/[0.02]
                  px-4
                  py-2.5
                  text-xs
                  font-semibold
                  text-slate-400
                  transition-all
                  duration-200
                  hover:border-emerald-400/20
                  hover:bg-emerald-400/[0.04]
                  hover:text-emerald-300
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
                    d="M19 12H5"
                    strokeLinecap="round"
                  />

                  <path
                    d="m12 19-7-7 7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                Back to Cases

              </button>

              {/* Header */}

              <div className="mt-7 flex items-center gap-3">

                <span
                  className="
                    h-2
                    w-2
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_12px_rgba(52,211,153,0.8)]
                  "
                />

                <span className="text-xs font-semibold tracking-[0.22em] text-emerald-400">
                  BANK ANALYTICAL SYSTEM
                </span>

              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Create New Case
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Create an investigation case to organize documents,
                transactions, analysis, and reports.
              </p>

            </div>

            {/* =================================================
                CREATE CASE AREA
            ================================================== */}

            <div
              className="
                rounded-[22px]
                border
                border-white/[0.08]
                bg-[#061411]/80
                p-1
                shadow-[0_20px_60px_rgba(0,0,0,0.12)]
                backdrop-blur-sm
              "
            >

              {!canCreateCase ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Access Denied</h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                    You do not have permission to create investigation cases. Please contact your administrator.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/cases")}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-5 py-2.5 text-xs font-semibold text-white transition"
                  >
                    Back to Cases
                  </button>
                </div>
              ) : (
                <CreateCaseModal
                  isOpen={true}
                  onClose={() =>
                    navigate("/dashboard/cases")
                  }
                  onSubmit={handleCreateCase}
                  isSubmitting={isCreating}
                  isClientAdmin={isClientAdmin}
                />
              )}

            </div>

          </div>

        </main>

        {/* ===================================================
            FOOTER
        ==================================================== */}

        <BASFooter />

      </div>

    </div>
  );
}

export default CreateCase;