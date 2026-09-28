import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

/* ============================================================
   AUTH PAGES
============================================================ */

import Signup from "../pages/auth/Signup";
import Login from "../pages/auth/Login";

/* ============================================================
   DASHBOARDS
============================================================ */

import AdminDashboard from "../pages/admin/AdminDashboard";
import UserDashboard from "../pages/user/UserDashboard";

/* ============================================================
   CASE MANAGEMENT
============================================================ */

import CaseList from "../pages/user/cases/CaseList";
import CreateCase from "../pages/user/cases/CreateCase";
import CaseDetails from "../pages/user/cases/CaseDetails";

/* ============================================================
   ROUTE GUARDS
============================================================ */

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import PublicRoute from "./PublicRoute";

/* ============================================================
   404 PAGE
============================================================ */

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="text-center">

        <h1 className="text-6xl font-bold">
          404
        </h1>

        <p className="mt-3 text-slate-400">
          Page not found.
        </p>

      </div>
    </div>
  );
}

/* ============================================================
   APPLICATION ROUTES
============================================================ */

function AppRoutes() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =====================================================
            PUBLIC AUTH ROUTES

            These pages are available only when the user
            is NOT authenticated.

            If the user is already logged in and presses
            Chrome Back to reach /login or /signup,
            PublicRoute sends them back to their dashboard.
        ====================================================== */}

        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* =====================================================
            USER DASHBOARD

            Authentication required
            User role required
        ====================================================== */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user"]}>
                <UserDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            USER CASE MANAGEMENT

            Authentication required
            User role required
        ====================================================== */}

        <Route
          path="/dashboard/cases"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user"]}>
                <CaseList />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            CREATE CASE

            Authentication required
            User role required
        ====================================================== */}

        <Route
          path="/dashboard/cases/create"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user"]}>
                <CreateCase />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            CASE DETAILS

            Dynamic case ID.

            Examples:

            /dashboard/cases/1
            /dashboard/cases/2
            /dashboard/cases/15
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user"]}>
                <CaseDetails />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            ADMIN DASHBOARD

            Authentication required
            Admin role required
        ====================================================== */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            DEFAULT ROUTE
        ====================================================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        {/* =====================================================
            404
        ====================================================== */}

        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default AppRoutes;