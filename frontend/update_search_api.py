filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

old_func_def = '''export function searchCaseTransactions(
  caseId,
  {
    file_ids = null,
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
    sortBy = "",
    sortOrder = "asc",
    page = 1,
    pageSize = 50,
  }
) {
  const params = new URLSearchParams();

  params.append("page", page);
  params.append("page_size", pageSize);'''

new_func_def = '''export function searchCaseTransactions(
  caseId,
  {
    file_ids = null,
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
    sortBy = "",
    sortOrder = "asc",
    counterparty_name = "",
    page = 1,
    pageSize = 50,
  }
) {
  const params = new URLSearchParams();

  params.append("page", page);
  params.append("page_size", pageSize);
  if (counterparty_name) params.append("counterparty_name", counterparty_name);'''

text = text.replace(old_func_def, new_func_def)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated searchCaseTransactions in bankTransaction.js")
