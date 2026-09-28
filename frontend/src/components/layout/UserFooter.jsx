import { useNavigate } from "react-router-dom";

function BASFooter() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-white/[0.06] bg-[#040b09]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

          {/* =====================================================
              BRAND
          ====================================================== */}
          <div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05]">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-emerald-400"
                >
                  <path
                    d="M3 21V10.5L12 4L21 10.5V21"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M7 21V12H17V21"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="text-left">
                <div className="text-xs font-bold tracking-[0.18em] text-white">
                  BAS
                </div>

                <div className="text-[8px] uppercase tracking-[0.18em] text-slate-600">
                  Bank Analysis System
                </div>
              </div>
            </button>

            <p className="mt-3 max-w-md text-[10px] leading-5 text-slate-600">
              Financial intelligence, transaction analysis, and investigation
              management platform.
            </p>
          </div>

          {/* =====================================================
              FOOTER LINKS
          ====================================================== */}
          <div className="flex flex-wrap gap-x-6 gap-y-3">

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="text-[10px] uppercase tracking-[0.12em] text-slate-600 transition hover:text-emerald-400"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="text-[10px] uppercase tracking-[0.12em] text-slate-600 transition hover:text-emerald-400"
            >
              Cases
            </button>

            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="text-[10px] uppercase tracking-[0.12em] text-slate-600 transition hover:text-emerald-400"
            >
              Reports
            </button>

            <button
              type="button"
              onClick={() => navigate("/analysis")}
              className="text-[10px] uppercase tracking-[0.12em] text-slate-600 transition hover:text-emerald-400"
            >
              Analysis
            </button>

          </div>
        </div>

        {/* =====================================================
            COPYRIGHT / SYSTEM INFO
        ====================================================== */}
        <div className="mt-7 flex flex-col justify-between gap-3 border-t border-white/[0.04] pt-5 sm:flex-row">

          <div className="text-[9px] uppercase tracking-[0.14em] text-slate-700">
            BAS / FINANCIAL INTELLIGENCE PLATFORM
          </div>

          <div className="text-[9px] uppercase tracking-[0.14em] text-slate-700">
            Secure Financial Analysis Environment
          </div>

        </div>
      </div>
    </footer>
  );
}

export default BASFooter;