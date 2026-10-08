filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'a', encoding='utf-8') as f:
    f.write('''
export function getFinancialAnalysis(caseId, filterParams = {}) {
  const params = new URLSearchParams();
  
  if (filterParams.fileIds && filterParams.fileIds.length > 0) {
    params.append('file_ids', filterParams.fileIds.join(','));
  }
  if (filterParams.search?.trim()) params.append("search", filterParams.search.trim());
  if (filterParams.dateFrom) params.append("date_from", filterParams.dateFrom);
  if (filterParams.dateTo) params.append("date_to", filterParams.dateTo);
  if (filterParams.transactionType) params.append("transaction_type", filterParams.transactionType);
  if (filterParams.minAmount !== "" && filterParams.minAmount !== null) params.append("min_amount", filterParams.minAmount);
  if (filterParams.maxAmount !== "" && filterParams.maxAmount !== null) params.append("max_amount", filterParams.maxAmount);
  if (filterParams.channel) params.append("mode", filterParams.channel);
  if (filterParams.counterparty_name) params.append("counterparty_name", filterParams.counterparty_name);

  const url = params.toString()
    ? /api/v1/bank-transactions/case//financial-analysis?
    : /api/v1/bank-transactions/case//financial-analysis;
    
  return apiRequest(url, { method: "GET" });
}
''')
