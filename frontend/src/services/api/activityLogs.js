import { apiRequest } from "./client";

/**
 * ============================================================
 * USER ACTIVITY / AUDIT LOGS APIs
 * ============================================================
 */

/**
 * Retrieve paginated activity logs for the currently authenticated user.
 * Role-isolated: Backend strictly inspects current_user.id.
 */
export function getMyActivityLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search.trim());
  if (params.module) query.append("module", params.module);
  if (params.action) query.append("action", params.action);
  if (params.status) query.append("status", params.status);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.page) query.append("page", String(params.page));
  if (params.page_size) query.append("page_size", String(params.page_size));

  const qs = query.toString();
  return apiRequest(`/api/v1/audit-logs/me${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

/**
 * Retrieve summary KPIs and analytics chart datasets for the currently authenticated user.
 */
export function getMyActivitySummary(params = {}) {
  const query = new URLSearchParams();
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);

  const qs = query.toString();
  return apiRequest(`/api/v1/audit-logs/me/summary${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

/**
 * Record a client-side user action (such as page view, report export, filter change).
 */
export function recordActivity(payload = {}) {
  return apiRequest("/api/v1/audit-logs/activity", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch((err) => {
    // Non-blocking telemetry
    console.debug("Failed to record activity log:", err);
  });
}
