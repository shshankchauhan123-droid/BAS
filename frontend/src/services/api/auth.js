import { apiRequest } from "./client";

export function signupUser({
  username,
  email,
  password,
}) {
  return apiRequest("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });
}

export function loginUser({
  username,
  password,
  company_code,
}) {
  return apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      company_code: company_code ? String(company_code).trim() : null,
    }),
  });
}

export function refreshAccessToken(
  refreshToken
) {
  return apiRequest("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
    skipAuthRefresh: true,
  });
}

/**
 * Change password on first login.
 */
export function changeFirstLoginPassword(newPassword) {
  return apiRequest("/api/v1/auth/first-login-password", {
    method: "POST",
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });
}

/**
 * Dismiss first login password change prompt (user decides to keep current password).
 */
export function dismissFirstLogin() {
  return apiRequest("/api/v1/auth/dismiss-first-login", {
    method: "POST",
  });
}