filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_block = '''        const res = await searchCaseTransactions(selectedCaseId, {
           file_ids: fileIdsArray.join(","),
           search: selectedCounterpartyName, // This searches description/cheque/etc. It's the best existing API field.
           page: cpPage,
           pageSize: 20
        });
        
        if (res?.data) {
           // We filter locally just to be absolutely sure we only show matching counterparties
           const filtered = res.data.filter(tx => 
             tx.counterparty_name && tx.counterparty_name.toUpperCase() === selectedCounterpartyName.toUpperCase()
           );
           setCpTransactions(filtered);
           setCpTotalPages(Number(res.total_pages) || 0);
        } else {
           setCpTransactions([]);
        }'''

new_block = '''        const res = await searchCaseTransactions(selectedCaseId, {
           file_ids: fileIdsArray.join(","),
           counterparty_name: selectedCounterpartyName,
           page: cpPage,
           pageSize: 20
        });
        
        if (res?.data) {
           setCpTransactions(res.data);
           setCpTotalPages(Number(res.total_pages) || 0);
        } else {
           setCpTransactions([]);
        }'''

text = text.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated CounterpartyIntelligenceReport filtering")
