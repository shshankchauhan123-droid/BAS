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

import SuperAdminDashboard from "../pages/superadmin/SuperAdminDashboard";
import ClientAdminDashboard from "../pages/clientAdmin/ClientAdminDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";
import UserDashboard from "../pages/user/UserDashboard";

/* ============================================================
   CASE MANAGEMENT
============================================================ */

import CaseList from "../pages/user/cases/CaseList";
import CreateCase from "../pages/user/cases/CreateCase";
import CaseDetails from "../pages/user/cases/CaseDetails";

/* ============================================================
   ROUTE GUARDS & GLOBAL MODALS
============================================================ */

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import PublicRoute from "./PublicRoute";
import FirstLoginModal from "../components/auth/FirstLoginModal";

/* ============================================================
   404 PAGE
============================================================ */

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-3 text-slate-400">Page not found.</p>
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
      {/* Global First Login Password Prompt Modal */}
      <FirstLoginModal />

      <Routes>
        {/* =====================================================
            PUBLIC AUTH ROUTES
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
            SUPERADMIN / PRODUCT OWNER DASHBOARD
        ====================================================== */}

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["superadmin", "admin"]}>
                <SuperAdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            CLIENT ADMIN (COMPANY ADMIN) DASHBOARD
        ====================================================== */}

        <Route
          path="/client-admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["client_admin"]}>
                <ClientAdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            USER (INVESTIGATOR) DASHBOARD
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
            CASE MANAGEMENT
            Accessible to User and SuperAdmin
        ====================================================== */}

        <Route
          path="/dashboard/cases"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "superadmin", "admin"]}>
                <CaseList />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

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

        <Route
          path="/dashboard/cases/:caseId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "superadmin", "admin"]}>
                <CaseDetails />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Legacy /admin redirect */}
        <Route
          path="/admin"
          element={
            <Navigate
              to="/superadmin"
              replace
            />
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