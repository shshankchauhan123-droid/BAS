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
}) {
  return apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
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