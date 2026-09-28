
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RoleRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  /*
   * Wait until AuthContext has restored the session
   * from localStorage.
   */
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400/20" />

            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />

            <div className="absolute h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(103,232,249,0.9)]" />
          </div>

          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              AntiDrone
            </p>

            <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Verifying access level
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Not authenticated.
   *
   * Redirect to login.
   */
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  /*
   * Normalize the user's role.
   */
  const userRole = String(user.role || "").toLowerCase();

  /*
   * Normalize allowed roles so that role comparison
   * remains case-insensitive.
   */
  const normalizedAllowedRoles = allowedRoles.map((role) =>
    String(role).toLowerCase()
  );

  /*
   * User is authenticated but doesn't have permission
   * to access this route.
   */
  if (!normalizedAllowedRoles.includes(userRole)) {
    /*
     * Send the user to their correct dashboard rather
     * than exposing the unauthorized page.
     */
    if (userRole === "admin") {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    if (userRole === "user") {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );
    }

    /*
     * Unknown role.
     *
     * Clear access by sending the user to login.
     */
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * Authenticated user has an allowed role.
   */
  return children;
}

export default RoleRoute;
