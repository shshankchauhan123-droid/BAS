import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getUserById } from "../../services/api/user";

function UserNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { userId, user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [userDetails, setUserDetails] = useState(user || null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  /* ============================================================
     FETCH USER DETAILS BY USER ID
  ============================================================ */

  useEffect(() => {
    let isMounted = true;

    async function fetchUserDetails() {
      if (!userId) {
        setUserDetails(user || null);
        return;
      }

      try {
        setUserLoading(true);

        const response = await getUserById(userId);

        /*
         * Your backend may return the user object directly
         * or inside a "data" property.
         *
         * Support both formats.
         */

        const fetchedUser =
          response?.data ?? response;

        if (isMounted && fetchedUser) {
          setUserDetails(fetchedUser);
        }
      } catch (error) {
        console.error(
          "Failed to fetch user details:",
          error
        );

        /*
         * If API fails, keep the user information
         * already available from AuthContext.
         */

        if (isMounted) {
          setUserDetails(user || null);
        }
      } finally {
        if (isMounted) {
          setUserLoading(false);
        }
      }
    }

    fetchUserDetails();

    return () => {
      isMounted = false;
    };
  }, [userId, user]);

  /* ============================================================
     USER DISPLAY INFORMATION
  ============================================================ */

  const displayUsername =
    userDetails?.username ||
    user?.username ||
    "User";

  const displayEmail =
    userDetails?.email ||
    user?.email ||
    "-";

  const displayRole =
    userDetails?.role ||
    user?.role ||
    "user";

  const displayUserId =
    userDetails?.id ??
    user?.id ??
    userId ??
    "-";

  const isUserActive =
    userDetails?.is_active ??
    user?.is_active ??
    false;

  const userInitial =
    displayUsername
      ?.charAt(0)
      ?.toUpperCase() || "U";

  /* ============================================================
     ACTIVE ROUTE
  ============================================================ */

  const isActive = (path) => {
    if (path === "/superadmin") {
      return location.pathname === "/superadmin" || location.pathname.startsWith("/superadmin/");
    }

    if (path === "/client-admin") {
      return location.pathname === "/client-admin" || location.pathname.startsWith("/client-admin/");
    }

    /*
     * Dashboard should ONLY be active on:
     *
     * /dashboard
     */

    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }

    /*
     * Cases should be active on:
     *
     * /dashboard/cases
     * /dashboard/cases/1
     * /dashboard/cases/2
     */

    if (path === "/dashboard/cases") {
      return (
        location.pathname === "/dashboard/cases" ||
        location.pathname.startsWith(
          "/dashboard/cases/"
        )
      );
    }

    /*
     * IO Master
     */

    if (path === "/dashboard/io-master") {
      return (
        location.pathname === "/dashboard/io-master" ||
        location.pathname.startsWith(
          "/dashboard/io-master/"
        )
      );
    }

    /*
     * Reports
     */

    if (path === "/reports") {
      return (
        location.pathname === "/reports" ||
        location.pathname.startsWith("/reports/")
      );
    }

    /*
     * Analysis
     */

    if (path === "/analysis") {
      return (
        location.pathname === "/analysis" ||
        location.pathname.startsWith("/analysis/")
      );
    }

    return location.pathname === path;
  };

  const isSuperAdmin =
    String(displayRole).toLowerCase() === "superadmin" ||
    String(displayRole).toLowerCase() === "admin";

  const isClientAdmin =
    String(displayRole).toLowerCase() === "client_admin";

  const homePath = isSuperAdmin
    ? "/superadmin"
    : isClientAdmin
    ? "/client-admin"
    : "/dashboard";

  /* ============================================================
     NAVIGATION
  ============================================================ */

  const goTo = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  /* ============================================================
     LOGOUT
  ============================================================ */

  const handleLogout = () => {
    try {
      logout();
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }

    /*
     * Keep cleanup for any old BAS/AntiDrone
     * localStorage values.
     */

    localStorage.removeItem(
      "antidrone_access_token"
    );

    localStorage.removeItem(
      "antidrone_user"
    );

    localStorage.removeItem(
      "bas_access_token"
    );

    localStorage.removeItem(
      "bas_user"
    );

    localStorage.removeItem(
      "bas_user_id"
    );

    navigate("/login", {
      replace: true,
    });
  };

  /* ============================================================
     DESKTOP NAVIGATION STYLE
  ============================================================ */

  const desktopNavClass = (path) => {
    const active = isActive(path);

    return `
      rounded-xl
      px-5
      py-3
      text-sm
      font-semibold
      transition-all
      duration-200
      ${
        active
          ? `
            bg-emerald-400/[0.10]
            text-emerald-300
            shadow-[0_0_25px_rgba(52,211,153,0.04)]
          `
          : `
            text-slate-400
            hover:bg-white/[0.03]
            hover:text-slate-200
          `
      }
    `;
  };

  /* ============================================================
     MOBILE NAVIGATION STYLE
  ============================================================ */

  const mobileNavClass = (path) => {
    const active = isActive(path);

    return `
      w-full
      rounded-xl
      px-4
      py-3
      text-left
      text-sm
      font-semibold
      transition-all
      duration-200
      ${
        active
          ? `
            bg-emerald-400/[0.10]
            text-emerald-300
          `
          : `
            text-slate-400
            hover:bg-white/[0.03]
            hover:text-slate-200
          `
      }
    `;
  };

  /* ============================================================
     ROLE DISPLAY
  ============================================================ */

  const formattedRole =
    String(displayRole)
      .replaceAll("_", " ")
      .toUpperCase();

  /* ============================================================
     RETURN
  ============================================================ */

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-400/[0.08] bg-[#03100d]/95 backdrop-blur-xl">

      <div className="mx-auto flex h-[108px] w-full items-center justify-between px-8 lg:px-11">

        {/* =====================================================
            BAS LOGO
        ====================================================== */}

        <button
          type="button"
          onClick={() => goTo("/dashboard")}
          className="flex items-center gap-4"
        >
          {/* Logo Icon */}

          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06]">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 13.5L16 5L27 13.5V27H5V13.5Z"
                stroke="#34D399"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              <path
                d="M10 27V15H22V27"
                stroke="#34D399"
                strokeWidth="2"
              />

              <path
                d="M14 27V19H18V27"
                stroke="#34D399"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* BAS Text */}

          <div className="hidden text-left sm:block">
            <div className="text-[27px] font-bold tracking-[0.30em] text-white">
              BAS
            </div>

            <div className="-mt-1 text-[10px] font-medium tracking-[0.28em] text-slate-500">
              BANK ANALYSIS SYSTEM
            </div>
          </div>
        </button>

        {/* =====================================================
            DESKTOP NAVIGATION
        ====================================================== */}

        <nav className="hidden items-center gap-1 lg:flex">

          {/* Dashboard */}

          <button
            type="button"
            onClick={() => goTo("/dashboard")}
            className={desktopNavClass("/dashboard")}
          >
            Dashboard
          </button>

          {/* Cases */}

          <button
            type="button"
            onClick={() =>
              goTo("/dashboard/cases")
            }
            className={desktopNavClass(
              "/dashboard/cases"
            )}
          >
            Cases
          </button>

          {/* IO Master */}

          <button
            type="button"
            onClick={() =>
              goTo("/dashboard/io-master")
            }
            className={desktopNavClass(
              "/dashboard/io-master"
            )}
          >
            IO Master
          </button>


          {/* Reports */}

          <button
            type="button"
            onClick={() => goTo("/reports")}
            className={desktopNavClass("/reports")}
          >
            Reports
          </button>

          {/* Analysis */}

          <button
            type="button"
            onClick={() => goTo("/analysis")}
            className={desktopNavClass("/analysis")}
          >
            Analysis
          </button>
        </nav>

        {/* =====================================================
            RIGHT SIDE
        ====================================================== */}

        <div className="hidden items-center gap-5 lg:flex">

          {/* System Status */}

          <div className="flex items-center gap-3 rounded-full border border-emerald-400/15 bg-emerald-400/[0.04] px-5 py-2.5">
            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

            <span className="text-xs font-semibold tracking-[0.12em] text-emerald-400">
              SYSTEM ONLINE
            </span>
          </div>

          {/* =================================================
              USER PROFILE BUTTON
          ================================================== */}

          <div className="relative">

            <button
              type="button"
              onClick={() =>
                setUserMenuOpen(
                  (previous) => !previous
                )
              }
              className="
                flex
                items-center
                gap-3
                rounded-2xl
                border
                border-white/[0.08]
                bg-white/[0.025]
                px-4
                py-2.5
                transition-all
                duration-200
                hover:border-emerald-400/20
                hover:bg-emerald-400/[0.03]
              "
            >

              {/* User Initial */}

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/[0.10] text-lg font-bold text-emerald-300">
                {userInitial}
              </div>

              {/* Username */}

              <div className="text-left">
                <div className="max-w-[130px] truncate text-sm font-semibold text-white">
                  {userLoading
                    ? "Loading..."
                    : displayUsername}
                </div>

                <div className="text-xs tracking-[0.12em] text-slate-500">
                  {formattedRole}
                </div>
              </div>

              {/* Arrow */}

              <span
                className={`
                  ml-3
                  text-slate-500
                  transition-transform
                  duration-200
                  ${
                    userMenuOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
              >
                ˅
              </span>
            </button>

            {/* =================================================
                USER DETAILS DROPDOWN
            ================================================== */}

            {userMenuOpen && (
              <div
                className="
                  absolute
                  right-0
                  top-[calc(100%+12px)]
                  z-[60]
                  w-[320px]
                  overflow-hidden
                  rounded-2xl
                  border
                  border-emerald-400/[0.12]
                  bg-[#061411]
                  shadow-[0_25px_80px_rgba(0,0,0,0.45)]
                  backdrop-blur-xl
                "
              >

                {/* Header */}

                <div className="border-b border-white/[0.06] px-5 py-5">

                  <div className="flex items-center gap-4">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-xl font-bold text-emerald-300">
                      {userInitial}
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-base font-semibold text-white">
                        {displayUsername}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {displayEmail}
                      </p>

                    </div>
                  </div>
                </div>

                {/* User Details */}

                <div className="px-5 py-4">

                  {/* User ID */}

                  <div className="flex items-center justify-between border-b border-white/[0.05] py-3">

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      User ID
                    </span>

                    <span className="font-mono text-xs font-medium text-emerald-300">
                      #{displayUserId}
                    </span>

                  </div>

                  {/* Username */}

                  <div className="flex items-center justify-between border-b border-white/[0.05] py-3">

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Username
                    </span>

                    <span className="max-w-[160px] truncate text-xs font-medium text-slate-300">
                      {displayUsername}
                    </span>

                  </div>

                  {/* Email */}

                  <div className="flex items-center justify-between border-b border-white/[0.05] py-3">

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Email
                    </span>

                    <span className="max-w-[180px] truncate text-xs font-medium text-slate-300">
                      {displayEmail}
                    </span>

                  </div>

                  {/* Role */}

                  <div className="flex items-center justify-between border-b border-white/[0.05] py-3">

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Role
                    </span>

                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-emerald-300">
                      {formattedRole}
                    </span>

                  </div>

                  {/* Account Status */}

                  <div className="flex items-center justify-between py-3">

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Status
                    </span>

                    <div className="flex items-center gap-2">

                      <span
                        className={`
                          h-1.5
                          w-1.5
                          rounded-full
                          ${
                            isUserActive
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                              : "bg-red-400"
                          }
                        `}
                      />

                      <span
                        className={`
                          text-[9px]
                          font-semibold
                          uppercase
                          tracking-[0.12em]
                          ${
                            isUserActive
                              ? "text-emerald-300"
                              : "text-red-300"
                          }
                        `}
                      >
                        {isUserActive
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>

                    </div>
                  </div>
                </div>

                {/* Footer */}

                <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">

                  <p className="text-center text-[9px] font-medium uppercase tracking-[0.14em] text-slate-600">
                    Bank Analysis System
                  </p>

                </div>

              </div>
            )}
          </div>

          {/* =================================================
              LOGOUT
          ================================================== */}

          <button
            type="button"
            onClick={handleLogout}
            className="
              rounded-2xl
              border
              border-white/[0.08]
              px-6
              py-3
              text-sm
              font-semibold
              text-slate-400
              transition
              hover:border-red-400/20
              hover:bg-red-400/[0.04]
              hover:text-red-300
            "
          >
            Logout
          </button>
        </div>

        {/* =====================================================
            MOBILE MENU BUTTON
        ====================================================== */}

        <button
          type="button"
          onClick={() =>
            setMobileMenuOpen(
              (previous) => !previous
            )
          }
          className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            border
            border-white/[0.08]
            text-slate-300
            transition
            hover:border-emerald-400/20
            hover:text-emerald-300
            lg:hidden
          "
          aria-label="Toggle navigation menu"
        >
          <span className="text-xl">
            {mobileMenuOpen ? "×" : "☰"}
          </span>
        </button>
      </div>

      {/* =======================================================
          MOBILE NAVIGATION
      ======================================================= */}

      {mobileMenuOpen && (
        <div className="border-t border-emerald-400/[0.08] bg-[#03100d] px-6 py-5 lg:hidden">

          {/* Mobile User Information */}

          <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/[0.10] text-lg font-bold text-emerald-300">
                {userInitial}
              </div>

              <div className="min-w-0">

                <p className="truncate text-sm font-semibold text-white">
                  {displayUsername}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {displayEmail}
                </p>

              </div>
            </div>

            {/* Mobile User Details */}

            <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">

              <div className="flex justify-between">
                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                  User ID
                </span>

                <span className="font-mono text-xs text-emerald-300">
                  #{displayUserId}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                  Role
                </span>

                <span className="text-xs font-medium text-slate-300">
                  {formattedRole}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                  Status
                </span>

                <span
                  className={
                    isUserActive
                      ? "text-xs font-medium text-emerald-300"
                      : "text-xs font-medium text-red-300"
                  }
                >
                  {isUserActive
                    ? "ACTIVE"
                    : "INACTIVE"}
                </span>
              </div>

            </div>
          </div>

          <div className="flex flex-col gap-2">

            {/* Dashboard */}

            <button
              type="button"
              onClick={() => goTo("/dashboard")}
              className={mobileNavClass(
                "/dashboard"
              )}
            >
              Dashboard
            </button>

            {/* Cases */}

            <button
              type="button"
              onClick={() =>
                goTo("/dashboard/cases")
              }
              className={mobileNavClass(
                "/dashboard/cases"
              )}
            >
              Cases
            </button>

            {/* IO Master */}

            <button
              type="button"
              onClick={() =>
                goTo("/dashboard/io-master")
              }
              className={mobileNavClass(
                "/dashboard/io-master"
              )}
            >
              IO Master
            </button>


            {/* Reports */}

            <button
              type="button"
              onClick={() =>
                goTo("/reports")
              }
              className={mobileNavClass(
                "/reports"
              )}
            >
              Reports
            </button>

            {/* Analysis */}

            <button
              type="button"
              onClick={() =>
                goTo("/analysis")
              }
              className={mobileNavClass(
                "/analysis"
              )}
            >
              Analysis
            </button>

            {/* Logout */}

            <button
              type="button"
              onClick={handleLogout}
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-white/[0.08]
                px-4
                py-3
                text-left
                text-sm
                font-semibold
                text-slate-400
                transition
                hover:border-red-400/20
                hover:bg-red-400/[0.04]
                hover:text-red-300
              "
            >
              Logout
            </button>

          </div>
        </div>
      )}
    </header>
  );
}

export default UserNavbar;