import { apiRequest } from "./client";


// ============================================================
// Upload file
// ============================================================

export function uploadFile(caseId, file) {

  const formData = new FormData();

  formData.append("file", file);

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

export function getCaseFiles(caseId) {

  return apiRequest(
    `/api/v1/files/case/${caseId}`,
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