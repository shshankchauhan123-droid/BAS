import { apiRequest } from "./client";

/**
 * Execute CIN Advance Search via backend FastAPI endpoint
 * @param {string} searchNumber - Company Identification Number (CIN), LLPIN, or registration search number
 */
export function searchCinAdvance(searchNumber) {
  const query = encodeURIComponent((searchNumber || "").trim());
  return apiRequest(`/api/v1/cin/advance-search?searchNumber=${query}`, {
    method: "GET",
  });
}
