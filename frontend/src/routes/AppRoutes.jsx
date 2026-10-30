import FinancialTransactionIntelligenceReport from "../pages/user/reports/FinancialTransactionIntelligenceReport";
import CounterpartyIntelligenceReport from "../pages/user/reports/CounterpartyIntelligenceReport";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

/* ============================================================
   AUTH PAGES
============================================================ */

import Login from "../pages/auth/Login";
import ChangePassword from "../pages/auth/ChangePassword";

/* ============================================================
   DASHBOARDS
============================================================ */

import SuperAdminDashboard from "../pages/superadmin/SuperAdminDashboard";
import SuperAdminCaseList from "../pages/superadmin/SuperAdminCaseList";
import SuperAdminIOMasterList from "../pages/superadmin/SuperAdminIOMasterList";
import ClientAdminDashboard from "../pages/clientAdmin/ClientAdminDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";
import UserDashboard from "../pages/user/UserDashboard";

/* ============================================================
   CASE MANAGEMENT
============================================================ */

import CaseList from "../pages/user/cases/CaseList";
import CreateCase from "../pages/user/cases/CreateCase";
import CaseDetails from "../pages/user/cases/CaseDetails";
import IOMasterList from "../pages/user/io_master/IOMasterList";
import CaseReportsHub from "../pages/user/reports/CaseReportsHub";
import TransactionRelationshipReport from "../pages/user/reports/TransactionRelationshipReport";
import CaseFileReport from "../pages/user/reports/CaseFileReport";
import DynamicReportDashboard from "../pages/user/analysis/DynamicReportDashboard";
import BankStatementUpload from "../pages/user/upload/BankStatementUpload";
import NcrpStatementUpload from "../pages/user/upload/NcrpStatementUpload";
import NcrpReportsHub from "../pages/user/reports/NcrpReportsHub";
import NcrpTransactionReport from "../pages/user/reports/NcrpTransactionReport";
import NcrpMoneyFlowReport from "../pages/user/reports/NcrpMoneyFlowReport";
import NcrpHierarchicalFlowReport from "../pages/user/reports/NcrpHierarchicalFlowReport";
import GstAdvanceSearch from "../pages/user/reports/GstAdvanceSearch";
import CinAdvanceSearch from "../pages/user/reports/CinAdvanceSearch";

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

            These pages are available only when the user
            is NOT authenticated.

            If the user is already logged in and presses
            Chrome Back to reach /login or /signup,
            PublicRoute sends them back to their dashboard.
        ====================================================== */}

        <Route
          path="/signup"
          element={<Navigate to="/login" replace />}
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
            CHANGE PASSWORD (POST-LOGIN / ACCOUNT SECURITY)
            Authentication required
        ====================================================== */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
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
              <RoleRoute allowedRoles={["user", "admin"]}>
                <UserDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
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
            SUPER ADMIN CASES MANAGEMENT
        ====================================================== */}
        <Route
          path="/superadmin/cases"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["superadmin", "admin"]}>
                <SuperAdminCaseList />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            SUPER ADMIN IO MASTER MANAGEMENT
        ====================================================== */}
        <Route
          path="/superadmin/io-master"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["superadmin", "admin"]}>
                <SuperAdminIOMasterList />
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
              <RoleRoute allowedRoles={["user", "admin", "client_admin"]}>
                <CaseList />
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
            IO MASTER
        ====================================================== */}

        <Route
          path="/dashboard/io-master"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "client_admin", "superadmin"]}>
                <IOMasterList />
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
              <RoleRoute allowedRoles={["user", "admin"]}>
                <CreateCase />
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
              <RoleRoute allowedRoles={["user", "superadmin", "admin", "client_admin"]}>
                <CaseList />
              </RoleRoute>
            </ProtectedRoute>
          }
        />


        {/* =====================================================
            CASE REPORTS HUB (Catalog of reports for a case)
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "superadmin", "client_admin"]}>
                <CaseReportsHub />
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
              <RoleRoute allowedRoles={["user", "superadmin", "admin", "client_admin"]}>
                <CaseDetails />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            BANK STATEMENT UPLOAD
        ====================================================== */}
        <Route
          path="/dashboard/upload/bank-statement"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "superadmin", "admin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <BankStatementUpload />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload/bank-statement"
          element={<Navigate to="/dashboard/upload/bank-statement" replace />}
        />

        {/* =====================================================
            NCRP STATEMENT UPLOAD
        ====================================================== */}
        <Route
          path="/dashboard/upload/ncrp"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "superadmin", "admin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpStatementUpload />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload/ncrp"
          element={<Navigate to="/dashboard/upload/ncrp" replace />}
        />
     {/* =====================================================
            REPORT 1: FILE STATEMENT & TRANSACTIONS REPORT
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/transaction-relationships"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <TransactionRelationshipReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/transaction-relationships"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <TransactionRelationshipReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />


     {/* =====================================================
            REPORT 1: FILE STATEMENT & TRANSACTIONS REPORT
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/file-statement"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CaseFileReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/file-statement"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CaseFileReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/file-statement"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CaseFileReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            GENERAL REPORTS
        ====================================================== */}

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CaseReportsHub />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CaseReportsHub />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            NCRP REPORTS HUB (Catalog of NCRP reports)
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/ncrp"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpReportsHub />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/ncrp"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpReportsHub />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/ncrp"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpReportsHub />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            FACT → GST ADVANCE SEARCH
        ====================================================== */}

        <Route
          path="/reports/fact/gst"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <GstAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/fact/gst"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <GstAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/gst"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <GstAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            FACT → CIN ADVANCE SEARCH
        ====================================================== */}

        <Route
          path="/reports/fact/cin"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <CinAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/fact/cin"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <CinAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/cin"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
              >
                <CinAdvanceSearch />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            NCRP TRANSACTION REPORT
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/ncrp-transaction"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpTransactionReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/ncrp-transaction"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpTransactionReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/ncrp-transaction"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpTransactionReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            NCRP MONEY FLOW GRAPH REPORT
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/ncrp-money-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpMoneyFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/ncrp-money-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpMoneyFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/ncrp-money-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpMoneyFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            NCRP HIERARCHICAL MONEY FLOW REPORT
        ====================================================== */}

        <Route
          path="/dashboard/cases/:caseId/reports/ncrp-hierarchical-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpHierarchicalFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/ncrp-hierarchical-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpHierarchicalFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/ncrp-hierarchical-flow"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_ncrp_statement_analysis"
              >
                <NcrpHierarchicalFlowReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            DYNAMIC DATA REPORT & TIMELINE VISUALIZATION
        ====================================================== */}

        <Route
          path="/analysis"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <DynamicReportDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/analysis"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <DynamicReportDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/timeline"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <DynamicReportDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/reports/timeline"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <DynamicReportDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/cases/:caseId/reports/timeline"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <DynamicReportDashboard />
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

        <Route
          path="/dashboard/cases/:caseId/reports/counterparty-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CounterpartyIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/counterparty-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <CounterpartyIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
      
        <Route
          path="/dashboard/cases/:caseId/reports/financial-transaction-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <FinancialTransactionIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/financial-transaction-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={["user", "admin", "superadmin", "client_admin"]}
                requiredPermission="can_bank_statement_analysis"
              >
                <FinancialTransactionIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            404 NOT FOUND
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