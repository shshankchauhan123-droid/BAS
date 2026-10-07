filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. Add getCaseTransactionSummary import
if "getCaseTransactionSummary" not in text:
    text = text.replace(
        'import { getCaseModeWise, searchCaseTransactions } from "../../../services/api/bankTransaction";',
        'import { getCaseModeWise, searchCaseTransactions, getCaseTransactionSummary } from "../../../services/api/bankTransaction";'
    )

# 2. Add State for KPI Summary
if "summaryData" not in text:
    text = text.replace(
        'const [totalTransactions, setTotalTransactions] = useState(0);',
        'const [totalTransactions, setTotalTransactions] = useState(0);\n  const [summaryData, setSummaryData] = useState(null);\n  const [isLoadingSummary, setIsLoadingSummary] = useState(false);'
    )

# 3. Add fetch logic inside the useEffect for ModeWise
# Look for fetchModeWise() inside useEffect
if "fetchModeWise();" in text and "fetchSummary();" not in text:
    fetch_func = '''    async function fetchSummary() {
      setIsLoadingSummary(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCaseTransactionSummary(selectedCaseId, fileIdsArray.join(","));
        if (res?.success) {
          setSummaryData(res.data);
        } else {
          setSummaryData(null);
        }
      } catch (err) {
        console.error("Summary error:", err);
        setSummaryData(null);
      } finally {
        setIsLoadingSummary(false);
      }
    }

    fetchModeWise();
    fetchSummary();'''
    text = text.replace('    fetchModeWise();', fetch_func)
    
# 4. Add the KPI UI before Chart Section
if "KPI Section" not in text:
    kpi_ui = '''        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Debit Amount</h3>
            {isLoadingSummary ? (
              <div className="h-8 w-24 bg-white/5 animate-pulse rounded"></div>
            ) : (
              <div className="text-xl font-semibold text-rose-400">
                ₹ {summaryData?.total_debits ? Number(summaryData.total_debits).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </div>
            )}
          </div>
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Credit Amount</h3>
            {isLoadingSummary ? (
              <div className="h-8 w-24 bg-white/5 animate-pulse rounded"></div>
            ) : (
              <div className="text-xl font-semibold text-emerald-400">
                ₹ {summaryData?.total_credits ? Number(summaryData.total_credits).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </div>
            )}
          </div>
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Debit Transactions</h3>
            {isLoadingSummary ? (
              <div className="h-8 w-16 bg-white/5 animate-pulse rounded"></div>
            ) : (
              <div className="text-xl font-semibold text-slate-200">
                {summaryData?.debit_transactions ? Number(summaryData.debit_transactions).toLocaleString('en-IN') : "0"}
              </div>
            )}
          </div>
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Credit Transactions</h3>
            {isLoadingSummary ? (
              <div className="h-8 w-16 bg-white/5 animate-pulse rounded"></div>
            ) : (
              <div className="text-xl font-semibold text-slate-200">
                {summaryData?.credit_transactions ? Number(summaryData.credit_transactions).toLocaleString('en-IN') : "0"}
              </div>
            )}
          </div>
        </div>

        {/* Chart Section */}'''
    text = text.replace('{/* Chart Section */}', kpi_ui)
    
# 5. Handle empty state for modeData cleanup
text = text.replace(
    'if (!selectedCaseId || selectedFileIds.size === 0) {\n      setModeData([]);\n      setTotalTransactions(0);\n      return;\n    }',
    'if (!selectedCaseId || selectedFileIds.size === 0) {\n      setModeData([]);\n      setTotalTransactions(0);\n      setSummaryData(null);\n      return;\n    }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

