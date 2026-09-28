import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

/* ============================================================
   LOCAL STORAGE KEYS
============================================================ */

const TOKEN_KEY = "antidrone_access_token";
const REFRESH_TOKEN_KEY = "antidrone_refresh_token";
const USER_KEY = "antidrone_user";
const USER_ID_KEY = "bas_user_id";

/* ============================================================
   AUTH PROVIDER
============================================================ */

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  /* ==========================================================
     RESTORE AUTHENTICATION STATE
  ========================================================== */

  useEffect(() => {
    try {
      const storedToken =
        localStorage.getItem(TOKEN_KEY);

      const storedRefreshToken =
        localStorage.getItem(REFRESH_TOKEN_KEY);

      const storedUser =
        localStorage.getItem(USER_KEY);

      const storedUserId =
        localStorage.getItem(USER_ID_KEY);

      /*
       * Restore authentication state.
       *
       * We now require:
       *
       * 1. Access token
       * 2. Refresh token
       * 3. User information
       */

      if (
        storedToken &&
        storedRefreshToken &&
        storedUser
      ) {
        const parsedUser =
          JSON.parse(storedUser);

        /*
         * Validate stored user.
         */

        if (
          parsedUser &&
          parsedUser.id !== undefined &&
          parsedUser.id !== null &&
          parsedUser.username &&
          parsedUser.role
        ) {
          setToken(storedToken);
          setUser(parsedUser);

          /*
           * Make sure the dedicated user ID
           * also exists.
           *
           * This supports users who logged in
           * before bas_user_id was introduced.
           */

          if (!storedUserId) {
            localStorage.setItem(
              USER_ID_KEY,
              String(parsedUser.id)
            );
          }
        } else {
          /*
           * Stored user information is invalid.
           * Clear all authentication data.
           */

          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(
            REFRESH_TOKEN_KEY
          );
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(USER_ID_KEY);
        }
      } else {
        /*
         * One or more authentication values
         * are missing.
         *
         * Clear stale authentication data.
         */

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(
          REFRESH_TOKEN_KEY
        );
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(USER_ID_KEY);
      }
    } catch (error) {
      console.error(
        "Failed to restore authentication state:",
        error
      );

      /*
       * Clear all invalid authentication data.
       */

      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(
        REFRESH_TOKEN_KEY
      );
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_ID_KEY);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  /* ==========================================================
     LOGIN
  ========================================================== */

  function login(authData) {
    const accessToken =
      authData?.access_token;

    const refreshToken =
      authData?.refresh_token;

    const authenticatedUser =
      authData?.user;

    /*
     * Validate authentication response.
     */

    if (
      !accessToken ||
      !refreshToken ||
      !authenticatedUser
    ) {
      throw new Error(
        "Invalid authentication response."
      );
    }

    /*
     * Validate user ID.
     */

    if (
      authenticatedUser.id === undefined ||
      authenticatedUser.id === null
    ) {
      throw new Error(
        "Authentication response does not contain a user ID."
      );
    }

    /*
     * Validate username.
     */

    if (!authenticatedUser.username) {
      throw new Error(
        "Authentication response does not contain a username."
      );
    }

    /*
     * Validate role.
     */

    if (!authenticatedUser.role) {
      throw new Error(
        "Authentication response does not contain a user role."
      );
    }

    /* ----------------------------------------------------------
       Store access token
    ---------------------------------------------------------- */

    localStorage.setItem(
      TOKEN_KEY,
      accessToken
    );

    /* ----------------------------------------------------------
       Store refresh token
    ---------------------------------------------------------- */

    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refreshToken
    );

    /* ----------------------------------------------------------
       Store complete user object
    ---------------------------------------------------------- */

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(authenticatedUser)
    );

    /* ----------------------------------------------------------
       Store dedicated user ID
    ---------------------------------------------------------- */

    localStorage.setItem(
      USER_ID_KEY,
      String(authenticatedUser.id)
    );

    /* ----------------------------------------------------------
       Update React state
    ---------------------------------------------------------- */

    setToken(accessToken);
    setUser(authenticatedUser);
  }

  /* ==========================================================
     LOGOUT
  ========================================================== */

  function logout() {
    /*
     * Remove access token.
     */

    localStorage.removeItem(
      TOKEN_KEY
    );

    /*
     * Remove refresh token.
     */

    localStorage.removeItem(
      REFRESH_TOKEN_KEY
    );

    /*
     * Remove complete user object.
     */

    localStorage.removeItem(
      USER_KEY
    );

    /*
     * Remove dedicated user ID.
     */

    localStorage.removeItem(
      USER_ID_KEY
    );

    /*
     * Clear React state.
     */

    setToken(null);
    setUser(null);
  }

  /* ==========================================================
     AUTHENTICATION STATE
  ========================================================== */

  const isAuthenticated = Boolean(
    token && user
  );

  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const value = useMemo(
    () => ({
      token,

      user,

      /*
       * Direct access to logged-in user's ID.
       *
       * Example:
       *
       * const { userId } = useAuth();
       */

      userId: user?.id ?? null,

      isAuthenticated,

      isInitializing,

      login,

      logout,
    }),
    [
      token,
      user,
      isAuthenticated,
      isInitializing,
    ]
  );

  /* ==========================================================
     PROVIDER
  ========================================================== */

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================================================
   USE AUTH
============================================================ */

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider"
    );
  }

  return context;
}