import { apiRequest } from "./client";

export function getUserById(userId) {
  return apiRequest(`/api/v1/users/${userId}`, {
    method: "GET",
  });
}

/**
 * List users.
 * Client Admins see their company's users and quota.
 * SuperAdmins can optionally filter by clientId.
 */
export function getUsers(clientId = null) {
  const url = clientId ? `/api/v1/users?client_id=${clientId}` : "/api/v1/users";
  return apiRequest(url, {
    method: "GET",
  });
}

/**
 * Create a new user under the current actor's client company (or specified client for SuperAdmin).
 * 
 * Payload:
 * {
 *   username: string,
 *   email: string,
 *   password: string,
 *   role: string,
 *   client_id?: number
 * }
 */
export function createUser(userData) {
  return apiRequest("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

/**
 * Toggle user active/inactive status.
 */
export function updateUserStatus(userId, isActive) {
  return apiRequest(`/api/v1/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

/**
 * Update user permissions / rights (Case creation, file uploads, file updates, file deletions).
 */
export function updateUserPermissions(userId, permissions) {
  return apiRequest(`/api/v1/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify(permissions),
  });
}