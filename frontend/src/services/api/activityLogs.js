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

/**
 * ============================================================
 * ROLE-BASED AUDIT & ACTIVITY LOGS (SUPER ADMIN & CLIENT)
 * ============================================================
 */

/**
 * Super Admin: Retrieve list of active companies for audit selection.
 */
export function getAuditCompanies() {
  return apiRequest("/api/v1/audit-logs/companies", {
    method: "GET",
  });
}

/**
 * Super Admin & Client: Retrieve users belonging to a company.
 * If companyId is omitted for Client Admin, their own company users are returned.
 */
export function getCompanyUsers(companyId = null) {
  const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiRequest(`/api/v1/audit-logs/company-users${query}`, {
    method: "GET",
  });
}

/**
 * Client: Retrieve users belonging to the authenticated client's company.
 */
export function getMyCompanyUsers() {
  return apiRequest("/api/v1/audit-logs/me/company-users", {
    method: "GET",
  });
}

/**
 * Retrieve paginated activity logs for a specific selected user with company authorization.
 */
export function getTargetUserActivityLogs(userId, params = {}) {
  const query = new URLSearchParams();
  if (params.company_id) query.append("company_id", String(params.company_id));
  if (params.search) query.append("search", params.search.trim());
  if (params.module) query.append("module", params.module);
  if (params.action) query.append("action", params.action);
  if (params.status) query.append("status", params.status);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.page) query.append("page", String(params.page));
  if (params.page_size) query.append("page_size", String(params.page_size));

  const qs = query.toString();
  return apiRequest(`/api/v1/audit-logs/user/${encodeURIComponent(userId)}${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

/**
 * Retrieve summary KPIs and analytics chart datasets for a specific selected user with company authorization.
 */
export function getTargetUserActivitySummary(userId, params = {}) {
  const query = new URLSearchParams();
  if (params.company_id) query.append("company_id", String(params.company_id));
  if (params.module) query.append("module", params.module);
  if (params.action) query.append("action", params.action);
  if (params.status) query.append("status", params.status);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.search) query.append("search", params.search.trim());

  const qs = query.toString();
  return apiRequest(`/api/v1/audit-logs/user/${encodeURIComponent(userId)}/summary${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

