import { apiRequest } from "./client";

/**
 * Create a new case.
 *
 * IMPORTANT:
 * We intentionally do NOT send created_by.
 * The backend gets the logged-in user's ID from the JWT token.
 */
export function createCase({ case_name, description, io_id, assigned_to, client_id }) {
  const body = {
    case_name: case_name.trim(),
    description: description?.trim() || null,
  };

  if (io_id !== undefined && io_id !== null && io_id !== "") {
    body.io_id = Number(io_id);
  }

  if (assigned_to !== undefined && assigned_to !== null && assigned_to !== "") {
    body.assigned_to = Number(assigned_to);
  }

  if (client_id !== undefined && client_id !== null && client_id !== "") {
    body.client_id = Number(client_id);
  }

  return apiRequest("/api/v1/cases/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Get cases belonging to the logged-in user.
 *
 * The JWT is automatically attached by apiRequest().
 * The backend determines which user's cases to return.
 */
export function getCases(userIdOrOptions = null, clientIdArg = null) {
  let userId = null;
  let clientId = null;

  if (typeof userIdOrOptions === "object" && userIdOrOptions !== null) {
    userId = userIdOrOptions.userId ?? userIdOrOptions.user_id ?? null;
    clientId = userIdOrOptions.clientId ?? userIdOrOptions.client_id ?? null;
  } else {
    userId = userIdOrOptions;
    clientId = clientIdArg;
  }

  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (clientId) params.append("client_id", clientId);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/cases/${query}`, {
    method: "GET",
  });
}

/**
 * Get one case.
 *
 * The backend verifies that the case belongs to
 * the currently authenticated user.
 */
export function getCase(caseId) {
  return apiRequest(`/api/v1/cases/${caseId}`, {
    method: "GET",
  });
}

/**
 * Update a case.
 *
 * The frontend does not send created_by.
 * Ownership is checked by the backend.
 */
export function updateCase(
  caseId,
  { case_name, description, status, io_id }
) {
  const payload = {};

  if (case_name !== undefined) {
    payload.case_name = case_name.trim();
  }

  if (description !== undefined) {
    payload.description = description?.trim() || null;
  }

  if (status !== undefined) {
    payload.status = status;
  }

  if (io_id !== undefined) {
    payload.io_id = io_id ? Number(io_id) : null;
  }

  return apiRequest(`/api/v1/cases/${caseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Archive a case.
 *
 * The backend performs the ownership check before archiving.
 */
export function deleteCase(caseId) {
  return apiRequest(`/api/v1/cases/${caseId}`, {
    method: "DELETE",
  });
}