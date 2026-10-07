import os
import re

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
if 'searchCaseTransactions' not in content:
    content = content.replace('getCaseModeWise } from "../../../services/api/bankTransaction";', 'getCaseModeWise, searchCaseTransactions } from "../../../services/api/bankTransaction";')
    content = content.replace('import { getCaseModeWise }', 'import { getCaseModeWise, searchCaseTransactions }')

# 2. Add state variables
state_vars = '''
  const [selectedMode, setSelectedMode] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(0);
  const [transactionTotal, setTransactionTotal] = useState(0);
'''
if 'selectedMode' not in content:
    content = content.replace('const [error, setError] = useState("");', 'const [error, setError] = useState("");\n' + state_vars)

# 3. Add useEffect for fetching mode transactions
fetch_effect = '''
  useEffect(() => {
    if (!selectedMode || selectedFileIds.size === 0) {
      setTransactions([]);
      return;
    }
    
    async function loadTransactions() {
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
    loadTransactions();
  }, [selectedMode, selectedFileIds, selectedCaseId, transactionPage]);

  const handleBarClick = (mode) => {
    setSelectedMode(mode);
    setTransactionPage(1);
    // Scroll down to table
    setTimeout(() => {
      document.getElementById('transactions-grid')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
'''
if 'handleBarClick' not in content:
    content = content.replace('const handleFileToggle', fetch_effect + '\n  const handleFileToggle')

# 4. Modify DynamicModeWiseChart rendering
chart_old = '''<DynamicModeWiseChart 
              data={modeData}
              isLoading={isLoadingModeWise}
            />'''
chart_new = '''<DynamicModeWiseChart 
              data={modeData}
              isLoading={isLoadingModeWise}
              totalTransactions={totalTransactions}
              onBarClick={handleBarClick}
            />'''
content = content.replace(chart_old, chart_new)

# 5. Add Transaction Table UI
table_ui = '''
        {/* Transaction Grid Section */}
        {selectedMode && (
          <div id="transactions-grid" className="mt-8 bg-[#020b09] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-lg font-medium text-emerald-400">
                Transactions for Mode: <span className="text-white">{selectedMode}</span>
              </h3>
              <div className="text-sm text-slate-400">
                Total: <span className="text-white font-mono">{transactionTotal}</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#03120f] border-b border-white/[0.06]">
                    <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Debit</th>
                    <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Credit</th>
                    <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isTransactionsLoading ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-emerald-400/70 animate-pulse">Loading transactions...</td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500">No transactions found for this mode.</td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 text-sm text-slate-300 whitespace-nowrap">{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : "-"}</td>
                        <td className="p-3 text-sm text-slate-300 max-w-md truncate" title={tx.description}>{tx.description}</td>
                        <td className="p-3 text-sm font-mono text-rose-400 text-right">{tx.withdrawal_amount ? tx.withdrawal_amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : "-"}</td>
                        <td className="p-3 text-sm font-mono text-emerald-400 text-right">{tx.deposit_amount ? tx.deposit_amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : "-"}</td>
                        <td className="p-3 text-sm font-mono text-slate-300 text-right">{tx.balance ? tx.balance.toLocaleString('en-IN', {minimumFractionDigits: 2}) : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {transactionTotalPages > 1 && (
              <div className="p-4 border-t border-white/[0.06] flex justify-between items-center bg-[#010806]">
                <button
                  disabled={transactionPage <= 1 || isTransactionsLoading}
                  onClick={() => setTransactionPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 text-xs rounded border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400">
                  Page <span className="text-white">{transactionPage}</span> of <span className="text-white">{transactionTotalPages}</span>
                </span>
                <button
                  disabled={transactionPage >= transactionTotalPages || isTransactionsLoading}
                  onClick={() => setTransactionPage(p => Math.min(transactionTotalPages, p + 1))}
                  className="px-3 py-1 text-xs rounded border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
'''
if 'transactions-grid' not in content:
    content = content.replace('</div>\n    </div>\n  );\n}', table_ui + '\n      </div>\n    </div>\n  );\n}')


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated DynamicReportDashboard.jsx")
