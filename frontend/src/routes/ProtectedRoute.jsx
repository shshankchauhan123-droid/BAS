
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  /*
   * Wait until authentication state has been restored
   * from localStorage.
   *
   * Without this check, the application could briefly
   * redirect an already-authenticated user to /login
   * while React is still loading localStorage.
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
              Restoring secure session
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * User is not authenticated.
   *
   * Redirect to login and preserve the page they
   * originally attempted to access.
   */
  if (!isAuthenticated) {
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
   * Authentication is valid.
   * Render the requested protected page.
   */
  return children;
}

export default ProtectedRoute;
