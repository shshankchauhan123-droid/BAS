import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dismissFirstLogin } from "../../services/api/auth";

/**
 * ARTHBODH — Banking Analytical System (BAS)
 * Post-Login First-Time Password Change Prompt
 *
 * Theme & Behavior:
 * - Visually consistent with BAS dashboard (white card, emerald accents, navy headings, slate-900 backdrop blur)
 * - Displayed ONLY when authenticated user has `first_login: true`
 * - Selecting "Yes, Change Password": navigates to /change-password while preserving auth session
 * - Selecting "No, Continue": calls backend dismiss API, marks first_login: false, and stays on dashboard
 * - Suppressed when already on /change-password
 */
export default function FirstLoginModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Only display if user is logged in, first_login flag is true, and not already on /change-password
  if (!user || !user.first_login || location.pathname === "/change-password") {
    return null;
  }

  const handleYes = () => {
    navigate("/change-password");
  };

  const handleSkip = async () => {
    setIsLoading(true);
    setError("");
    try {
      await dismissFirstLogin();
      updateUser({ first_login: false });
    } catch (err) {
      console.error("Failed to dismiss first login:", err);
      // If dismiss API fails, still update local state to avoid blocking user
      updateUser({ first_login: false });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-6"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle Decorative Ambient Background Glow */}
        <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-emerald-100/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-blue-100/60 blur-2xl" />

        {/* Header Icon */}
        <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-500/10">
          <svg
            className="h-7 w-7 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <rect x="9" y="11" width="6" height="4" rx="1" fill="currentColor" fillOpacity="0.2" />
          </svg>
        </div>

        {/* Prompt Content */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ACCOUNT SECURITY
          </span>
          <h2
            id="security-prompt-title"
            className="mt-2 text-xl font-bold tracking-tight text-[#172554]"
          >
            Would you like to change your password?
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Welcome to ArthBodh, <strong className="font-semibold text-slate-800">{user.username}</strong>! You are currently logging in with an initial password assigned by your administrator. For enhanced account security, we recommend setting a strong, unique password.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          {/* Primary Action: Yes, Change Password */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleYes}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Yes, Change Password</span>
          </button>

          {/* Secondary Action: No, Continue */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleSkip}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-all duration-150 disabled:opacity-50 cursor-pointer text-center"
          >
            {isLoading ? "Continuing..." : "No, Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
