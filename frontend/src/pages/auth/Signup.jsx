import Swal from "sweetalert2";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signupUser } from "../../services/api/auth";

function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* -----------------------------------------------------------
     PASSWORD STRENGTH
  ----------------------------------------------------------- */

  const passwordStrength = useMemo(() => {
    const password = formData.password;

    if (!password) {
      return {
        score: 0,
        label: "",
      };
    }

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return {
        score: 1,
        label: "Weak",
      };
    }

    if (score <= 4) {
      return {
        score: 2,
        label: "Good",
      };
    }

    return {
      score: 3,
      label: "Strong",
    };
  }, [formData.password]);

  /* -----------------------------------------------------------
     INPUT HANDLER
  ----------------------------------------------------------- */

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

    setServerError("");
    setSuccessMessage("");
  }

  /* -----------------------------------------------------------
     FORM VALIDATION
  ----------------------------------------------------------- */

  function validateForm() {
    const newErrors = {};

    const username = formData.username.trim();
    const email = formData.email.trim();

    if (!username) {
      newErrors.username = "Username is required.";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters.";
    } else if (username.length > 50) {
      newErrors.username = "Username must not exceed 50 characters.";
    }

    if (!email) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (formData.password.length > 128) {
      newErrors.password = "Password must not exceed 128 characters.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    return newErrors;
  }

  /* -----------------------------------------------------------
     SIGNUP
  ----------------------------------------------------------- */

  async function handleSubmit(event) {
    event.preventDefault();

    setServerError("");
    setSuccessMessage("");

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await signupUser({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      await Swal.fire({
        icon: "success",
        title: "Account Created",
        text: "Your BAS account has been created successfully.",
        background: "#08111c",
        color: "#f8fafc",
        iconColor: "#34d399",
        confirmButtonText: "Continue to Login",
        confirmButtonColor: "#059669",
      });

      navigate("/login", { replace: true });

      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      const message =
        error?.message ||
        "Unable to create your account. Please try again.";

      setServerError(message);

      await Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: message,
        background: "#08111c",
        color: "#f8fafc",
        iconColor: "#f87171",
        confirmButtonText: "Try Again",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /* -----------------------------------------------------------
     INPUT STYLES
  ----------------------------------------------------------- */

  const inputBase =
    "w-full rounded-xl border bg-slate-950/60 px-4 py-3.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-600 focus:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-50";

  const inputNormal =
    "border-white/[0.09] focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/[0.07]";

  const inputError =
    "border-red-500/50 focus:border-red-400 focus:ring-4 focus:ring-red-500/10";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] text-white selection:bg-emerald-400/30">
      {/* =========================================================
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

        {/* Main emerald glow */}
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.045] blur-3xl" />

        {/* Top-right blue glow */}
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.045] blur-3xl" />

        {/* Bottom-left glow */}
        <div className="absolute -bottom-52 -left-44 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.035] blur-3xl" />

        {/* =====================================================
            DATA CIRCLE
        ===================================================== */}

        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full border border-emerald-400/[0.08]">
          <div className="absolute inset-12 rounded-full border border-emerald-400/[0.06]" />
          <div className="absolute inset-24 rounded-full border border-emerald-400/[0.05]" />

          <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left bg-gradient-to-r from-emerald-400/50 to-transparent animate-[spin_10s_linear_infinite]" />
        </div>

        {/* Bottom data circle */}
        <div className="absolute -bottom-52 -right-44 h-[540px] w-[540px] rounded-full border border-cyan-400/[0.07]">
          <div className="absolute inset-14 rounded-full border border-cyan-400/[0.05]" />
          <div className="absolute inset-28 rounded-full border border-cyan-400/[0.05]" />
        </div>

        {/* =====================================================
            TRANSACTION DATA POINTS
        ===================================================== */}

        <span className="absolute left-[11%] top-[24%] h-1.5 w-1.5 rounded-full bg-emerald-300/70 shadow-[0_0_14px_rgba(52,211,153,0.8)] animate-pulse" />

        <span className="absolute right-[17%] top-[28%] h-1 w-1 rounded-full bg-cyan-300/70 animate-pulse [animation-delay:700ms]" />

        <span className="absolute bottom-[25%] left-[17%] h-1 w-1 rounded-full bg-emerald-300/60 animate-pulse [animation-delay:1200ms]" />

        <span className="absolute bottom-[18%] right-[12%] h-1.5 w-1.5 rounded-full bg-cyan-300/60 shadow-[0_0_10px_rgba(103,232,249,0.7)] animate-pulse [animation-delay:1800ms]" />

        {/* =====================================================
            DATA LINES
        ===================================================== */}

        <div className="absolute left-[8%] top-[72%] h-px w-40 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

        <div className="absolute right-[8%] top-[18%] h-px w-48 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

        <div className="absolute left-[15%] top-[32%] h-24 w-px bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent" />
      </div>

      {/* =========================================================
          TOP SYSTEM BAR
      ========================================================= */}

      <header className="absolute left-0 right-0 top-0 z-20 border-b border-white/[0.06] bg-[#050b12]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          {/* BAS Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07]">
              {/* Bank icon */}
              <div className="relative flex h-6 w-6 items-end justify-center">
                <div className="absolute left-1/2 top-0 h-2 w-4 -translate-x-1/2 rotate-45 border-l border-t border-emerald-300/80" />

                <div className="absolute bottom-1 left-1/2 h-3.5 w-5 -translate-x-1/2 border-x border-b border-emerald-300/70" />

                <div className="absolute bottom-0 left-0 right-0 h-px bg-emerald-300/70" />
              </div>

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

          {/* System status */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Secure System
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN CONTENT
      ========================================================= */}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-8 pt-24 sm:px-6">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
          {/* =====================================================
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

              {/* Main heading */}
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-6xl">
                Intelligent
                <span className="block bg-gradient-to-r from-white via-emerald-100 to-emerald-400 bg-clip-text text-transparent">
                  Bank Analysis.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                Create your secure BAS account and access a centralized
                financial intelligence platform for bank statement analysis,
                transaction investigation, and relationship discovery.
              </p>

              {/* =================================================
                  FEATURES
              ================================================= */}

              <div className="mt-9 space-y-3 max-w-lg">
                {/* Feature 1 */}
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
                      Analyze financial transactions and account activity.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 backdrop-blur-sm transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.025]">
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
                      Discover links between accounts and counterparties.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 backdrop-blur-sm transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.025]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/15 bg-amber-400/[0.05]">
                    <svg
                      className="h-5 w-5 text-amber-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M3 10h18" />
                      <path d="M5 10v9" />
                      <path d="M9 10v9" />
                      <path d="M15 10v9" />
                      <path d="M19 10v9" />
                      <path d="M3 19h18" />
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
                  <p className="text-lg font-semibold text-white">24/7</p>

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
                  <p className="text-lg font-semibold text-white">SEC</p>

                  <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                    Protected
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              SIGNUP CARD
          ===================================================== */}

          <section className="relative w-full">
            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-b from-emerald-400/20 via-transparent to-cyan-500/10 opacity-70 blur-xl" />

            <div className="relative rounded-[24px] border border-white/[0.1] bg-slate-950/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
              {/* =================================================
                  CARD HEADER
              ================================================= */}

              <div className="mb-7 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-300/70">
                    BAS Secure Access
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Create account
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Start your financial analysis workspace
                  </p>
                </div>

                {/* Bank logo */}
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
                  SERVER ERROR
              ================================================= */}

              {serverError && (
                <div
                  className="mb-5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                    </svg>

                    <span>{serverError}</span>
                  </div>
                </div>
              )}

              {/* =================================================
                  SUCCESS
              ================================================= */}

              {successMessage && (
                <div
                  className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300"
                  role="status"
                >
                  {successMessage}
                </div>
              )}

              {/* =================================================
                  FORM
              ================================================= */}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* USERNAME */}
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
                  >
                    Username
                  </label>

                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5" />
                    </svg>

                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      autoComplete="username"
                      placeholder="Enter username"
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

                {/* EMAIL */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
                  >
                    Email address
                  </label>

                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                      placeholder="investigator@example.com"
                      disabled={isSubmitting}
                      className={`${inputBase} pl-11 ${
                        errors.email ? inputError : inputNormal
                      }`}
                    />
                  </div>

                  {errors.email && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* PASSWORD */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Create a secure password"
                      disabled={isSubmitting}
                      className={`${inputBase} pl-11 pr-16 ${
                        errors.password ? inputError : inputNormal
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((previous) => !previous)
                      }
                      disabled={isSubmitting}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-emerald-300 disabled:opacity-40"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Password strength */}
                  {formData.password && (
                    <div className="mt-3">
                      <div className="flex gap-1">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              passwordStrength.score >= level
                                ? "bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.45)]"
                                : "bg-white/[0.08]"
                            }`}
                          />
                        ))}
                      </div>

                      <div className="mt-1 flex justify-between">
                        <span className="text-[10px] text-slate-600">
                          Minimum 8 characters
                        </span>

                        <span
                          className={`text-[10px] ${
                            passwordStrength.score === 3
                              ? "text-emerald-400"
                              : passwordStrength.score === 2
                              ? "text-amber-400"
                              : "text-slate-500"
                          }`}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {errors.password && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* CONFIRM PASSWORD */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
                  >
                    Confirm password
                  </label>

                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M5 12.5 10 17l9-10" />
                    </svg>

                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      disabled={isSubmitting}
                      className={`${inputBase} pl-11 pr-16 ${
                        errors.confirmPassword
                          ? inputError
                          : inputNormal
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (previous) => !previous
                        )
                      }
                      disabled={isSubmitting}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-emerald-300 disabled:opacity-40"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {errors.confirmPassword && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* =================================================
                    SUBMIT
                ================================================= */}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="
                    group relative mt-2 flex w-full items-center
                    justify-center overflow-hidden rounded-xl
                    border border-emerald-300/30
                    bg-emerald-400 px-4 py-3.5
                    text-sm font-semibold text-slate-950
                    shadow-[0_0_25px_rgba(52,211,153,0.10)]
                    transition-all duration-300
                    hover:border-emerald-200
                    hover:bg-emerald-300
                    hover:shadow-[0_0_35px_rgba(52,211,153,0.20)]
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
                      Creating account...
                    </span>
                  ) : (
                    <span className="relative flex items-center gap-2">
                      Create BAS Account

                      <span className="transition-transform duration-200 group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  )}
                </button>
              </form>

              {/* =================================================
                  FOOTER
              ================================================= */}

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="text-center text-xs text-slate-500">
                  Already have a BAS account?

                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="ml-1.5 font-medium text-emerald-300 transition hover:text-emerald-200 hover:underline"
                  >
                    Login
                  </button>
                </p>

                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                  Secure registration

                  <span>•</span>

                  Financial intelligence platform
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* =========================================================
          BOTTOM STATUS
      ========================================================= */}

      <div className="pointer-events-none absolute bottom-4 left-5 hidden text-[9px] uppercase tracking-[0.25em] text-slate-700 sm:block">
        BAS / AUTH / FINANCIAL INTELLIGENCE
      </div>

      <div className="pointer-events-none absolute bottom-4 right-5 hidden text-[9px] uppercase tracking-[0.25em] text-slate-700 sm:block">
        SECURE // SYSTEM ONLINE
      </div>
    </main>
  );
}

export default Signup;

