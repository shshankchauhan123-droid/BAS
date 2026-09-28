import { apiRequest } from "./client";

/**
 * Create a new case.
 *
 * IMPORTANT:
 * We intentionally do NOT send created_by.
 * The backend gets the logged-in user's ID from the JWT token.
 */
export function createCase({ case_name, description }) {
  return apiRequest("/api/v1/cases/", {
    method: "POST",
    body: JSON.stringify({
      case_name: case_name.trim(),
      description: description?.trim() || null,
    }),
  });
}

/**
 * Get cases belonging to the logged-in user.
 *
 * The JWT is automatically attached by apiRequest().
 * The backend determines which user's cases to return.
 */
export function getCases() {
  return apiRequest("/api/v1/cases/", {
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
  { case_name, description, status }
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