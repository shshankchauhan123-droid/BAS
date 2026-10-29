import { apiRequest } from "./client";


// ============================================================
// Upload file
// ============================================================

export function uploadFile(caseId, file, documentType = "BANK_STATEMENT", options = {}) {

  const formData = new FormData();

  formData.append("file", file);
  if (documentType) {
    formData.append("document_type", documentType);
  }
  if (options.clientId || options.client_id) {
    formData.append("client_id", options.clientId || options.client_id);
  }
  if (options.userId || options.user_id) {
    formData.append("user_id", options.userId || options.user_id);
  }

  return apiRequest(
    `/api/v1/files/${caseId}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
}


// ============================================================
// Get case files
// ============================================================

export function getCaseFiles(caseId, includeSuperseded = false, documentType = null) {

  const params = new URLSearchParams();
  if (includeSuperseded) params.append("include_superseded", "true");
  if (documentType) params.append("document_type", documentType);
  const query = params.toString() ? `?${params.toString()}` : "";

  return apiRequest(
    `/api/v1/files/case/${caseId}${query}`,
    {
      method: "GET",
    }
  );
}


// ============================================================
// Get authenticated file
// ============================================================

export function getFileView(fileId) {

  return apiRequest(
    `/api/v1/files/${fileId}/view`,
    {
      method: "GET",
      responseType: "blob",
    }
  );
}


// ============================================================
// Delete file
// ============================================================

export function deleteFile(fileId) {

  return apiRequest(
    `/api/v1/files/${fileId}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// Update file metadata
// ============================================================

export function updateFileDetails(fileId, payload) {
  return apiRequest(
    `/api/v1/files/${fileId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      }
    }
  );
}


// ============================================================
// Merge case files
// ============================================================

export function mergeFiles(caseId, payload) {
  return apiRequest(
    `/api/v1/files/case/${caseId}/merge`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
