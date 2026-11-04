import { apiRequest } from "./client";

/**
 * ============================================================
 * USER HELP & SUPPORT APIs
 * ============================================================
 */

export function createTicket(data) {
  if (data instanceof FormData) {
    return apiRequest("/api/v1/support/tickets", {
      method: "POST",
      body: data,
    });
  }
  return apiRequest("/api/v1/support/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function downloadMyTicketAttachment(ticketId, filename = "attachment") {
  const blob = await apiRequest(`/api/v1/support/tickets/my/${ticketId}/attachment`, {
    method: "GET",
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function getMyTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search.trim());
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.page) query.append("page", params.page);
  if (params.page_size) query.append("page_size", params.page_size);

  const qs = query.toString();
  return apiRequest(`/api/v1/support/tickets/my${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export function getMyTicketsSummary() {
  return apiRequest("/api/v1/support/tickets/my/summary", {
    method: "GET",
  });
}

export function getMyTicketDetails(ticketId) {
  return apiRequest(`/api/v1/support/tickets/my/${ticketId}`, {
    method: "GET",
  });
}

export function addMyTicketReply(ticketId, message) {
  return apiRequest(`/api/v1/support/tickets/my/${ticketId}/replies`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/**
 * ============================================================
 * SUPER ADMIN SUPPORT MANAGEMENT APIs
 * ============================================================
 */

export function getAdminTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search.trim());
  if (params.client_id) query.append("client_id", params.client_id);
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.category) query.append("category", params.category);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);
  if (params.page) query.append("page", params.page);
  if (params.page_size) query.append("page_size", params.page_size);

  const qs = query.toString();
  return apiRequest(`/api/v1/admin/support/tickets${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export function getAdminTicketsSummary() {
  return apiRequest("/api/v1/admin/support/tickets/summary", {
    method: "GET",
  });
}

export function getAdminTicketDetails(ticketId) {
  return apiRequest(`/api/v1/admin/support/tickets/${ticketId}`, {
    method: "GET",
  });
}

export function updateAdminTicket(ticketId, data) {
  return apiRequest(`/api/v1/admin/support/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function addAdminTicketReply(ticketId, data) {
  return apiRequest(`/api/v1/admin/support/tickets/${ticketId}/replies`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function downloadAdminTicketAttachment(ticketId, filename = "attachment") {
  const blob = await apiRequest(`/api/v1/admin/support/tickets/${ticketId}/attachment`, {
    method: "GET",
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
