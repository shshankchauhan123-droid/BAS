import { apiRequest } from "./client";

/**
 * List all clients (SuperAdmin only).
 */
export function getClients() {
  return apiRequest("/api/v1/clients", {
    method: "GET",
  });
}

/**
 * Get single client by ID.
 */
export function getClientById(clientId) {
  return apiRequest(`/api/v1/clients/${clientId}`, {
    method: "GET",
  });
}

/**
 * Create a new client and its primary Client Admin (SuperAdmin only).
 * 
 * Payload:
 * {
 *   name: string,
 *   company_code: string,
 *   max_users: number,
 *   admin: {
 *     username: string,
 *     email: string,
 *     password: string
 *   }
 * }
 */
export function createClient(clientData) {
  return apiRequest("/api/v1/clients", {
    method: "POST",
    body: JSON.stringify(clientData),
  });
}

/**
 * Toggle or update client is_active status (SuperAdmin only).
 */
export function updateClientStatus(clientId, isActive) {
  return apiRequest(`/api/v1/clients/${clientId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

/**
 * Update client max_users quota (SuperAdmin only).
 */
export function updateClientMaxUsers(clientId, maxUsers) {
  return apiRequest(`/api/v1/clients/${clientId}/max-users`, {
    method: "PATCH",
    body: JSON.stringify({ max_users: maxUsers }),
  });
}
