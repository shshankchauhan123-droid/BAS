import { apiRequest } from "./client";

/**
 * Upload an NCRP Statement Excel file (.xlsx or .xls)
 */
export function uploadNcrpFile(caseId, file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (options.clientId || options.client_id) {
    formData.append("client_id", options.clientId || options.client_id);
  }
  if (options.userId || options.user_id) {
    formData.append("user_id", options.userId || options.user_id);
  }

  return apiRequest(`/api/v1/ncrp/${caseId}/upload`, {
    method: "POST",
    body: formData,
  });
}

/**
 * Get all NCRP files uploaded for a case
 */
export function getCaseNcrpFiles(caseId) {
  return apiRequest(`/api/v1/ncrp/case/${caseId}`, {
    method: "GET",
  });
}

/**
 * Get details for a specific NCRP file
 */
export function getNcrpFile(fileId, caseId = null) {
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}${query}`, {
    method: "GET",
  });
}

/**
 * View or download the original uploaded NCRP Excel workbook
 */
export function getNcrpFileView(fileId, caseId = null) {
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/view${query}`, {
    method: "GET",
    responseType: "blob",
  });
}

/**
 * Alias for downloading the original NCRP Excel workbook
 */
export function downloadNcrpFile(fileId, caseId = null) {
  return getNcrpFileView(fileId, caseId);
}

/**
 * Get transactions imported from an NCRP file with sheet filter, search, and pagination
 * Accepts either an options object or positional (fileId, skip, limit) for backward compatibility
 */
export function getNcrpTransactions(fileId, optionsOrSkip = 0, maybeLimit = 50) {
  let params = new URLSearchParams();

  if (typeof optionsOrSkip === "object" && optionsOrSkip !== null) {
    const opts = optionsOrSkip;
    if (opts.caseId) params.append("case_id", opts.caseId);
    if (opts.sheetName && opts.sheetName !== "ALL") params.append("sheet_name", opts.sheetName);
    if (opts.search) params.append("search", opts.search);
    if (opts.dateFrom) params.append("date_from", opts.dateFrom);
    if (opts.dateTo) params.append("date_to", opts.dateTo);
    if (opts.minAmount !== undefined && opts.minAmount !== "" && opts.minAmount !== null) {
      params.append("min_amount", opts.minAmount);
    }
    if (opts.maxAmount !== undefined && opts.maxAmount !== "" && opts.maxAmount !== null) {
      params.append("max_amount", opts.maxAmount);
    }
    if (opts.bankName && opts.bankName !== "ALL") params.append("bank_name", opts.bankName);
    if (opts.layer && opts.layer !== "ALL") params.append("layer", opts.layer);
    if (opts.acknowledgementNo && opts.acknowledgementNo !== "ALL") {
      params.append("acknowledgement_no", opts.acknowledgementNo);
    }
    if (opts.skip !== undefined) params.append("skip", opts.skip);
    if (opts.limit !== undefined) params.append("limit", opts.limit);
    if (opts.sortBy) params.append("sort_by", opts.sortBy);
    if (opts.sortOrder) params.append("sort_order", opts.sortOrder);
  } else {
    params.append("skip", optionsOrSkip);
    params.append("limit", maybeLimit);
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/transactions${queryString}`, {
    method: "GET",
  });
}

/**
 * Get aggregated layer-wise Sankey graph nodes, links, and KPI metrics
 */
export function getNcrpSankey(fileId, options = {}) {
  let params = new URLSearchParams();
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.layer && options.layer !== "ALL") params.append("layer", options.layer);
  if (options.acknowledgementNo && options.acknowledgementNo !== "ALL") {
    params.append("acknowledgement_no", options.acknowledgementNo);
  }
  if (options.sheetName && options.sheetName !== "ALL") params.append("sheet_name", options.sheetName);
  if (options.bankName && options.bankName !== "ALL") params.append("bank_name", options.bankName);
  if (options.search) params.append("search", options.search);
  if (options.dateFrom) params.append("date_from", options.dateFrom);
  if (options.dateTo) params.append("date_to", options.dateTo);
  if (options.minAmount !== undefined && options.minAmount !== "" && options.minAmount !== null) {
    params.append("min_amount", options.minAmount);
  }
  if (options.maxAmount !== undefined && options.maxAmount !== "" && options.maxAmount !== null) {
    params.append("max_amount", options.maxAmount);
  }
  if (options.moneyTransferOnly || options.money_transfer_only) {
    params.append("money_transfer_only", "true");
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/sankey${queryString}`, {
    method: "GET",
  });
}

