import { useNavigate } from "react-router-dom";

/**
 * ARTHBODH — Banking Analytical System
 * Universal Application Footer Component
 *
 * Features:
 * - Text-based ARTHBODH branding (अर्थ in emerald green, BODH in deep navy)
 * - Subtitle: BANKING ANALYTICAL SYSTEM
 * - Preserved platform description and responsive layout
 * - Preserved working navigation links (Dashboard, Cases, IO Master, Reports, Analysis)
 * - Dynamic copyright year with ARTHBODH branding
 * - Secure Financial Analysis Environment badge with emerald shield icon
 * - Clean white background, slate borders, and zero horizontal overflow
 */
function UserFooter() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Cases", path: "/dashboard/cases" },
    { label: "IO Master", path: "/dashboard/io-master" },
    { label: "Reports", path: "/reports" },
    { label: "Analysis", path: "/analysis" },
  ];

  const footerLinkClass =
    "rounded-sm text-xs font-semibold text-slate-600 transition-colors duration-200 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        {/* BRAND AND NAVIGATION */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          {/* BRAND */}
          <div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="group flex flex-col items-start justify-center text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-lg"
              aria-label="Go to ARTHBODH Dashboard"
            >
              <div className="flex items-baseline leading-none tracking-tight select-none">
                <span className="text-2xl font-black text-emerald-700 transition-colors group-hover:text-emerald-800">
                  अर्थ
                </span>
                <span className="ml-0.5 text-2xl font-extrabold text-blue-950 transition-colors group-hover:text-emerald-700">
                  BODH
                </span>
              </div>

              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                BANKING ANALYTICAL SYSTEM
              </div>
            </button>

            <p className="mt-2.5 max-w-md text-xs leading-relaxed text-slate-500">
              Financial intelligence, transaction analysis, and
              investigation management platform.
            </p>
          </div>

          {/* FOOTER NAVIGATION */}
          <nav
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
            aria-label="Footer navigation"
          >
            {footerLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className={footerLinkClass}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        {/* COPYRIGHT AND SECURITY INFORMATION */}
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
          {/* ARTHBODH COPYRIGHT */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-slate-700">
              © {currentYear} ARTHBODH. All rights reserved.
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Banking Analytical System / Financial Intelligence Platform
            </p>
          </div>

          {/* SECURITY INFORMATION */}
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 text-emerald-600"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 3L20 6V11C20 16.2 16.6 19.7 12 21C7.4 19.7 4 16.2 4 11V6L12 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <span>Secure Financial Analysis Environment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { UserFooter as BASFooter };
export default UserFooter;