import { apiRequest } from "./client";

/**
 * List audit logs with pagination and filters.
 * Client Admins are automatically scoped by backend to their company.
 * SuperAdmins can optionally filter by clientId.
 */
export function getAuditLogs(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.page_size) query.append("page_size", params.page_size);
  if (params.action) query.append("action", params.action);
  if (params.entity_type) query.append("entity_type", params.entity_type);
  if (params.entity_id) query.append("entity_id", params.entity_id);
  if (params.user_id) query.append("user_id", params.user_id);
  if (params.client_id) query.append("client_id", params.client_id);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);

  const qs = query.toString();
  const url = qs ? `/api/v1/audit-logs?${qs}` : "/api/v1/audit-logs";

  return apiRequest(url, {
    method: "GET",
  });
}

/**
 * Get audit statistics.
 * Client Admins receive own company stats.
 * SuperAdmins receive global or client-filtered stats.
 */
export function getAuditStats(clientId = null) {
  const url = clientId
    ? `/api/v1/audit-logs/stats?client_id=${clientId}`
    : "/api/v1/audit-logs/stats";

  return apiRequest(url, {
    method: "GET",
  });
}
