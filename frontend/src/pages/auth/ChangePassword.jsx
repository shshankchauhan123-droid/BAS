import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { changeFirstLoginPassword, dismissFirstLogin } from "../../services/api/auth";

/**
 * ARTHBODH — Banking Analytical System (BAS)
 * Dedicated Post-Login / Account Security Change Password Component
 *
 * Visual Theme:
 * - Light slate canvas (#F5F8FC) matching UserDashboard & BAS branding
 * - Deep navy (#172554 / #172033) headings and high-contrast text
 * - ArthBodh signature emerald (#059669) primary actions & accents
 * - Clean elevated white cards (#ffffff) with subtle border (#E2E8F0)
 * - Soft ambient gradients, decorative background glow, and lightweight CSS animations
 * - Responsive layout for desktop, laptop, tablet, and mobile
 */

export function getDashboardPath(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "superadmin" || normalizedRole === "admin") {
    return "/superadmin";
  }
  if (normalizedRole === "client_admin") {
    return "/client-admin";
  }
  return "/dashboard";
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Determine user dashboard path
  const targetDashboard = useMemo(() => getDashboardPath(user?.role), [user?.role]);

  // Password criteria calculations
  const criteria = useMemo(() => {
    const hasMinLength = newPassword.length >= 6;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (hasUpper && hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    let label = "Weak";
    let color = "bg-rose-500";
    let textColor = "text-rose-600";
    let barWidth = "25%";

    if (newPassword.length === 0) {
      label = "None";
      color = "bg-slate-200";
      textColor = "text-slate-400";
      barWidth = "0%";
    } else if (score <= 1) {
      label = "Weak";
      color = "bg-rose-500";
      textColor = "text-rose-600";
      barWidth = "25%";
    } else if (score === 2) {
      label = "Fair";
      color = "bg-amber-500";
      textColor = "text-amber-600";
      barWidth = "50%";
    } else if (score === 3 || score === 4) {
      label = "Good";
      color = "bg-emerald-500";
      textColor = "text-emerald-600";
      barWidth = "75%";
    } else {
      label = "Strong";
      color = "bg-emerald-600";
      textColor = "text-emerald-700";
      barWidth = "100%";
    }

    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      score,
      label,
      color,
      textColor,
      barWidth,
    };
  }, [newPassword]);

  // Passwords match validation
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return newPassword === confirmPassword;
  }, [newPassword, confirmPassword]);

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword.length > 128) {
      setError("Password cannot exceed 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await changeFirstLoginPassword(newPassword);
      updateUser({ first_login: false });
      setSuccess(true);

      // Smooth auto-redirect to user dashboard
      setTimeout(() => {
        navigate(targetDashboard, { replace: true });
      }, 1600);
    } catch (err) {
      console.error("Failed to update password:", err);
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to update password. Please check your credentials and try again.";
      setError(typeof message === "string" ? message : "Unable to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip / Dismiss handler
  const handleSkip = async () => {
    setError("");
    setIsDismissing(true);

    try {
      if (user?.first_login) {
        await dismissFirstLogin();
        updateUser({ first_login: false });
      }
      navigate(targetDashboard, { replace: true });
    } catch (err) {
      console.error("Failed to dismiss first login:", err);
      // Still allow navigation to dashboard
      updateUser({ first_login: false });
      navigate(targetDashboard, { replace: true });
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="arthbodh-change-password-page min-h-screen bg-[#F5F8FC] text-[#172033] flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900 relative">
      {/* SCOPED STYLES & ENTRANCE ANIMATIONS */}
      <style>{`
        @keyframes arthbodhFadeInUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .arthbodh-card-entrance {
          animation: arthbodhFadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .arthbodh-card-entrance {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* AMBIENT BACKGROUND GLOW & SUBTLE GRID PATTERN */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="absolute -right-32 top-20 h-[440px] w-[440px] rounded-full bg-blue-200/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(226, 232, 240, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* =========================================================
          TOP NAVBAR WITH ARTHBODH BRANDING
      ========================================================== */}
      <header className="relative z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* ARTHBODH BRAND LOGO */}
          <div className="flex items-center gap-3">
            <img
              src="/bas_logo.png"
              alt="ArthBodh BAS Logo"
              className="h-9 w-9 rounded-lg object-contain shadow-2xs"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="flex flex-col items-start leading-none select-none">
              <div className="flex items-baseline tracking-tight">
                <span className="text-xl font-black text-emerald-700 sm:text-2xl">
                  अर्थ
                </span>
                <span className="ml-0.5 text-xl font-extrabold text-[#172554] sm:text-2xl">
                  BODH
                </span>
              </div>
              <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-slate-500">
                BANKING ANALYTICAL SYSTEM
              </span>
            </div>
          </div>

          {/* STATUS / USER BADGE */}
          <div className="flex items-center gap-3">
            {user?.username && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{user.username}</span>
                <span className="text-slate-400">•</span>
                <span className="text-[11px] uppercase tracking-wider font-medium text-emerald-700">
                  {user.role}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
              <span>256-Bit SSL Secured</span>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN CENTERED CONTENT AREA
      ========================================================== */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md arthbodh-card-entrance">
          {/* HEADER SECTION ABOVE CARD */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 shadow-2xs">
              <svg
                className="w-3.5 h-3.5 text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>ACCOUNT SECURITY</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#172554]">
              Secure Your Account
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Keep your account protected with a strong, unique password.
            </p>
          </div>

          {/* MAIN CARD */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50">
            {success ? (
              /* SUCCESS STATE */
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-500/20">
                  <svg
                    className="h-8 w-8 text-emerald-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#172554]">
                  Password Updated Successfully
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Your new password has been safely encrypted and saved. Entering your analytical workspace...
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => navigate(targetDashboard, { replace: true })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 transition-all duration-200"
                  >
                    <span>Enter Dashboard</span>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              /* FORM STATE */
              <div>
                {/* CARD ICON & TITLE */}
                <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs">
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#172554]">
                      Change Password
                    </h2>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Create a personalized password for user <strong className="text-slate-700">{user?.username}</strong>
                    </p>
                  </div>
                </div>

                {/* ERROR ALERT */}
                {error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800">
                    <svg
                      className="h-4 w-4 shrink-0 text-rose-600 mt-0.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div className="flex-1 font-medium leading-relaxed">{error}</div>
                  </div>
                )}

                {/* PASSWORD FORM */}
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  {/* FIELD 1: NEW PASSWORD */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="At least 6 characters"
                        required
                        disabled={isSubmitting || isDismissing}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-[#172554] placeholder-slate-400 transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:cursor-not-allowed pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-700 transition-colors p-0.5"
                      >
                        {showNewPassword ? (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* PASSWORD STRENGTH METER */}
                    {newPassword.length > 0 && (
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-500 font-medium">Strength:</span>
                          <span className={`font-bold ${criteria.textColor}`}>
                            {criteria.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${criteria.color} transition-all duration-300 rounded-full`}
                            style={{ width: criteria.barWidth }}
                          />
                        </div>
                        {/* Requirement hints */}
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[10.5px]">
                          <span className={`flex items-center gap-1 ${criteria.hasMinLength ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                            <span>{criteria.hasMinLength ? "✓" : "•"}</span> 6+ characters
                          </span>
                          <span className={`flex items-center gap-1 ${criteria.hasUpper && criteria.hasLower ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                            <span>{criteria.hasUpper && criteria.hasLower ? "✓" : "•"}</span> Upper & lower
                          </span>
                          <span className={`flex items-center gap-1 ${criteria.hasNumber ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                            <span>{criteria.hasNumber ? "✓" : "•"}</span> Number (0-9)
                          </span>
                          <span className={`flex items-center gap-1 ${criteria.hasSpecial ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                            <span>{criteria.hasSpecial ? "✓" : "•"}</span> Special symbol
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FIELD 2: CONFIRM NEW PASSWORD */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="Re-enter your new password"
                        required
                        disabled={isSubmitting || isDismissing}
                        className={`w-full rounded-xl border bg-slate-50/50 px-3.5 py-2.5 text-sm text-[#172554] placeholder-slate-400 transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed pr-10 ${
                          passwordsMatch === false
                            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20"
                            : passwordsMatch === true
                            ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-700 transition-colors p-0.5"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Match confirmation text */}
                    {confirmPassword.length > 0 && (
                      <p
                        className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
                          passwordsMatch ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {passwordsMatch ? (
                          <>
                            <span>✓</span> Passwords match
                          </>
                        ) : (
                          <>
                            <span>✕</span> Passwords do not match
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-3 flex flex-col gap-2.5">
                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting || isDismissing || newPassword.length < 6 || passwordsMatch === false}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>Update Password</span>
                        </>
                      )}
                    </button>

                    {/* Secondary Action */}
                    <button
                      type="button"
                      disabled={isSubmitting || isDismissing}
                      onClick={handleSkip}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-all duration-150 disabled:opacity-50 cursor-pointer text-center"
                    >
                      {isDismissing
                        ? "Continuing to Dashboard..."
                        : user?.first_login
                        ? "Keep Current Password & Continue"
                        : "Return to Dashboard"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-200/80 bg-white/70 py-3 text-center text-[11px] text-slate-500">
        ARTHBODH — Banking Analytical System (BAS) • Secured Financial Investigation Environment
      </footer>
    </div>
  );
}
