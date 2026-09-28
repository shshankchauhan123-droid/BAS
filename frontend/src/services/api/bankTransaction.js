import { apiRequest } from "./client";

export function getFileTransactions(
  fileId,
  page = 1,
  pageSize = 50
) {
  return apiRequest(
    `/api/v1/bank-transactions/file/${fileId}?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
    }
  );
}

export function getCaseTransactions(
  caseId,
  page = 1,
  pageSize = 50
) {
  return apiRequest(
    `/api/v1/bank-transactions/case/${caseId}?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
    }
  );
}

export function searchCaseTransactions(
  caseId,
  {
    search = "",
    dateFrom = "",
    dateTo = "",
    transactionType = "",
    minAmount = "",
    maxAmount = "",
    page = 1,
    pageSize = 50,
  } = {}
) {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.append("search", search.trim());
  }

  if (dateFrom) {
    params.append("date_from", dateFrom);
  }

  if (dateTo) {
    params.append("date_to", dateTo);
  }

  if (transactionType) {
    params.append("transaction_type", transactionType);
  }

  if (minAmount !== "") {
    params.append("min_amount", minAmount);
  }

  if (maxAmount !== "") {
    params.append("max_amount", maxAmount);
  }

  params.append("page", page);
  params.append("page_size", pageSize);

  return apiRequest(
    `/api/v1/bank-transactions/case/${caseId}/search?${params.toString()}`,
    {
      method: "GET",
    }
  );
}