/**
 * Delete an NCRP file and its associated transactions completely
 */
export function deleteNcrpFile(fileId, caseId = null) {
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}${query}`, {
    method: "DELETE",
  });
}

/**
 * Get worksheet-aware layer activity breakdown and non-overlapping KPIs
 */
export function getNcrpLayerActivity(fileId, options = {}) {
  const params = new URLSearchParams();
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.layer && options.layer !== "ALL") params.append("layer", options.layer);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/activity-breakdown${queryString}`, {
    method: "GET",
  });
}

/**
 * Get 360-degree account profile across transfers, withdrawals, and holds
 */
export function getNcrpAccountProfile(fileId, account, options = {}) {
  const params = new URLSearchParams();
  params.append("account", account);
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.rootAccount || options.root_account) {
    params.append("root_account", options.rootAccount || options.root_account);
  }
  if (options.layer && options.layer !== "ALL") params.append("layer", options.layer);
  if (options.moneyTransferOnly || options.money_transfer_only) {
    params.append("money_transfer_only", "true");
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/account-profile${queryString}`, {
    method: "GET",
  });
}

/**
 * Trace an account forward into subsequent higher layers
 */
export function getNcrpTraceNext(fileId, account, currentLayer = 1, options = {}) {
  const params = new URLSearchParams();
  params.append("account", account);
  params.append("current_layer", currentLayer);
  if (options.caseId) params.append("case_id", options.caseId);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/trace-next${queryString}`, {
    method: "GET",
  });
}

/**
 * Get hierarchical DAG money flow graph data from source suspect account
 */
export function getNcrpHierarchicalGraph(fileId, options = {}) {
  let params = new URLSearchParams();
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.rootAccount) params.append("root_account", options.rootAccount);
  if (options.expandAccount) params.append("expand_account", options.expandAccount);
  if (options.expandAll) params.append("expand_all", "true");
  if (options.expandedAccounts) {
    const expStr = Array.isArray(options.expandedAccounts)
      ? options.expandedAccounts.join(",")
      : options.expandedAccounts;
    params.append("expanded_accounts", expStr);
  }
  if (options.search) params.append("search", options.search);
  if (options.bankName && options.bankName !== "ALL") params.append("bank_name", options.bankName);
  if (options.layer && options.layer !== "ALL") params.append("layer", options.layer);
  if (options.minAmount !== undefined && options.minAmount !== "" && options.minAmount !== null) {
    params.append("min_amount", options.minAmount);
  }
  if (options.maxAmount !== undefined && options.maxAmount !== "" && options.maxAmount !== null) {
    params.append("max_amount", options.maxAmount);
  }
  if (options.dateFrom) params.append("date_from", options.dateFrom);
  if (options.dateTo) params.append("date_to", options.dateTo);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/hierarchical-graph${queryString}`, {
    method: "GET",
  });
}

/**
 * Get all distinct Layer 1 starting source accounts for an NCRP workbook
 */
export function getNcrpLayer1Sources(fileId, options = {}) {
  const params = new URLSearchParams();
  if (options.caseId) params.append("case_id", options.caseId);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/layer1-sources${queryString}`, {
    method: "GET",
  });
}

/**
 * Get distinct receivers for a sender from Money Transfer To worksheet
 */
export function getNcrpSenderReceivers(fileId, senderAccount, options = {}) {
  const params = new URLSearchParams();
  params.append("sender_account", senderAccount);
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.layer) params.append("layer", options.layer);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/receivers${queryString}`, {
    method: "GET",
  });
}

/**
 * Get individual original Money Transfer To transactions for an aggregated edge
 */
export function getNcrpEdgeTransactions(fileId, sourceAccount, targetAccount, options = {}) {
  const params = new URLSearchParams();
  params.append("source_account", sourceAccount);
  params.append("target_account", targetAccount);
  if (options.caseId) params.append("case_id", options.caseId);
  if (options.layer) params.append("layer", options.layer);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/ncrp/file/${fileId}/edge-transactions${queryString}`, {
    method: "GET",
  });
}




