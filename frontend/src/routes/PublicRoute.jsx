import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function PublicRoute({ children }) {
  const {
    isAuthenticated,
    isInitializing,
    user,
  } = useAuth();

  const location = useLocation();

  /*
   * Wait until AuthContext has restored the
   * authentication state from localStorage.
   *
   * This is important because otherwise the application
   * could briefly show Login before localStorage is read.
   */
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020b09] text-white">
        <div className="flex flex-col items-center gap-4">

          <div className="relative flex h-14 w-14 items-center justify-center">

            <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400/20" />

            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-300" />

            <div className="absolute h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.9)]" />

          </div>

          <div className="text-center">

            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              BAS
            </p>

            <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Restoring secure session
            </p>

          </div>

        </div>
      </div>
    );
  }

  /*
   * User is NOT authenticated.
   *
   * Login and Signup pages are allowed.
   */
  if (!isAuthenticated) {
    return children;
  }

  /*
   * User is already authenticated.
   *
   * Therefore Login and Signup pages must not be
   * displayed again.
   *
   * Send the user to the correct dashboard based
   * on their role.
   */

  const userRole = String(
    user?.role || ""
  )
    .trim()
    .toLowerCase();

  if (userRole === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  if (userRole === "user") {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  /*
   * This is only a safety fallback.
   *
   * In your current AuthContext, authenticated users
   * are expected to have a valid role.
   *
   * If the role is missing/invalid, allow the auth page
   * to render rather than creating an infinite redirect.
   */
  return children;
}

export default PublicRoute;