filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\services\api\bankTransaction.js'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

new_func = '''
export function getCounterpartyAnalysis(caseId, fileIds = []) {
  const params = new URLSearchParams();
  if (fileIds && fileIds.length > 0) {
    params.append("file_ids", fileIds.join(","));
  }
  const url = params.toString() 
    ? /api/v1/bank-transactions/case//counterparty-analysis?
    : /api/v1/bank-transactions/case//counterparty-analysis;
    
  return apiRequest(url, { method: "GET" });
}
'''
with open(filepath, 'a', encoding='utf-8') as f:
    f.write(new_func)
print("Updated bankTransaction.js")
