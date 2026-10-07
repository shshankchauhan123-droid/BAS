filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. Remove modeSummaryData state
text = re.sub(r'const \[modeSummaryData.*?;\n', '', text)
text = re.sub(r'const \[isLoadingModeSummary.*?;\n', '', text)

# 2. Remove loadModeSummary and its call
loadModeSummary_pattern = r'async function loadModeSummary\(\) \{.*?\n    \}\n'
text = re.sub(loadModeSummary_pattern, '', text, flags=re.DOTALL)

text = re.sub(r'if \(transactionPage === 1\) \{\n\s*loadModeSummary\(\);\n\s*\}', '', text)

# 3. Add useMemo for modeKPIs
kpis_code = '''
  const modeKPIs = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        highestDebit: 0,
        highestCredit: 0,
        mostActiveDate: null,
        mostActiveDateCount: 0,
        averageValue: 0
      };
    }

    let highestDebit = 0;
    let highestCredit = 0;
    let totalValue = 0;
    let validTxCount = 0;
    
    const dateCounts = {};

    transactions.forEach(tx => {
      const debit = parseFloat(tx.debit);
      const credit = parseFloat(tx.credit);

      let hasValidAmount = false;

      if (!isNaN(debit) && debit > 0) {
        if (debit > highestDebit) highestDebit = debit;
        totalValue += debit;
        hasValidAmount = true;
      } else if (!isNaN(credit) && credit > 0) {
        if (credit > highestCredit) highestCredit = credit;
        totalValue += credit;
        hasValidAmount = true;
      }

      if (hasValidAmount) {
        validTxCount++;
      }

      if (tx.transaction_date) {
        dateCounts[tx.transaction_date] = (dateCounts[tx.transaction_date] || 0) + 1;
      }
    });

    let mostActiveDate = null;
    let mostActiveDateCount = 0;

    for (const [date, count] of Object.entries(dateCounts)) {
      if (count > mostActiveDateCount) {
        mostActiveDateCount = count;
        mostActiveDate = date;
      } else if (count === mostActiveDateCount) {
        // choose the most recent date if tie
        if (new Date(date) > new Date(mostActiveDate)) {
           mostActiveDate = date;
        }
      }
    }

    const averageValue = validTxCount > 0 ? totalValue / validTxCount : 0;

    return {
      highestDebit,
      highestCredit,
      mostActiveDate,
      mostActiveDateCount,
      averageValue
    };
  }, [transactions, selectedMode]);
'''

# Insert it before handleBarClick
text = text.replace('const handleBarClick = (mode) => {', kpis_code + '\n  const handleBarClick = (mode) => {')

# 4. Replace the rendered UI variables
target_ui = '''              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                        {modeSummaryData?.most_active_date ? new Date(modeSummaryData.most_active_date).toLocaleDateString('en-GB').replace(/\//g, '-') : "No Data"}
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
              </div>'''

replacement_ui = '''              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Highest Debit Amount</h3>
                  <div className="text-xl font-semibold text-rose-400">
                    ₹ {modeKPIs.highestDebit ? Number(modeKPIs.highestDebit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                  </div>
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Highest Credit Amount</h3>
                  <div className="text-xl font-semibold text-emerald-400">
                    ₹ {modeKPIs.highestCredit ? Number(modeKPIs.highestCredit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                  </div>
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Active Date</h3>
                  <div>
                    <div className="text-xl font-semibold text-slate-200">
                      {modeKPIs.mostActiveDate ? new Date(modeKPIs.mostActiveDate).toLocaleDateString('en-GB').replace(/\\//g, '-') : "No Data"}
                    </div>
                    {modeKPIs.mostActiveDate && (
                      <div className="text-sm text-slate-400 mt-1">
                        {modeKPIs.mostActiveDateCount} Transactions
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#03120f] border border-emerald-500/10 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Average Transaction Value</h3>
                  <div className="text-xl font-semibold text-emerald-400">
                    ₹ {modeKPIs.averageValue ? Number(modeKPIs.averageValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                  </div>
                </div>
              </div>'''

# NOTE: need to replace \/ with / since it's an escaping thing in python
replacement_ui = replacement_ui.replace('\\/', '/')

text = text.replace(target_ui, replacement_ui)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated DynamicReportDashboard frontend KPI logic!")
