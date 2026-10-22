import Swal from "sweetalert2";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../services/api/auth";

/**
 * ARTHBODH — Banking Analytical System (BAS)
 * Authentication / Login Component
 *
 * Visual Theme:
 * - Light slate canvas (#F5F8FC) matching UserDashboard.jsx
 * - Deep navy (#172554) typography & high-contrast slate text
 * - ArthBodh signature emerald (#059669) accents & primary actions
 * - Pure white elevated cards (#ffffff) with subtle border (#E2E8F0)
 * - Soft ambient gradients, decorative background glow, and lightweight CSS animations
 * - Full accessibility with semantic labels and prefers-reduced-motion support
 * - Complete preservation of authentication, validation, session, and role redirects
 */
function Login() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
    company_code: "",
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ============================================================
     HANDLE INPUT
  ============================================================ */

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
      general: "",
    }));
  }

  /* ============================================================
     VALIDATION
  ============================================================ */

  function validateForm() {
    const newErrors = {};

    const username = formData.username.trim();

    if (!username) {
      newErrors.username = "Username is required.";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    }

    return newErrors;
  }

  /* ============================================================
     LOGIN SUBMISSION
  ============================================================ */

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      await Swal.fire({
        icon: "warning",
        title: "Check Your Credentials",
        text: "Please enter a valid username and password.",
        background: "#ffffff",
        color: "#172554",
        iconColor: "#f59e0b",
        confirmButtonText: "Review",
        confirmButtonColor: "#059669",
        buttonsStyling: true,
        customClass: {
          popup: "bas-popup",
          title: "bas-popup-title",
          confirmButton: "bas-confirm-button",
        },
      });

      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      /*
       * Create plain string values before sending the request.
       * Guarantees that JSON.stringify() receives normal strings.
       */
      const company_code = formData.company_code
        ? String(formData.company_code).trim().toUpperCase()
        : undefined;
      const username = String(formData.username).trim();
      const password = String(formData.password);

      console.log("LOGIN COMPANY CODE:", company_code);
      console.log("LOGIN USERNAME:", username);

      /*
       * Backend response expected:
       * {
       *   access_token: "...",
       *   token_type: "bearer",
       *   user: { id, username, email, role, is_active }
       * }
       */
      const authData = await loginUser({
        company_code,
        username,
        password,
      });

      console.log("LOGIN RESPONSE:", authData);

      const accessToken = authData?.access_token;
      const authenticatedUser = authData?.user;

      /*
       * Validate authentication response.
       */
      if (!accessToken || !authenticatedUser) {
        throw new Error(
          "Authentication succeeded, but the server returned an invalid login response."
        );
      }

      /*
       * Validate user role.
       */
      if (!authenticatedUser.role) {
        throw new Error(
          "Authentication succeeded, but no user role was returned."
        );
      }

      /*
       * Normalize role.
       */
      const role = String(authenticatedUser.role)
        .trim()
        .toLowerCase();

      /*
       * Determine dashboard based on user role.
       */
      let dashboardPath = null;

      if (role === "superadmin" || role === "admin") {
        dashboardPath = "/superadmin";
      } else if (role === "client_admin") {
        dashboardPath = "/client-admin";
      } else if (role === "user") {
        dashboardPath = "/dashboard";
      }

      /*
       * Unknown role should not enter the system.
       */
      if (!dashboardPath) {
        logout();

        throw new Error(
          "Your account has an unsupported role. Please contact the administrator."
        );
      }

      /*
       * AuthContext handles saving JWT token and user state.
       */
      login({
        ...authData,
        user: {
          ...authenticatedUser,
          role,
        },
      });

      console.log("AUTHENTICATED USER:", authenticatedUser);
      console.log("AUTHENTICATED ROLE:", role);

      /*
       * SUCCESS MESSAGE
       */
      await Swal.fire({
        icon: "success",
        title: "Access Granted",
        html: `
          <div style="margin-top: 8px;">
            <div style="
              color: #475569;
              font-size: 14px;
              line-height: 1.6;
            ">
              Welcome back,
              <strong style="color: #059669;">
                ${authenticatedUser.username}
              </strong>
            </div>

            <div style="
              margin-top: 14px;
              padding: 10px 14px;
              border: 1px solid #a7f3d0;
              border-radius: 12px;
              background: #ecfdf5;
              color: #065f46;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            ">
              ${role} authentication successful
            </div>

            <div style="
              margin-top: 10px;
              color: #64748b;
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            ">
              ARTHBODH — Banking Analytical System
            </div>
          </div>
        `,
        background: "#ffffff",
        color: "#172554",
        iconColor: "#059669",
        confirmButtonText:
          role === "superadmin" || role === "admin"
            ? "Enter SuperAdmin Control →"
            : role === "client_admin"
            ? "Enter Company Portal →"
            : "Enter ARTHBODH Dashboard →",
        confirmButtonColor: "#059669",
        allowOutsideClick: false,
        buttonsStyling: true,
        customClass: {
          popup: "bas-popup",
          title: "bas-popup-title",
          htmlContainer: "bas-popup-html",
          confirmButton: "bas-confirm-button",
        },
      });

      /*
       * Redirect according to role.
       */
      navigate(dashboardPath, {
        replace: true,
      });
    } catch (error) {
      console.error("Login failed:", error);

      /*
       * Clear authentication state on failure.
       */
      logout();

      const status = error?.status || error?.response?.status;
      const rawDetail = error?.response?.data?.detail;
      const code =
        error?.code ||
        (typeof rawDetail === "object" ? rawDetail?.code : null) ||
        error?.response?.data?.code ||
        null;

      const detailMsg =
        typeof rawDetail === "string"
          ? rawDetail
          : rawDetail?.message || null;

      let userTitle = "Authentication Failed";
      let userMessage =
        detailMsg ||
        error?.message ||
        "Unable to authenticate your account. Please try again.";

      const fieldErrors = {};

      if (code === "USER_NOT_FOUND") {
        userTitle = "Invalid Username";
        userMessage = "Invalid username or email. Please check your credentials.";
        fieldErrors.username = userMessage;
      } else if (code === "INVALID_PASSWORD") {
        userTitle = "Incorrect Password";
        userMessage = "Incorrect password. Please try again.";
        fieldErrors.password = userMessage;
      } else if (code === "INVALID_COMPANY_CODE") {
        userTitle = "Invalid Company Code";
        userMessage = "Invalid company code. Please check your credentials.";
      } else if (code === "COMPANY_CODE_REQUIRED") {
        userTitle = "Company Code Required";
        userMessage =
          "Multiple company accounts found with this username. Please enter your Company Code.";
      } else if (code === "ACCOUNT_INACTIVE") {
        userTitle = "Account Inactive";
        userMessage = "User account is inactive. Please contact your administrator.";
      } else if (code === "COMPANY_DEACTIVATED") {
        userTitle = "Company Inactive";
        userMessage =
          "Access denied. Your company account has been deactivated by administrator.";
      } else if (code === "SESSION_EXPIRED") {
        userTitle = "Session Expired";
        userMessage = "Session expired. Please log in again.";
      } else if (status === 400 || status === 422) {
        userTitle = "Validation Error";
        userMessage = detailMsg || "Please check your credentials and try again.";
      } else if (status === 401) {
        userTitle = "Authentication Failed";
        userMessage = detailMsg || "Invalid credentials. Please check your username and password.";
      } else if (status === 403) {
        userTitle = "Access Denied";
        userMessage = detailMsg || "You do not have permission to access this system.";
      } else if (status >= 500) {
        userTitle = "Server Error";
        userMessage = "A server error occurred. Please try again later or contact support.";
      } else if (!status && error?.message?.includes("connect to the backend server")) {
        userTitle = "Connection Error";
        userMessage = error.message;
      }

      setErrors({
        ...fieldErrors,
        general: userMessage,
      });

      /*
       * ERROR MESSAGE
       */
      await Swal.fire({
        icon: "error",
        title: userTitle,
        html: `
          <div style="
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
          ">
            ${userMessage}
          </div>

          <div style="
            margin-top: 14px;
            padding: 8px 12px;
            border: 1px solid #fecaca;
            border-radius: 10px;
            background: #fef2f2;
            color: #991b1b;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          ">
            ARTHBODH authentication request rejected
          </div>
        `,
        background: "#ffffff",
        color: "#172554",
        iconColor: "#ef4444",
        confirmButtonText: "Try Again",
        confirmButtonColor: "#dc2626",
        buttonsStyling: true,
        customClass: {
          popup: "bas-popup",
          title: "bas-popup-title",
          htmlContainer: "bas-popup-html",
          confirmButton: "bas-error-button",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* ==========================================================
          SWEETALERT & ANIMATION STYLING
      =========================================================== */}
      <style>
        {`
          @keyframes arthbodhFadeInUp {
            from {
              opacity: 0;
              transform: translateY(18px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes arthbodhFadeInLeft {
            from {
              opacity: 0;
              transform: translateX(-18px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes arthbodhPulseGlow {
            0%, 100% {
              opacity: 0.28;
              transform: scale(1);
            }
            50% {
              opacity: 0.45;
              transform: scale(1.06);
            }
          }

          .arthbodh-anim-left {
            animation: arthbodhFadeInLeft 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          .arthbodh-anim-right {
            animation: arthbodhFadeInUp 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @media (prefers-reduced-motion: reduce) {
            .arthbodh-anim-left,
            .arthbodh-anim-right,
            .arthbodh-pulse-glow {
              animation: none !important;
              transform: none !important;
            }
          }

          .bas-popup {
            border: 1px solid #E2E8F0 !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12) !important;
            background: #ffffff !important;
            color: #172554 !important;
            padding: 24px !important;
          }

          .bas-popup-title {
            color: #172554 !important;
            font-weight: 800 !important;
            letter-spacing: -0.02em !important;
          }

          .bas-popup-html {
            margin: 0 !important;
          }

          .bas-confirm-button {
            border-radius: 12px !important;
            padding: 10px 24px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            letter-spacing: 0.02em !important;
            background-color: #059669 !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25) !important;
            transition: all 180ms ease !important;
          }

          .bas-confirm-button:hover {
            background-color: #047857 !important;
          }

          .bas-error-button {
            border-radius: 12px !important;
            padding: 10px 24px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            letter-spacing: 0.02em !important;
            background-color: #dc2626 !important;
            color: #ffffff !important;
          }

          .swal2-icon {
            border-width: 2px !important;
          }
        `}
      </style>

      {/* ==========================================================
          PAGE WORKSPACE
      =========================================================== */}
      <main className="relative min-h-screen overflow-hidden bg-[#F5F8FC] text-[#172033] selection:bg-emerald-100 selection:text-emerald-900">
        {/* ========================================================
            BACKGROUND GLOWS & FINANCIAL GRID PATTERN
        ========================================================= */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Subtle Ambient Grid Pattern */}
          <div
            className="absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(226, 232, 240, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.8) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />

          {/* Gentle ambient sapphire-emerald gradient glow (top-left) */}
          <div
            className="arthbodh-pulse-glow absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-200/30 blur-3xl"
            style={{ animation: "arthbodhPulseGlow 12s ease-in-out infinite" }}
          />

          {/* Gentle ambient sapphire-blue glow (top-right) */}
          <div
            className="arthbodh-pulse-glow absolute right-[-80px] top-[15%] h-[520px] w-[520px] rounded-full bg-blue-200/25 blur-3xl"
            style={{
              animation: "arthbodhPulseGlow 14s ease-in-out infinite 2s",
            }}
          />

          {/* Bottom subtle emerald glow */}
          <div className="absolute -bottom-48 left-[20%] h-[460px] w-[460px] rounded-full bg-teal-100/35 blur-3xl" />

          {/* Decorative concentric data rings (top-right) */}
          <div className="absolute -right-32 -top-32 hidden h-[480px] w-[480px] rounded-full border border-slate-200/60 lg:block">
            <div className="absolute inset-14 rounded-full border border-slate-200/40" />
            <div className="absolute inset-28 rounded-full border border-slate-200/30" />
            <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left bg-gradient-to-r from-emerald-400/40 to-transparent animate-[spin_16s_linear_infinite]" />
          </div>

          {/* Floating animated data pulse points */}
          <span className="absolute left-[12%] top-[24%] h-2 w-2 rounded-full bg-emerald-500/70 shadow-[0_0_12px_rgba(5,150,105,0.6)] animate-pulse" />
          <span className="absolute right-[16%] top-[32%] h-1.5 w-1.5 rounded-full bg-blue-500/60 animate-pulse [animation-delay:800ms]" />
          <span className="absolute bottom-[22%] left-[16%] h-1.5 w-1.5 rounded-full bg-emerald-500/50 animate-pulse [animation-delay:1400ms]" />
        </div>

        {/* ========================================================
            TOP BAR WITH ARTHBODH BRANDING
        ========================================================= */}
        <header className="absolute left-0 right-0 top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            {/* ARTHBODH BRAND LOGO */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start leading-none select-none">
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl font-black text-emerald-700 sm:text-[26px]">
                    अर्थ
                  </span>
                  <span className="ml-0.5 text-2xl font-extrabold text-[#172554] sm:text-[26px]">
                    BODH
                  </span>
                </div>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  BANKING ANALYTICAL SYSTEM
                </span>
              </div>
            </div>

            {/* STATUS BADGE */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
              <span>Secure System</span>
            </div>
          </div>
        </header>

        {/* ========================================================
            MAIN TWO-COLUMN CONTENT
        ========================================================= */}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-12 pt-28 sm:px-6 lg:px-8">
          <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_450px] xl:gap-14">
            {/* ====================================================
                LEFT INFORMATION PANEL (DESKTOP)
            ===================================================== */}
            <section className="hidden lg:block arthbodh-anim-left">
              <div className="max-w-xl">
                {/* Eyebrow Label */}
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse shadow-sm shadow-emerald-600/50" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">
                    Secure Financial Access
                  </span>
                </div>

                {/* Main Heading */}
                <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight text-[#172554] xl:text-5xl">
                  Financial{" "}
                  <span className="block bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
                    Intelligence.
                  </span>
                </h1>

                {/* Description */}
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#64748B]">
                  Access the Bank Analysis System to investigate bank
                  statements, analyze transactions, discover financial
                  relationships, and build intelligent case insights.
                </p>

                {/* =================================================
                    FEATURE HIGHLIGHTS
                ================================================== */}
                <div className="mt-8 max-w-lg space-y-3.5">
                  {/* Transaction Intelligence */}
                  <div className="group flex items-center gap-4 rounded-xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md hover:shadow-slate-900/5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 19V5" />
                        <path d="M4 19h16" />
                        <path d="m7 15 3-4 3 2 5-7" />
                      </svg>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#172554]">
                        Transaction Intelligence
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Analyze transaction activity and financial patterns.
                      </p>
                    </div>
                  </div>

                  {/* Relationship Analysis */}
                  <div className="group flex items-center gap-4 rounded-xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md hover:shadow-slate-900/5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="5" cy="7" r="2" />
                        <circle cx="19" cy="7" r="2" />
                        <circle cx="5" cy="17" r="2" />
                        <circle cx="19" cy="17" r="2" />
                        <path d="m7 8 3 2" />
                        <path d="m17 8-3 2" />
                        <path d="m7 16 3-2" />
                        <path d="m17 16-3-2" />
                      </svg>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#172554]">
                        Relationship Analysis
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Discover connections between accounts and entities.
                      </p>
                    </div>
                  </div>

                  {/* Multi-Bank Investigation */}
                  <div className="group flex items-center gap-4 rounded-xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md hover:shadow-slate-900/5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 10h18" />
                        <path d="M5 10v8" />
                        <path d="M9 10v8" />
                        <path d="M15 10v8" />
                        <path d="M19 10v8" />
                        <path d="M3 18h18" />
                        <path d="m12 3 9 5H3l9-5Z" />
                      </svg>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#172554]">
                        Multi-Bank Investigation
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Work across statements and financial institutions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics Badges */}
                <div className="mt-7 grid max-w-lg grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 text-center shadow-2xs backdrop-blur-xs">
                    <p className="text-base font-extrabold text-[#172554]">
                      24/7
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Intelligence
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 text-center shadow-2xs backdrop-blur-xs">
                    <p className="text-base font-extrabold text-emerald-600">
                      AI-Powered
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Analysis
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 text-center shadow-2xs backdrop-blur-xs">
                    <p className="text-base font-extrabold text-[#172554]">
                      SEC
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Protected
                    </p>
                  </div>
                </div>

                {/* Bottom Channel Status */}
                <div className="mt-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  <div className="h-px w-12 bg-gradient-to-r from-emerald-500 to-transparent" />
                  Secure Financial Intelligence Channel
                </div>
              </div>
            </section>

            {/* ====================================================
                RIGHT SECTION: ELEVATED WHITE LOGIN CARD
            ===================================================== */}
            <section className="relative w-full arthbodh-anim-right">
              {/* Soft Ambient Card Glow */}
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-emerald-100/70 via-blue-50/50 to-slate-100/60 blur-xl" />

              <div className="relative rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
                {/* Mobile-only Brand Header */}
                <div className="mb-6 flex flex-col items-center justify-center text-center lg:hidden">
                  <div className="flex items-baseline select-none">
                    <span className="text-2xl font-black text-emerald-700">
                      अर्थ
                    </span>
                    <span className="ml-0.5 text-2xl font-extrabold text-[#172554]">
                      BODH
                    </span>
                  </div>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    BANKING ANALYTICAL SYSTEM
                  </span>
                </div>

                {/* =================================================
                    CARD HEADER
                ================================================== */}
                <div className="mb-7 flex items-center justify-between border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                        ARTHBODH Secure Access
                      </p>
                    </div>

                    <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#172554]">
                      Welcome back
                    </h2>

                    <p className="mt-1 text-xs text-[#64748B]">
                      Sign in to continue your financial investigation.
                    </p>
                  </div>

                  {/* Bank / Security Shield Icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs">
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                        strokeLinejoin="round"
                      />
                      <path
                        d="m9 12 2 2 4-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* =================================================
                    AUTHENTICATION FORM
                ================================================== */}
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-4.5"
                >
                  {/* GENERAL ERROR BANNER */}
                  {errors.general && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs font-semibold text-red-800 shadow-2xs animate-in fade-in duration-200">
                      <svg
                        className="h-4 w-4 shrink-0 text-red-600 mt-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{errors.general}</span>
                    </div>
                  )}

                  {/* USERNAME FIELD */}
                  <div>
                    <label
                      htmlFor="username"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Username
                    </label>

                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                        </svg>
                      </div>

                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        autoComplete="username"
                        placeholder="Enter your username"
                        disabled={isSubmitting}
                        className={`w-full rounded-xl border bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all duration-200 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                          errors.username
                            ? "border-red-300 ring-2 ring-red-500/10 focus:border-red-500 focus:ring-red-500/15"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        }`}
                      />
                    </div>

                    {errors.username && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {errors.username}
                      </p>
                    )}
                  </div>

                  {/* PASSWORD FIELD */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                      >
                        Password
                      </label>

                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Protected
                      </span>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="11"
                            rx="2"
                          />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      </div>

                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        disabled={isSubmitting}
                        className={`w-full rounded-xl border bg-slate-50/50 py-3 pl-11 pr-16 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all duration-200 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                          errors.password
                            ? "border-red-300 ring-2 ring-red-500/10 focus:border-red-500 focus:ring-red-500/15"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        disabled={isSubmitting}
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-40"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>

                    {errors.password && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* SECURITY STATUS */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/60" />
                      </span>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          Secure Channel
                        </p>
                        <p className="text-[10px] text-slate-500">
                          ARTHBODH authentication endpoint online
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full border border-emerald-200 bg-emerald-100/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Ready
                    </span>
                  </div>

                  {/* LOGIN SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#059669] px-5 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-900/15 transition-all duration-200 hover:bg-[#047857] hover:shadow-md hover:shadow-emerald-900/20 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                    {isSubmitting ? (
                      <span className="relative flex items-center gap-2.5">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Authenticating...</span>
                      </span>
                    ) : (
                      <span className="relative flex items-center gap-2">
                        <span>Enter ARTHBODH Dashboard</span>
                        <span className="transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                    )}
                  </button>
                </form>

                {/* =================================================
                    SECURITY FOOTER
                ================================================== */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Secure Authentication</span>
                    <span>•</span>
                    <span>Financial Intelligence Platform</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ========================================================
            BOTTOM STATUS (DESKTOP)
        ========================================================= */}
        <div className="pointer-events-none absolute bottom-4 left-6 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
          ARTHBODH / AUTH / FINANCIAL INTELLIGENCE
        </div>

        <div className="pointer-events-none absolute bottom-4 right-6 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
          SECURE CHANNEL // ONLINE
        </div>
      </main>
    </>
  );
}

export default Login;