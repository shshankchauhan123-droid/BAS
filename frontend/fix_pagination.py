import os

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''  function goToPreviousTransactionPage() {
  if (transactionPage <= 1) {
    return;
  }

  loadFilteredTransactions(transactionPage - 1);
}

function goToNextTransactionPage() {
  if (transactionPage >= transactionTotalPages) {
    return;
  }

  loadFilteredTransactions(transactionPage + 1);
}'''

new = '''  function goToPreviousTransactionPage() {
  if (transactionPage <= 1) {
    return;
  }
  if (selectedTransactionFileId) {
    loadTransactions(selectedTransactionFileId, transactionPage - 1);
  } else {
    loadFilteredTransactions(transactionPage - 1);
  }
}

function goToNextTransactionPage() {
  if (transactionPage >= transactionTotalPages) {
    return;
  }
  if (selectedTransactionFileId) {
    loadTransactions(selectedTransactionFileId, transactionPage + 1);
  } else {
    loadFilteredTransactions(transactionPage + 1);
  }
}'''

content = content.replace(old, new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
