import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getUserById } from "../../services/api/user";

/**
 * ARTHBODH — Banking Analytical System
 * Universal Navigation Sidebar Component
 *
 * Features:
 * - Text-based ARTHBODH branding ("अर्थ" in emerald, "BODH" in deep navy, subtitle underneath)
 * - Expandable and collapsible sidebar (272px expanded, 80px collapsed) with right-aligned header toggle button
 * - Smooth 280ms layout padding transition synchronized with main content
 * - Responsive mobile navigation drawer for screens below 1024px
 * - Preserves all routes, permissions, profile modal, and logout functionality
 */
function UserNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(user || null);
  const [userLoading, setUserLoading] = useState(false);

  // Expanded: 272px; collapsed: 84px
  const sidebarWidth = sidebarCollapsed ? 84 : 272;

  // FETCH USER DETAILS
  useEffect(() => {
    let isMounted = true;

    async function fetchUserDetails() {
      if (!userId) {
        setUserDetails(user || null);
        setUserLoading(false);
        return;
      }

      try {
        setUserLoading(true);
        const response = await getUserById(userId);
        const fetchedUser = response?.data ?? response;

        if (isMounted && fetchedUser) {
          setUserDetails(fetchedUser);
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);

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

  // ADJUST MAIN CONTENT WHEN SIDEBAR COLLAPSES
  useEffect(() => {
    const previousPadding = document.body.style.paddingLeft;
    const previousTransition = document.body.style.transition;

    const updateLayout = () => {
      document.body.style.paddingLeft =
        window.innerWidth >= 1024 ? `${sidebarWidth}px` : "0px";
    };

    document.body.style.transition =
      "padding-left 280ms cubic-bezier(0.16, 1, 0.3, 1)";

    updateLayout();
    window.addEventListener("resize", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
      document.body.style.paddingLeft = previousPadding;
      document.body.style.transition = previousTransition;
    };
  }, [sidebarWidth]);

  // CLOSE MODALS ON ESCAPE
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileModalOpen(false);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // PREVENT BODY SCROLL WHEN MOBILE DRAWER IS OPEN
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // USER METADATA AND PERMISSIONS
  const displayUsername =
    userDetails?.username || user?.username || "User";

  const displayEmail = userDetails?.email || user?.email || "-";
  const displayRole = userDetails?.role || user?.role || "user";

  const displayUserId =
    userDetails?.id ?? user?.id ?? userId ?? "-";

  const isUserActive =
    userDetails?.is_active ?? user?.is_active ?? false;

  const userInitial =
    displayUsername.trim().charAt(0).toUpperCase() || "U";

  const userRole = String(displayRole).toLowerCase();

  const isSuperAdmin =
    userRole === "superadmin" || userRole === "admin";

  const isClientAdmin = userRole === "client_admin";
  const isNormalUser = userRole === "user";

  const homePath = isSuperAdmin
    ? "/superadmin"
    : isClientAdmin
      ? "/client-admin"
      : "/dashboard";

  const casesPath = isSuperAdmin ? "/superadmin/cases" : "/dashboard/cases";
  const ioMasterPath = isSuperAdmin ? "/superadmin/io-master" : "/dashboard/io-master";

  const userPerms =
    userDetails?.permissions || user?.permissions || {};

  const canViewCases =
    !isNormalUser || userPerms?.can_view_cases !== false;

  const canViewIO =
    !isNormalUser || userPerms?.can_view_io !== false;

  const canViewReports =
    !isNormalUser || userPerms?.can_view_reports !== false;

  const formattedRole = String(displayRole)
    .replaceAll("_", " ")
    .toUpperCase();

  // ROUTE HIGHLIGHTING
  const isActive = (path) => {
    const currentPath = location.pathname;

    if (path === "/superadmin") {
      return (
        currentPath === "/superadmin" ||
        (currentPath.startsWith("/superadmin/") &&
          !currentPath.startsWith("/superadmin/cases") &&
          !currentPath.startsWith("/superadmin/io-master"))
      );
    }

    if (path === "/client-admin") {
      return (
        currentPath === path ||
        currentPath.startsWith(`${path}/`)
      );
    }

    if (path === "/dashboard") {
      return currentPath === "/dashboard";
    }

    if (path === "/superadmin/cases") {
      return (
        currentPath === "/superadmin/cases" ||
        currentPath.startsWith("/superadmin/cases/")
      );
    }

    if (path === "/superadmin/io-master") {
      return (
        currentPath === "/superadmin/io-master" ||
        currentPath.startsWith("/superadmin/io-master/")
      );
    }

    if (path === "/dashboard/cases") {
      return (
        currentPath === "/dashboard/cases" ||
        (currentPath.startsWith("/dashboard/cases/") &&
          !currentPath.includes("/reports"))
      );
    }

    if (path === "/dashboard/io-master") {
      return (
        currentPath === path ||
        currentPath.startsWith(`${path}/`)
      );
    }

    if (path === "/reports") {
      return (
        currentPath === "/reports" ||
        currentPath.startsWith("/reports/") ||
        currentPath.includes("/reports")
      );
    }

    if (path === "/analysis") {
      return (
        currentPath === path ||
        currentPath.startsWith(`${path}/`)
      );
    }

    return currentPath === path;
  };

  // NAVIGATION HANDLERS
  const goTo = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
    setProfileModalOpen(false);
  };

  const handleLogout = () => {
    try {
      logout();
    } catch (error) {
      console.error("Logout error:", error);
    }

    [
      "antidrone_access_token",
      "antidrone_user",
      "bas_access_token",
      "bas_user",
      "bas_user_id",
    ].forEach((key) => localStorage.removeItem(key));

    setMobileMenuOpen(false);
    setProfileModalOpen(false);
    navigate("/login", { replace: true });
  };

  // NAVIGATION ITEMS CONFIGURATION
  const navigationItems = [
    {
      label: "Dashboard",
      path: homePath,
      visible: true,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-5 h-5 shrink-0"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      ),
    },
    {
      label: "Cases",
      path: casesPath,
      visible: canViewCases,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-5 h-5 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-10Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8 12h8M8 15.5h5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      label: "IO Master",
      path: ioMasterPath,
      visible: canViewIO,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-5 h-5 shrink-0"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="8"
            r="3.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M5 20v-1.5a7 7 0 0 1 14 0V20H5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      label: "Reports",
      path: "/reports",
      visible: canViewReports,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-5 h-5 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M5 3.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M14 3.5V9h5M8 13h8M8 16.5h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    // {
    //   label: "Analysis",
    //   path: "/analysis",
    //   visible: true,
    //   icon: (
    //     <svg
    //       viewBox="0 0 24 24"
    //       fill="none"
    //       className="w-5 h-5 shrink-0"
    //       aria-hidden="true"
    //     >
    //       <path
    //         d="M3 13.2L7 9.2L11 13.2L21 3.2"
    //         stroke="currentColor"
    //         strokeWidth="1.8"
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //       />
    //       <path
    //         d="M16 3.2H21V8.2"
    //         stroke="currentColor"
    //         strokeWidth="1.8"
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //       />
    //       <path
    //         d="M4 20.8H20"
    //         stroke="currentColor"
    //         strokeWidth="1.8"
    //         strokeLinecap="round"
    //       />
    //     </svg>
    //   ),
    // },
  ];

  // AVATAR COMPONENT
  const ProfileAvatar = ({ large = false }) => (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-xl",
        "border border-emerald-200 bg-emerald-50",
        "font-bold text-emerald-800",
        large ? "h-16 w-16 text-2xl" : "h-10 w-10 text-base",
      ].join(" ")}
    >
      {userInitial}
    </div>
  );

  // USER PROFILE MODAL
  const UserProfileModal = () => {
    if (!profileModalOpen) return null;

    const permissions = [
      { label: "View cases", value: userPerms?.can_view_cases },
      { label: "View IO Master", value: userPerms?.can_view_io },
      { label: "View reports", value: userPerms?.can_view_reports },
    ];

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setProfileModalOpen(false);
          }
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-profile-title"
          className="my-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl"
        >
          {/* MODAL HEADER */}
          <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-blue-50 px-5 py-4 sm:px-7">
            <div>
              <h2
                id="user-profile-title"
                className="text-lg font-bold text-blue-950 sm:text-xl"
              >
                User Profile
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Account information and access details
              </p>
            </div>

            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              aria-label="Close user profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* SCROLLABLE PROFILE CONTENT */}
          <div className="overflow-y-auto p-5 sm:p-7">
            {/* USER SUMMARY */}
            <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5 sm:flex-row sm:items-center">
              <ProfileAvatar large />

              <div className="min-w-0 flex-1">
                <h3 className="break-words text-xl font-bold text-blue-950">
                  {userLoading ? "Loading user..." : displayUsername}
                </h3>

                <p className="mt-1 break-words text-sm text-slate-600">
                  {displayEmail}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-bold tracking-wider text-emerald-800">
                    {formattedRole}
                  </span>

                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1",
                      "text-[10px] font-bold tracking-wider",
                      isUserActive
                        ? "border-emerald-200 bg-white text-emerald-800"
                        : "border-red-200 bg-white text-red-600",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        isUserActive ? "bg-emerald-500" : "bg-red-500",
                      ].join(" ")}
                    />
                    {isUserActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>
            </div>

            {/* ACCOUNT INFORMATION */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold text-blue-950">
                Account Information
              </h3>

              <div className="rounded-xl border border-slate-200 px-4">
                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    User ID
                  </span>
                  <span className="break-words text-sm font-semibold text-slate-800 sm:max-w-[65%] sm:text-right">
                    {displayUserId}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Username
                  </span>
                  <span className="break-words text-sm font-semibold text-slate-800 sm:max-w-[65%] sm:text-right">
                    {displayUsername}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Email Address
                  </span>
                  <span className="break-words text-sm font-semibold text-slate-800 sm:max-w-[65%] sm:text-right">
                    {displayEmail}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Role
                  </span>
                  <span className="break-words text-sm font-semibold text-slate-800 sm:max-w-[65%] sm:text-right">
                    {formattedRole}
                  </span>
                </div>

                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Account Status
                  </span>
                  <span className="break-words text-sm font-semibold text-slate-800 sm:max-w-[65%] sm:text-right">
                    {isUserActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* ACCESS PERMISSIONS */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold text-blue-950">
                Access Permissions
              </h3>

              <div className="rounded-xl border border-slate-200 px-4">
                {permissions.map((permission) => {
                  const allowed = !isNormalUser
                    ? true
                    : permission.value !== false;

                  return (
                    <div
                      key={permission.label}
                      className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0"
                    >
                      <span className="text-sm text-slate-600">
                        {permission.label}
                      </span>

                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                          "text-xs font-semibold",
                          allowed
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-600",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-1.5 w-1.5 rounded-full",
                            allowed ? "bg-emerald-500" : "bg-red-500",
                          ].join(" ")}
                        />
                        {allowed ? "Allowed" : "Restricted"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MODAL FOOTER */}
          <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-7">
            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Close
            </button>
          </div>
        </section>
      </div>
    );
  };

  // SIDEBAR NAVIGATION ITEMS COMPONENT
  const SidebarNavItems = ({ mobile = false }) => {
    const isCollapsed = sidebarCollapsed && !mobile;

    return (
      <nav
        className="flex flex-col gap-2"
        aria-label="Main navigation"
      >
        {navigationItems
          .filter((item) => item.visible)
          .map((item) => {
            const active = isActive(item.path);

            return (
              <button
                key={item.label}
                type="button"
                title={isCollapsed ? item.label : undefined}
                aria-label={item.label}
                onClick={() => goTo(item.path)}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative flex w-full items-center rounded-xl py-3.5",
                  "text-sm font-semibold transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-2"
                    : "gap-3 px-3.5",
                  active
                    ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-blue-950",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-emerald-700" />
                )}

                <span
                  className={[
                    "shrink-0 transition-colors",
                    active
                      ? "text-emerald-700"
                      : "text-slate-400 group-hover:text-emerald-700",
                  ].join(" ")}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate text-left text-sm font-bold">
                      {item.label}
                    </span>

                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    )}
                  </>
                )}
              </button>
            );
          })}
      </nav>
    );
  };

  // PROFILE BUTTON COMPONENT
  const ProfileButton = ({ mobile = false }) => {
    const isCollapsed = sidebarCollapsed && !mobile;

    return (
      <button
        type="button"
        title={
          isCollapsed
            ? `User Profile: ${displayUsername}`
            : "View user profile"
        }
        aria-label="View user profile"
        onClick={() => {
          setMobileMenuOpen(false);
          setProfileModalOpen(true);
        }}
        className={[
          "flex items-center rounded-xl border transition-all duration-200",
          mobile
            ? "w-full gap-3 p-3 text-left"
            : isCollapsed
              ? "mx-auto h-11 w-11 justify-center"
              : "w-full gap-3 p-3 text-left",
          "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50 shadow-xs",
        ].join(" ")}
      >
        <ProfileAvatar />

        {!isCollapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold text-blue-950">
              {userLoading ? "Loading..." : displayUsername}
            </p>

            <p className="mt-0.5 truncate text-xs font-semibold tracking-wider text-slate-500">
              {formattedRole}
            </p>
          </div>
        )}
      </button>
    );
  };

  // DESKTOP FIXED SIDEBAR
  const DesktopSidebar = () => (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 hidden flex-col overflow-x-hidden",
        "border-r border-slate-200 bg-white shadow-lg shadow-slate-900/5",
        "transition-[width] duration-300 ease-in-out lg:flex",
        sidebarCollapsed ? "w-[84px]" : "w-[272px]",
      ].join(" ")}
      aria-label="Main Navigation Sidebar"
    >
      {/* BRAND COLOR ACCENT BAR */}
      <div className="h-1 shrink-0 bg-gradient-to-r from-emerald-800 via-emerald-500 to-amber-400" />

      {/* SIDEBAR HEADER */}
      <div
        className={[
          "flex min-h-[92px] items-center border-b border-slate-100",
          sidebarCollapsed
            ? "flex-col justify-center gap-2 px-1 py-3"
            : "justify-between px-4 sm:px-5",
        ].join(" ")}
      >
        {/* BRAND NAME */}
        {!sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => goTo(homePath)}
            title="Go to ARTHBODH home"
            aria-label="Go to ARTHBODH home"
            className="group flex flex-col items-start justify-center text-left focus-visible:outline-none select-none"
          >
            <div className="flex items-baseline leading-none tracking-tight">
              <span className="text-[27px] font-black text-emerald-700 transition-colors group-hover:text-emerald-800">
                अर्थ
              </span>

              <span className="ml-0.5 text-[27px] font-extrabold text-blue-950 transition-colors group-hover:text-emerald-700">
                BODH
              </span>
            </div>

            <span className="mt-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              BANKING ANALYTICAL SYSTEM
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(homePath)}
            title="ARTHBODH — Banking Analytical System"
            aria-label="ARTHBODH home"
            className="group inline-flex shrink-0 items-baseline justify-center whitespace-nowrap leading-none select-none focus-visible:outline-none transition-transform hover:scale-105"
          >
            <span className="shrink-0 text-[13.5px] font-black text-emerald-700 tracking-tight transition-colors group-hover:text-emerald-800">
              अर्थ
            </span>

            <span className="shrink-0 ml-0.5 text-[13.5px] font-extrabold text-blue-950 tracking-tight transition-colors group-hover:text-emerald-700">
              BODH
            </span>
          </button>
        )}

        {/* COLLAPSE / EXPAND BUTTON */}
        <button
          type="button"
          onClick={() =>
            setSidebarCollapsed((previous) => !previous)
          }
          title={
            sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          aria-label={
            sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          aria-expanded={!sidebarCollapsed}
          className={[
            "flex shrink-0 items-center justify-center rounded-xl border border-slate-200",
            "bg-slate-50 text-slate-600 transition-all duration-200",
            "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 shadow-xs",
            sidebarCollapsed ? "h-7 w-7" : "h-8 w-8",
          ].join(" ")}
        >
          {sidebarCollapsed ? (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      {/* SYSTEM STATUS */}
      <div
        title="System online & healthy"
        className={[
          "mx-3 mt-4 flex items-center rounded-xl border border-emerald-100 bg-emerald-50/80 transition-all",
          sidebarCollapsed
            ? "justify-center p-2.5"
            : "gap-2.5 px-3 py-3",
        ].join(" ")}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
        </span>

        {!sidebarCollapsed && (
          <span className="truncate whitespace-nowrap text-xs font-bold tracking-wider text-emerald-800">
            SYSTEM ONLINE
          </span>
        )}
      </div>

      {/* NAVIGATION MENU */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">
        {!sidebarCollapsed && (
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Main Menu
          </p>
        )}

        <SidebarNavItems />
      </div>

      {/* USER PROFILE AND LOGOUT */}
      <div className="border-t border-slate-200/80 p-3">
        <div
          className={
            sidebarCollapsed
              ? "flex flex-col items-center gap-2.5"
              : "flex flex-col gap-2.5"
          }
        >
          <ProfileButton />

          <button
            type="button"
            title={sidebarCollapsed ? "Logout" : undefined}
            aria-label="Logout"
            onClick={handleLogout}
            className={[
              "flex items-center rounded-xl border border-red-100",
              "text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600",
              sidebarCollapsed
                ? "mx-auto h-11 w-11 justify-center"
                : "w-full gap-3 px-4 py-3",
            ].join(" ")}
          >
            <LogoutIcon />
            {!sidebarCollapsed && (
              <span className="whitespace-nowrap">Logout</span>
            )}
          </button>
        </div>

        {/* SIDEBAR FOOTER */}
        {!sidebarCollapsed && (
          <div className="mt-3 border-t border-slate-100 pt-2 text-center">
            <p className="text-center text-xs text-slate-400">
              ARTHBODH Financial Intelligence
            </p>
          </div>
        )}
      </div>
    </aside>
  );

  // MOBILE NAVIGATION (HEADER + OVERLAY DRAWER)
  const MobileNavigation = () => (
    <div className="lg:hidden">
      {/* MOBILE STICKY TOP HEADER */}
      <header className="sticky top-0 z-40 flex min-h-[74px] items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
        <button
          type="button"
          onClick={() => goTo(homePath)}
          className="flex min-w-0 flex-col items-start leading-none focus-visible:outline-none select-none text-left"
          title="ARTHBODH — Banking Analytical System"
          aria-label="ARTHBODH home"
        >
          <div className="flex items-baseline leading-none tracking-tight">
            <span className="text-2xl font-black text-emerald-700">अर्थ</span>
            <span className="ml-0.5 text-2xl font-extrabold text-blue-950">BODH</span>
          </div>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Financial Intelligence
          </p>
        </button>

        <div className="flex items-center gap-2">
          {/* Quick Profile Icon on Mobile */}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            aria-label="User profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-800"
          >
            {userInitial}
          </button>

          {/* Menu Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((previous) => !previous)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MOBILE DRAWER */}
      <aside
        className={`fixed bottom-0 left-0 top-[74px] z-50 flex w-[290px] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* DRAWER BRAND */}
        <div className="flex min-h-[82px] items-center gap-3 border-b border-slate-100 px-5">
          <button
            type="button"
            onClick={() => goTo(homePath)}
            className="flex min-w-0 flex-col items-start leading-none select-none text-left"
          >
            <div className="flex items-baseline leading-none tracking-tight">
              <span className="text-xl font-black text-emerald-700">अर्थ</span>
              <span className="ml-0.5 text-xl font-extrabold text-blue-950">BODH</span>
            </div>
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Financial Intelligence
            </p>
          </button>
        </div>

        {/* DRAWER USER PROFILE */}
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setProfileModalOpen(true);
          }}
          className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50"
        >
          <ProfileAvatar />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {displayUsername}
            </p>
            <p className="truncate text-xs text-slate-500">
              {formattedRole}
            </p>
          </div>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* DRAWER NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Main Menu
          </p>

          <SidebarNavItems mobile />
        </div>

        {/* DRAWER FOOTER */}
        <div className="border-t border-slate-200 p-3">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold tracking-wider text-emerald-800">
              SYSTEM ONLINE
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogoutIcon />
            <span>Logout</span>
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            ARTHBODH Financial Intelligence
          </p>
        </div>
      </aside>
    </div>
  );

  // MAIN USER NAVBAR COMPONENT RENDER
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          aside {
            transition: none !important;
          }
        }
      `}</style>
      <DesktopSidebar />
      <MobileNavigation />
      <UserProfileModal />
    </>
  );
}

// LOGOUT ICON
const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 15l3-3m0 0l-3-3m3 3H9"
    />
  </svg>
);

export default UserNavbar;