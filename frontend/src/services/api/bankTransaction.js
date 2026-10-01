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
    fileId = null,
    search = "",
    dateFrom = "",
    dateTo = "",
    transactionType = "",
    minAmount = "",
    maxAmount = "",
    channel = "",
    dayType = "",
    amountPattern = "",
    excludeKeyword = "",
    minBalance = "",
    maxBalance = "",
    isLowBalance = false,
    hasChequeOnly = false,
    hasReferenceOnly = false,
    sourcePage = null,
    page = 1,
    pageSize = 50,
  } = {}
) {
  const params = new URLSearchParams();

  if (fileId) {
    params.append("file_id", fileId);
  }

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

  if (minAmount !== "" && minAmount !== null && minAmount !== undefined) {
    params.append("min_amount", minAmount);
  }

  if (maxAmount !== "" && maxAmount !== null && maxAmount !== undefined) {
    params.append("max_amount", maxAmount);
  }

  if (channel) {
    params.append("channel", channel);
  }

  if (dayType) {
    params.append("day_type", dayType);
  }

  if (amountPattern) {
    params.append("amount_pattern", amountPattern);
  }

  if (excludeKeyword.trim()) {
    params.append("exclude_keyword", excludeKeyword.trim());
  }

  if (minBalance !== "" && minBalance !== null && minBalance !== undefined) {
    params.append("min_balance", minBalance);
  }

  if (maxBalance !== "" && maxBalance !== null && maxBalance !== undefined) {
    params.append("max_balance", maxBalance);
  }

  if (isLowBalance) {
    params.append("is_low_balance", "true");
  }

  if (hasChequeOnly) {
    params.append("has_cheque_only", "true");
  }

  if (hasReferenceOnly) {
    params.append("has_reference_only", "true");
  }

  if (sourcePage) {
    params.append("source_page", sourcePage);
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

export function getFileTransactionSummary(fileId) {
  return apiRequest(
    `/api/v1/bank-transactions/file/${fileId}/summary`,
    {
      method: "GET",
    }
  );
}