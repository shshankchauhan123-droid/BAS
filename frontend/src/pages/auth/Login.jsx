import Swal from "sweetalert2";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../services/api/auth";

function Login() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
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
     LOGIN
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
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#34d399",
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
       *
       * This guarantees that JSON.stringify() receives
       * normal strings and never an HTMLInputElement.
       */

      const username = String(formData.username).trim();
      const password = String(formData.password);

      console.log("LOGIN USERNAME:", username);
      console.log("LOGIN USERNAME TYPE:", typeof username);
      console.log("LOGIN PASSWORD TYPE:", typeof password);

      /*
       * Backend response expected:
       *
       * {
       *   access_token: "...",
       *   token_type: "bearer",
       *   user: {
       *     id,
       *     username,
       *     email,
       *     role,
       *     is_active
       *   }
       * }
       */

      const authData = await loginUser({
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
       * Determine dashboard.
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
       * AuthContext handles:
       *
       * 1. Saving JWT token.
       * 2. Saving authenticated user.
       * 3. Updating authentication state.
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
              color: #94a3b8;
              font-size: 13px;
              line-height: 1.6;
            ">
              Welcome back,
              <strong style="color:#6ee7b7;">
                ${authenticatedUser.username}
              </strong>
            </div>

            <div style="
              margin-top: 12px;
              padding: 10px 12px;
              border: 1px solid rgba(52,211,153,0.18);
              border-radius: 10px;
              background: rgba(52,211,153,0.05);
              color: #64748b;
              font-size: 10px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            ">
              ${role} authentication successful
            </div>

            <div style="
              margin-top: 8px;
              color: #475569;
              font-size: 9px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            ">
              Bank Analysis System
            </div>
          </div>
        `,
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#34d399",
        confirmButtonText:
          role === "superadmin" || role === "admin"
            ? "Enter SuperAdmin Control →"
            : role === "client_admin"
            ? "Enter Company Portal →"
            : "Enter BAS Dashboard →",
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
       *
       * admin → /admin
       * user  → /dashboard
       */

      navigate(dashboardPath, {
        replace: true,
      });
    } catch (error) {
      console.error("Login failed:", error);

      /*
       * Clear authentication state.
       */

      logout();

      /*
       * Get backend error when available.
       */

      const message =
        error?.response?.data?.detail ||
        error?.message ||
        "Unable to authenticate your account. Please try again.";

      /*
       * ERROR MESSAGE
       */

      await Swal.fire({
        icon: "error",
        title: "Authentication Failed",
        html: `
          <div style="
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.6;
          ">
            ${message}
          </div>

          <div style="
            margin-top: 12px;
            color: #475569;
            font-size: 10px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          ">
            BAS authentication request rejected
          </div>
        `,
        background: "#07110f",
        color: "#f8fafc",
        iconColor: "#f87171",
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

  /* ============================================================
     INPUT STYLES
  ============================================================ */

  const inputBase =
    "w-full rounded-xl border bg-slate-950/60 px-4 py-3.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-600 focus:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-50";

  const inputNormal =
    "border-white/[0.09] focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/[0.07]";

  const inputError =
    "border-red-500/50 focus:border-red-400 focus:ring-4 focus:ring-red-500/10";

  return (
    <>
      {/* ==========================================================
          SWEETALERT STYLING
      =========================================================== */}

      <style>
        {`
          .bas-popup {
            border: 1px solid rgba(52, 211, 153, 0.16) !important;
            border-radius: 24px !important;

            box-shadow:
              0 0 0 1px rgba(52, 211, 153, 0.03),
              0 25px 80px rgba(0, 0, 0, 0.65),
              0 0 60px rgba(52, 211, 153, 0.08) !important;

            backdrop-filter: blur(20px) !important;
          }

          .bas-popup-title {
            letter-spacing: -0.02em !important;
            font-weight: 600 !important;
          }

          .bas-popup-html {
            margin: 0 !important;
          }

          .bas-confirm-button,
          .bas-error-button {
            border-radius: 10px !important;
            padding: 11px 20px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            letter-spacing: 0.03em !important;
            box-shadow: none !important;
          }

          .swal2-icon {
            border-width: 2px !important;
          }

          .swal2-icon.swal2-success {
            border-color: rgba(52, 211, 153, 0.5) !important;
            color: #34d399 !important;
          }

          .swal2-icon.swal2-error {
            border-color: rgba(248, 113, 113, 0.5) !important;
          }

          .swal2-icon.swal2-warning {
            border-color: rgba(251, 191, 36, 0.5) !important;
          }
        `}
      </style>

      {/* ==========================================================
          PAGE
      =========================================================== */}

      <main className="relative min-h-screen overflow-hidden bg-[#050c0b] text-white selection:bg-emerald-400/30">

        {/* ========================================================
            BACKGROUND
        ========================================================= */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          {/* Financial grid */}

          <div
            className="
              absolute inset-0 opacity-[0.055]
              bg-[linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)]
              bg-[size:52px_52px]
            "
          />

          {/* Main glow */}

          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.045] blur-3xl" />

          {/* Cyan glow */}

          <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.035] blur-3xl" />

          {/* Green bottom glow */}

          <div className="absolute -bottom-52 -left-44 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.035] blur-3xl" />

          {/* ======================================================
              TOP FINANCIAL DATA CIRCLE
          ======================================================= */}

          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full border border-emerald-400/[0.08]">

            <div className="absolute inset-12 rounded-full border border-emerald-400/[0.06]" />

            <div className="absolute inset-24 rounded-full border border-emerald-400/[0.05]" />

            <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left bg-gradient-to-r from-emerald-400/50 to-transparent animate-[spin_10s_linear_infinite]" />
          </div>

          {/* ======================================================
              BOTTOM DATA CIRCLE
          ======================================================= */}

          <div className="absolute -bottom-52 -right-44 h-[540px] w-[540px] rounded-full border border-cyan-400/[0.07]">

            <div className="absolute inset-14 rounded-full border border-cyan-400/[0.05]" />

            <div className="absolute inset-28 rounded-full border border-cyan-400/[0.05]" />
          </div>

          {/* ======================================================
              DATA POINTS
          ======================================================= */}

          <span className="absolute left-[11%] top-[24%] h-1.5 w-1.5 rounded-full bg-emerald-300/70 shadow-[0_0_14px_rgba(52,211,153,0.8)] animate-pulse" />

          <span className="absolute right-[17%] top-[28%] h-1 w-1 rounded-full bg-cyan-300/70 animate-pulse [animation-delay:700ms]" />

          <span className="absolute bottom-[25%] left-[17%] h-1 w-1 rounded-full bg-emerald-300/60 animate-pulse [animation-delay:1200ms]" />

          <span className="absolute bottom-[18%] right-[12%] h-1.5 w-1.5 rounded-full bg-cyan-300/60 shadow-[0_0_10px_rgba(103,232,249,0.7)] animate-pulse [animation-delay:1800ms]" />

          {/* ======================================================
              TRANSACTION LINES
          ======================================================= */}

          <div className="absolute left-[8%] top-[72%] h-px w-40 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

          <div className="absolute right-[8%] top-[18%] h-px w-48 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

          <div className="absolute left-[15%] top-[32%] h-24 w-px bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent" />
        </div>

        {/* ========================================================
            TOP BAR
        ========================================================= */}

        <header className="absolute left-0 right-0 top-0 z-20 border-b border-white/[0.06] bg-[#050c0b]/75 backdrop-blur-xl">

          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">

            {/* BAS LOGO */}

            <div className="flex items-center gap-3">

              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07]">

                <svg
                  className="h-6 w-6 text-emerald-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 10h18" />
                  <path d="M5 10v8" />
                  <path d="M9 10v8" />
                  <path d="M15 10v8" />
                  <path d="M19 10v8" />
                  <path d="M3 18h18" />
                  <path d="m12 3 9 5H3l9-5Z" />
                </svg>

                <div className="absolute inset-1.5 rounded-lg border border-emerald-300/10" />
              </div>

              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-white">
                  BAS
                </p>

                <p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">
                  Bank Analysis System
                </p>
              </div>
            </div>

            {/* STATUS */}

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

              Secure System
            </div>
          </div>
        </header>

        {/* ========================================================
            MAIN CONTENT
        ========================================================= */}

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-8 pt-24 sm:px-6">

          <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">

            {/* ====================================================
                LEFT INFORMATION PANEL
            ===================================================== */}

            <section className="hidden lg:block">

              <div className="max-w-xl">

                {/* Label */}

                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5">

                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />

                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-200">
                    Secure Financial Access
                  </span>
                </div>

                {/* Heading */}

                <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-6xl">

                  Financial

                  <span className="block bg-gradient-to-r from-white via-emerald-100 to-emerald-400 bg-clip-text text-transparent">
                    Intelligence.
                  </span>
                </h1>

                {/* Description */}

                <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                  Access the Bank Analysis System to investigate bank
                  statements, analyze transactions, discover financial
                  relationships, and build intelligent case insights.
                </p>

                {/* =================================================
                    FEATURES
                ================================================== */}

                <div className="mt-9 max-w-lg space-y-3">

                  {/* Transaction Intelligence */}

                  <div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 backdrop-blur-sm transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.025]">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05]">

                      <svg
                        className="h-5 w-5 text-emerald-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M4 19V5" />
                        <path d="M4 19h16" />
                        <path d="m7 15 3-4 3 2 5-7" />
                      </svg>

                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Transaction Intelligence
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Analyze transaction activity and financial patterns.
                      </p>
                    </div>
                  </div>

                  {/* Relationship Analysis */}

                  <div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 backdrop-blur-sm transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.025]">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05]">

                      <svg
                        className="h-5 w-5 text-cyan-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
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
                      <p className="text-sm font-medium text-slate-200">
                        Relationship Analysis
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Discover connections between accounts and entities.
                      </p>
                    </div>
                  </div>

                  {/* Multi Bank */}

                  <div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 backdrop-blur-sm transition hover:border-amber-400/20 hover:bg-amber-400/[0.025]">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/15 bg-amber-400/[0.05]">

                      <svg
                        className="h-5 w-5 text-amber-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
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
                      <p className="text-sm font-medium text-slate-200">
                        Multi-Bank Investigation
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Work across statements and financial institutions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}

                <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-sm">

                    <p className="text-lg font-semibold text-white">
                      24/7
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      Intelligence
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-sm">

                    <p className="text-lg font-semibold text-emerald-400">
                      AI
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      Analysis
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-sm">

                    <p className="text-lg font-semibold text-white">
                      SEC
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      Protected
                    </p>
                  </div>

                </div>

                {/* Bottom information */}

                <div className="mt-8 flex items-center gap-3 text-[9px] uppercase tracking-[0.2em] text-slate-600">

                  <div className="h-px w-12 bg-gradient-to-r from-emerald-400/50 to-transparent" />

                  Secure financial intelligence channel
                </div>

              </div>
            </section>

            {/* ====================================================
                LOGIN CARD
            ===================================================== */}

            <section className="relative w-full">

              {/* Glow */}

              <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-b from-emerald-400/20 via-transparent to-cyan-500/10 opacity-70 blur-xl" />

              <div className="relative rounded-[24px] border border-white/[0.1] bg-slate-950/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">

                {/* =================================================
                    CARD HEADER
                ================================================== */}

                <div className="mb-8 flex items-center justify-between">

                  <div>

                    <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-300/70">
                      BAS Secure Access
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      Welcome back
                    </h2>

                    <p className="mt-1.5 text-xs text-slate-500">
                      Sign in to continue your financial investigation.
                    </p>

                  </div>

                  {/* Bank Icon */}

                  <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06]">

                    <svg
                      className="h-6 w-6 text-emerald-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M3 10h18" />
                      <path d="M5 10v8" />
                      <path d="M9 10v8" />
                      <path d="M15 10v8" />
                      <path d="M19 10v8" />
                      <path d="M3 18h18" />
                      <path d="m12 3 9 5H3l9-5Z" />
                    </svg>

                    <div className="absolute inset-2 rounded-lg border border-emerald-300/10" />

                  </div>

                </div>

                {/* =================================================
                    FORM
                ================================================== */}

                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-5"
                >

                  {/* =================================================
                      USERNAME
                  ================================================== */}

                  <div>

                    <label
                      htmlFor="username"
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
                    >
                      Username
                    </label>

                    <div className="relative">

                      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">

                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
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
                        className={`${inputBase} pl-11 ${
                          errors.username ? inputError : inputNormal
                        }`}
                      />

                    </div>

                    {errors.username && (
                      <p className="mt-1.5 text-xs text-red-400">
                        {errors.username}
                      </p>
                    )}

                  </div>

                  {/* =================================================
                      PASSWORD
                  ================================================== */}

                  <div>

                    <div className="mb-2 flex items-center justify-between">

                      <label
                        htmlFor="password"
                        className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                      >
                        Password
                      </label>

                      <span className="text-[9px] uppercase tracking-wider text-slate-600">
                        Protected
                      </span>

                    </div>

                    <div className="relative">

                      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">

                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
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
                        className={`${inputBase} pl-11 pr-16 ${
                          errors.password
                            ? inputError
                            : inputNormal
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (previous) => !previous
                          )
                        }
                        disabled={isSubmitting}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-emerald-300 disabled:opacity-40"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>

                    </div>

                    {errors.password && (
                      <p className="mt-1.5 text-xs text-red-400">
                        {errors.password}
                      </p>
                    )}

                  </div>

                  {/* =================================================
                      SECURITY STATUS
                  ================================================== */}

                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">

                    <div className="flex items-center gap-2.5">

                      <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05]">

                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

                      </span>

                      <div>

                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Secure channel
                        </p>

                        <p className="text-[9px] text-slate-600">
                          BAS authentication endpoint online
                        </p>

                      </div>

                    </div>

                    <span className="text-[9px] font-medium uppercase tracking-wider text-emerald-400/70">
                      Ready
                    </span>

                  </div>

                  {/* =================================================
                      LOGIN BUTTON
                  ================================================== */}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="
                      group relative mt-1 flex w-full
                      items-center justify-center overflow-hidden
                      rounded-xl border border-emerald-300/30
                      bg-emerald-400 px-4 py-3.5
                      text-sm font-semibold text-slate-950
                      shadow-[0_0_25px_rgba(52,211,153,0.12)]
                      transition-all duration-300
                      hover:border-emerald-200
                      hover:bg-emerald-300
                      hover:shadow-[0_0_35px_rgba(52,211,153,0.22)]
                      focus:outline-none
                      focus:ring-4
                      focus:ring-emerald-400/20
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >

                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                    {isSubmitting ? (
                      <span className="relative flex items-center gap-2">

                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />

                        Authenticating...

                      </span>
                    ) : (
                      <span className="relative flex items-center gap-2">

                        Enter BAS Dashboard

                        <span className="transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>

                      </span>
                    )}

                  </button>

                </form>

                {/* =================================================
                    SIGNUP
                ================================================== */}

                <div className="mt-6 border-t border-white/[0.06] pt-5">

                  <p className="text-center text-xs text-slate-500">

                    New to BAS?

                    <Link
                      to="/signup"
                      className="ml-1.5 font-medium text-emerald-300 transition hover:text-emerald-200 hover:underline"
                    >
                      Create an account
                    </Link>

                  </p>

                  <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-600">

                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />

                    Secure authentication

                    <span>•</span>

                    Financial intelligence platform

                  </div>

                </div>

              </div>

            </section>

          </div>

        </div>

        {/* ========================================================
            BOTTOM STATUS
        ========================================================= */}

        <div className="pointer-events-none absolute bottom-4 left-5 hidden text-[9px] uppercase tracking-[0.25em] text-slate-700 sm:block">
          BAS / AUTH / FINANCIAL INTELLIGENCE
        </div>

        <div className="pointer-events-none absolute bottom-4 right-5 hidden text-[9px] uppercase tracking-[0.25em] text-slate-700 sm:block">
          SECURE CHANNEL // ONLINE
        </div>

      </main>
    </>
  );
}

export default Login;