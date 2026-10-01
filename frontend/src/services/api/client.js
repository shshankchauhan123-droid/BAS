const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is not configured"
  );
}


// ============================================================
// Token helpers
// ============================================================

function getAccessToken() {
  return localStorage.getItem(
    "antidrone_access_token"
  );
}


function getRefreshToken() {
  return localStorage.getItem(
    "antidrone_refresh_token"
  );
}


function saveTokens(
  accessToken,
  refreshToken
) {
  localStorage.setItem(
    "antidrone_access_token",
    accessToken
  );

  if (refreshToken) {
    localStorage.setItem(
      "antidrone_refresh_token",
      refreshToken
    );
  }
}


function clearTokens() {
  localStorage.removeItem(
    "antidrone_access_token"
  );

  localStorage.removeItem(
    "antidrone_refresh_token"
  );
}


// ============================================================
// Refresh state
// ============================================================

let refreshPromise = null;


// ============================================================
// Refresh access token
// ============================================================

async function refreshAccessToken() {

  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error(
      "Refresh token not found"
    );
  }


  // Prevent multiple simultaneous
  // refresh requests.

  if (!refreshPromise) {

    refreshPromise = fetch(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          refresh_token:
            refreshToken,
        }),
      }
    )
      .then(async (response) => {

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }


        if (!response.ok) {

          throw new Error(
            data?.detail ||
              "Unable to refresh authentication"
          );
        }


        return data;
      })
      .then((data) => {

        saveTokens(
          data.access_token,
          data.refresh_token
        );

        return data.access_token;
      })
      .catch((error) => {

        clearTokens();

        throw error;

      })
      .finally(() => {

        refreshPromise = null;

      });
  }


  return refreshPromise;
}


// ============================================================
// API request
// ============================================================

export async function apiRequest(
  endpoint,
  options = {}
) {

  const {
    skipAuthRefresh = false,
    responseType = "json",
    ...fetchOptions
  } = options;


  const token =
    getAccessToken();


  const isFormData =
    fetchOptions.body instanceof FormData;


  const headers = {
    ...fetchOptions.headers,
  };


  if (!isFormData) {

    headers["Content-Type"] =
      "application/json";
  }


  if (token) {

    headers.Authorization =
      `Bearer ${token}`;
  }


  let response;

  try {

    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...fetchOptions,
        headers,
      }
    );

  } catch (error) {
    console.error(`[API Network Error] Request to ${API_BASE_URL}${endpoint} failed:`, error);
    throw new Error(
      "Unable to connect to the backend server (FastAPI at " + API_BASE_URL + "). Please verify the backend is running."
    );
  }


  // ==========================================================
  // Access token expired
  // ==========================================================

  if (
    response.status === 401 &&
    !skipAuthRefresh
  ) {

    try {

      const newAccessToken =
        await refreshAccessToken();


      const retryHeaders = {
        ...fetchOptions.headers,
      };


      if (!isFormData) {

        retryHeaders["Content-Type"] =
          "application/json";
      }


      retryHeaders.Authorization =
        `Bearer ${newAccessToken}`;


      response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          ...fetchOptions,
          headers: retryHeaders,
        }
      );

    } catch (refreshError) {

      clearTokens();

      throw new Error(
        "Your session has expired. Please login again."
      );
    }
  }


  // ==========================================================
  // Error handling
  // ==========================================================

  if (!response.ok) {

    let data = null;

    try {

      data = await response.json();

    } catch {
      data = null;
    }


    let message = `Request failed with status ${response.status}`;

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .join(" | ");
    } else if (typeof data?.message === "string") {
      message = data.message;
    } else if (data?.detail && typeof data.detail === "object") {
      message = JSON.stringify(data.detail);
    }

    throw new Error(message);
  }


  // ==========================================================
  // Parse successful response
  // ==========================================================

  if (responseType === "blob") {

    return await response.blob();
  }


  return await response.json();
}