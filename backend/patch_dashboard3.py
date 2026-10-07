filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. Add modeSummaryData state
if "modeSummaryData" not in text:
    text = text.replace(
        'const [transactionTotal, setTransactionTotal] = useState(0);',
        'const [transactionTotal, setTransactionTotal] = useState(0);\n  const [modeSummaryData, setModeSummaryData] = useState(null);\n  const [isLoadingModeSummary, setIsLoadingModeSummary] = useState(false);'
    )

# 2. Add fetchModeSummary logic inside the existing useEffect for selectedMode
fetch_logic = '''    async function loadTransactions() {
      setIsTransactionsLoading(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await searchCaseTransactions(selectedCaseId, {
           file_ids: fileIdsArray.join(","),
           channel: selectedMode,
           page: transactionPage,
           pageSize: 20
        });
        if (res?.data) {
           setTransactions(res.data);
           setTransactionTotalPages(Number(res.total_pages) || 0);
           setTransactionTotal(Number(res.total) || 0);
        } else {
           setTransactions([]);
        }
      } catch (err) {
        console.error("Failed to fetch mode transactions:", err);
      } finally {
        setIsTransactionsLoading(false);
      }
    }
    
    async function loadModeSummary() {
      setIsLoadingModeSummary(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCaseTransactionSummary(selectedCaseId, fileIdsArray.join(","), selectedMode);
        if (res?.success) {
          setModeSummaryData(res.data);
        } else {
          setModeSummaryData(null);
        }
      } catch (err) {
        console.error("Failed to fetch mode summary:", err);
        setModeSummaryData(null);
      } finally {
        setIsLoadingModeSummary(false);
      }
    }

    loadTransactions();
    if (transactionPage === 1) {
      loadModeSummary();
    }'''
    
text = re.sub(r'async function loadTransactions\(\) \{.*loadTransactions\(\);', fetch_logic, text, flags=re.DOTALL)

# 3. Handle deselection cleanup
text = text.replace(
    'if (!selectedMode || selectedFileIds.size === 0) {\n      setTransactions([]);\n      return;\n    }',
    'if (!selectedMode || selectedFileIds.size === 0) {\n      setTransactions([]);\n      setModeSummaryData(null);\n      return;\n    }'
)

# 4. Add the KPI UI before the transaction table
kpi_ui = '''              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-emerald-400">
                  Transactions for Mode: {selectedMode}
                </h2>
                <span className="text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full">
                  Total: {transactionTotal}
                </span>
              </div>
              
              {/* Mode Specific KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Highest Debit Amount</h3>
                  {isLoadingModeSummary ? (
                    <div className="h-8 w-24 bg-white/5 animate-pulse rounded"></div>
                  ) : (
                    <div className="text-xl font-semibold text-rose-400">
                      ₹ {modeSummaryData?.highest_debit ? Number(modeSummaryData.highest_debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </div>
                  )}
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Highest Credit Amount</h3>
                  {isLoadingModeSummary ? (
                    <div className="h-8 w-24 bg-white/5 animate-pulse rounded"></div>
                  ) : (
                    <div className="text-xl font-semibold text-emerald-400">
                      ₹ {modeSummaryData?.highest_credit ? Number(modeSummaryData.highest_credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </div>
                  )}
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Active Date</h3>
                  {isLoadingModeSummary ? (
                    <div className="h-12 w-24 bg-white/5 animate-pulse rounded"></div>
                  ) : (
                    <div>
                      <div className="text-xl font-semibold text-slate-200">
                        {modeSummaryData?.most_active_date ? new Date(modeSummaryData.most_active_date).toLocaleDateString('en-GB').replace(/\\//g, '-') : "No Data"}
                      </div>
                      {modeSummaryData?.most_active_date && (
                        <div className="text-sm text-slate-400 mt-1">
                          {modeSummaryData.most_active_date_count} Transactions
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Average Transaction Value</h3>
                  {isLoadingModeSummary ? (
                    <div className="h-8 w-24 bg-white/5 animate-pulse rounded"></div>
                  ) : (
                    <div className="text-xl font-semibold text-emerald-400">
                      ₹ {modeSummaryData?.average_transaction_value ? Number(modeSummaryData.average_transaction_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </div>
                  )}
                </div>
              </div>
              
              {isTransactionsLoading ? ('''

text = text.replace(
    '''              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-emerald-400">
                  Transactions for Mode: {selectedMode}
                </h2>
                <span className="text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full">
                  Total: {transactionTotal}
                </span>
              </div>
              
              {isTransactionsLoading ? (''',
    kpi_ui
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated DynamicReportDashboard for mode KPIs!")
