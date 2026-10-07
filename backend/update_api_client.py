filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''export function getCaseTransactionSummary(caseId, file_ids = null) {
  let url = /api/v1/bank-transactions/case//summary;
  if (file_ids) {
    url += ?file_ids=;
  }
  return apiRequest(
    url,
    {
      method: "GET",
    }
  );
}'''

replacement = '''export function getCaseTransactionSummary(caseId, file_ids = null, mode = null) {
  const params = new URLSearchParams();
  if (file_ids) params.append("file_ids", file_ids);
  if (mode) params.append("mode", mode);
  
  const qs = params.toString();
  const url = qs ? /api/v1/bank-transactions/case//summary? : /api/v1/bank-transactions/case//summary;
  
  return apiRequest(
    url,
    {
      method: "GET",
    }
  );
}'''

text = text.replace(target, replacement)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated API client!")
