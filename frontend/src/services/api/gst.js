import { apiRequest } from "./client";

/**
 * Execute GST Advance Search via backend FastAPI endpoint
 * Payload keys:
 * - gstNumber: string (15-character GSTIN)
 * - hsnDetails: boolean
 * - branchDetails: boolean
 * - filingDetails: boolean
 * - filingFrequency: boolean
 * - liabilityPaidDetails: boolean
 */
export function searchGstAdvance(payload) {
  return apiRequest("/api/v1/gst/advance-search", {
    method: "POST",
    body: JSON.stringify({
      gstNumber: (payload.gstNumber || "").trim().toUpperCase(),
      hsnDetails: Boolean(payload.hsnDetails),
      branchDetails: Boolean(payload.branchDetails),
      filingDetails: Boolean(payload.filingDetails),
      filingFrequency: Boolean(payload.filingFrequency),
      liabilityPaidDetails: Boolean(payload.liabilityPaidDetails),
    }),
  });
}
