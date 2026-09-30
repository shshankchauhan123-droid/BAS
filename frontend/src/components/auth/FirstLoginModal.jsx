import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { changeFirstLoginPassword, dismissFirstLogin } from "../../services/api/auth";

export default function FirstLoginModal() {
  const { user, updateUser } = useAuth();

  const [mode, setMode] = useState("ask"); // "ask" | "change"
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Only display if user is logged in and first_login flag is true
  if (!user || !user.first_login) {
    return null;
  }

  const handleSkip = async () => {
    setIsLoading(true);
    setError("");
    try {
      await dismissFirstLogin();
      updateUser({ first_login: false });
    } catch (err) {
      console.error("Failed to dismiss first login:", err);
      // Even if API fails, allow them to proceed or show warning
      updateUser({ first_login: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePassword = async (e) => {
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

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await changeFirstLoginPassword(newPassword);
      setSuccessMsg("Password updated successfully! Welcome to your workspace.");
      setTimeout(() => {
        updateUser({ first_login: false });
      }, 1200);
    } catch (err) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-400/20 bg-[#071311] p-6 sm:p-8 shadow-2xl text-white">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-cyan-500/10 blur-2xl" />

        {/* Header Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div className="text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
            First-Time Login
          </span>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
            Security & Password Setup
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Hello <span className="font-semibold text-emerald-300">{user.username}</span>, you are logging in with an initial password assigned by your administrator. Would you like to set your own password now?
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300 font-medium">
            {successMsg}
          </div>
        )}

        {mode === "ask" ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setMode("change")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Yes, Change My Password
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleSkip}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              {isLoading ? "Please wait..." : "Keep Current Password"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSavePassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-emerald-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setMode("ask")}
                className="w-1/3 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.05]"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="w-2/3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
