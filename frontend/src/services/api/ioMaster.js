import { apiRequest } from "./client";

/**
 * Fetch all Investigating Officers (IO) created by the logged-in user,
 * or for an assigned user if called by an Admin.
 */
export function getIOMasters(userId = null) {
  const url = userId ? `/api/v1/io-master/?user_id=${userId}` : "/api/v1/io-master/";
  return apiRequest(url, {
    method: "GET",
  });
}

/**
 * Fetch a single Investigating Officer by ID.
 */
export function getIOMaster(ioId) {
  return apiRequest(`/api/v1/io-master/${ioId}`, {
    method: "GET",
  });
}

/**
 * Create a new Investigating Officer.
 * Fields:
 * - officer_name (string)
 * - designation (string)
 * - police_station (string)
 */
export function createIOMaster({ officer_name, designation, police_station }, userId = null) {
  const url = userId ? `/api/v1/io-master/?user_id=${userId}` : "/api/v1/io-master/";
  return apiRequest(url, {
    method: "POST",
    body: JSON.stringify({
      officer_name: officer_name.trim(),
      designation: designation.trim(),
      police_station: police_station.trim(),
    }),
  });
}

/**
 * Update an existing Investigating Officer.
 */
export function updateIOMaster(ioId, data) {
  const payload = {};
  if (data.officer_name !== undefined) payload.officer_name = data.officer_name.trim();
  if (data.designation !== undefined) payload.designation = data.designation.trim();
  if (data.police_station !== undefined) payload.police_station = data.police_station.trim();

  return apiRequest(`/api/v1/io-master/${ioId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Delete an Investigating Officer.
 */
export function deleteIOMaster(ioId) {
  return apiRequest(`/api/v1/io-master/${ioId}`, {
    method: "DELETE",
  });
}
