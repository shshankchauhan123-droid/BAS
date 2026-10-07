filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Remove the broken KPI that was inserted into the controls section
# I will just rewrite the whole KPI section cleanly and remove everything between {/* Controls Section */} and {/* Chart Section */}

match = re.search(r'\{/\*\s*Controls Section\s*\*/\}(.*?)\{/\*\s*Chart Section\s*\*/\}', text, re.DOTALL)
if match:
    # First, let's just restore the controls section exactly as it was
    controls_section = '''        {/* Controls Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Case Selector */}
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">1. Select Case</h2>
            {isLoadingCases ? (
              <div className="text-sm text-emerald-400/70 animate-pulse">Loading cases...</div>
            ) : (
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="w-full bg-[#03120f] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="" disabled>-- Select a Case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* File Selector */}
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 md:col-span-2 flex flex-col max-h-[160px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2. Select Files</h2>
              <div className="flex gap-2">
                <button 
                  onClick={handleSelectAllFiles}
                  className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-500/20 transition-colors"
                >
                  All
                </button>
                <button 
                  onClick={handleClearFiles}
                  className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
              {!selectedCaseId ? (
                <div className="text-sm text-slate-500 italic">Please select a case first.</div>
              ) : isLoadingFiles ? (
                <div className="text-sm text-emerald-400/70 animate-pulse">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No files available in this case.</div>
              ) : (
                files.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 group cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.has(f.id)}
                      onChange={() => handleFileToggle(f.id)}
                      className="form-checkbox bg-[#03120f] border-emerald-500/30 text-emerald-500 rounded focus:ring-emerald-500/50 focus:ring-offset-[#020b09]"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-emerald-300 truncate" title={f.original_filename}>
                      {f.original_filename}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
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
          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Active Date</h3>
            {isLoadingSummary ? (
              <div className="h-12 w-24 bg-white/5 animate-pulse rounded"></div>
            ) : (
              <div>
                <div className="text-xl font-semibold text-emerald-400">
                  {summaryData?.most_active_date ? new Date(summaryData.most_active_date).toLocaleDateString('en-GB').replace(/\\//g, '-') : "No Data"}
                </div>
                {summaryData?.most_active_date && (
                  <div className="text-sm text-slate-400 mt-1">
                    {summaryData.most_active_date_count} Transactions
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chart Section */}'''
    text = text[:match.start()] + controls_section + text[match.end()-21:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed formatting")
