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
    file_ids = null,
    search = "",
    counterparty_name = null,
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
    sortBy = "",
    sortOrder = "asc",
    page = 1,
    pageSize = 50,
  } = {}
) {
  const params = new URLSearchParams();

  if (file_ids) {
    params.append("file_ids", file_ids);
  }

  if (search.trim()) {
    params.append("search", search.trim());
  }

  if (counterparty_name) {
    params.append("counterparty_name", counterparty_name);
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
    params.append("mode", channel);
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

  if (excludeKeyword && excludeKeyword.trim()) {
    params.append("exclude_keyword", excludeKeyword.trim());
  }
 if (sortBy) {
    params.append("sort_by", sortBy);
  }

  if (sortOrder) {
    params.append("sort_order", sortOrder);
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

export function getCaseTransactionSummary(caseId, file_ids = null) {
  let url = `/api/v1/bank-transactions/case/${caseId}/summary`;
  if (file_ids) {
    url += `?file_ids=${encodeURIComponent(file_ids)}`;
  }
  return apiRequest(
    url,
    {
      method: "GET",
    }
  );
}

export function getCaseModeWise(caseId, fileIds = []) {
  const params = new URLSearchParams();
  if (fileIds && fileIds.length > 0) {
    params.append("file_ids", fileIds.join(","));
  }
  const url = params.toString() 
    ? `/api/v1/bank-transactions/case/${caseId}/mode-wise?${params.toString()}`
    : `/api/v1/bank-transactions/case/${caseId}/mode-wise`;
    
  return apiRequest(url, { method: "GET" });
}

export function getTransactionModes() {
  return apiRequest(
    `/api/v1/bank-transactions/transaction-modes`,
    {
      method: "GET",
    }
  );
}
export function getTransactionRelationships(caseId, filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.fileIds && filters.fileIds.length > 0) {
    params.append('file_ids', filters.fileIds.join(','));
  }
  
  if (filters.transactionMode && filters.transactionMode !== 'All') {
    params.append('transaction_mode', filters.transactionMode);
  }
  
  if (filters.minAmount) {
    params.append('min_amount', filters.minAmount);
  }
  
  if (filters.maxAmount) {
    params.append('max_amount', filters.maxAmount);
  }
  
  if (filters.transactionType && filters.transactionType !== 'All') {
    params.append('transaction_type', filters.transactionType);
  }

  if (filters.startDate) {
    params.append('start_date', filters.startDate);
  }

  if (filters.endDate) {
    params.append('end_date', filters.endDate);
  }
  
  const url = params.toString()
    ? `/api/v1/bank-transactions/case/${caseId}/transaction-relationships?${params.toString()}`
    : `/api/v1/bank-transactions/case/${caseId}/transaction-relationships`;
    
  return apiRequest(url, { method: "GET" });
}

export async function exportCaseTransactions(caseId, filterParams = {}) {
  const params = new URLSearchParams();
  
  if (filterParams.file_ids) params.append("file_ids", filterParams.file_ids);
  if (filterParams.search?.trim()) params.append("search", filterParams.search.trim());
  if (filterParams.dateFrom) params.append("date_from", filterParams.dateFrom);
  if (filterParams.dateTo) params.append("date_to", filterParams.dateTo);
  if (filterParams.transactionType) params.append("transaction_type", filterParams.transactionType);
  if (filterParams.minAmount !== "" && filterParams.minAmount !== null) params.append("min_amount", filterParams.minAmount);
  if (filterParams.maxAmount !== "" && filterParams.maxAmount !== null) params.append("max_amount", filterParams.maxAmount);
  if (filterParams.channel) params.append("mode", filterParams.channel);
  if (filterParams.minBalance !== "" && filterParams.minBalance !== null) params.append("min_balance", filterParams.minBalance);
  if (filterParams.maxBalance !== "" && filterParams.maxBalance !== null) params.append("max_balance", filterParams.maxBalance);
  if (filterParams.hasChequeOnly) params.append("has_cheque_only", filterParams.hasChequeOnly);
  if (filterParams.excludeKeyword?.trim()) params.append("exclude_keyword", filterParams.excludeKeyword.trim());
  if (filterParams.sortBy) params.append("sort_by", filterParams.sortBy);
  if (filterParams.sortOrder) params.append("sort_order", filterParams.sortOrder);

  const blob = await apiRequest(`/api/v1/bank-transactions/case/${caseId}/export?${params.toString()}`, {
    method: "GET",
    responseType: 'blob'
  });
  
  return blob;
}

export function getCounterpartyAnalysis(caseId, fileIds = []) {
  const params = new URLSearchParams();
  if (fileIds && fileIds.length > 0) {
    params.append("file_ids", fileIds.join(","));
  }
  const url = params.toString() 
    ? `/api/v1/bank-transactions/case/${caseId}/counterparty-analysis?${params.toString()}`
    : `/api/v1/bank-transactions/case/${caseId}/counterparty-analysis`;
    
  return apiRequest(url, { method: "GET" });
}
