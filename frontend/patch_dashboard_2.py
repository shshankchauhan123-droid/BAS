import pathlib
import re

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx')
content = file_path.read_text(encoding='utf-8')

# Remove KPI calculation
pattern_kpi = re.compile(r'  // Compute KPIs from timelineData.*?\}, \[timelineData\]\);\n', re.DOTALL)
content = pattern_kpi.sub('', content)

# Fix interval controls
pattern_interval = re.compile(r'<div className="flex flex-col gap-1 items-end">.*?</div>\n        </div>', re.DOTALL)
content = pattern_interval.sub('</div>', content)

# Fix JSX components timelineData->modeData
content = content.replace('timelineData.length > 0', 'modeData.length > 0')
content = content.replace('isLoadingTimeline', 'isLoadingModeWise')
content = content.replace('!isLoadingTimeline', '!isLoadingModeWise')

# Replace the whole KPI Cards block
pattern_kpi_cards = re.compile(r'\{/\* KPI Cards \*/\}.*?\{/\* Chart Section \*/\}', re.DOTALL)
new_kpi = '''{/* KPI Cards */}
        {modeData.length > 0 && !isLoadingModeWise && !error && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#020b09]/80 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Transactions</div>
              <div className="text-2xl font-mono text-white">{totalTransactions.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Chart Section */}'''
content = pattern_kpi_cards.sub(new_kpi, content)

# Replace the DynamicModeWiseChart props
content = content.replace('<DynamicModeWiseChart \n            timelineData={timelineData}\n            interval={interval}\n            isLoading={isLoadingTimeline}\n            error={error}\n          />', '<DynamicModeWiseChart data={modeData} isLoading={isLoadingModeWise} />')

# If the empty state was not added properly, let's add it in the Chart Section
pattern_chart = re.compile(r'\{/\* Chart Section \*/\}.*?<div className="mt-4">.*?</div>', re.DOTALL)
new_chart = '''{/* Chart Section */}
        <div className="mt-4">
          {!isLoadingModeWise && modeData.length === 0 && !error && (
            <div className="bg-[#020b09] rounded-2xl border border-white/[0.06] p-12 text-center">
              <svg className="h-12 w-12 text-emerald-500/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-slate-300 mb-1">No transaction data available</h3>
              <p className="text-sm text-slate-500">
                {selectedFileIds.size === 0 
                  ? "Select at least one file to generate the Transaction Mode Wise Report." 
                  : "No transactions found for the selected files."}
              </p>
            </div>
          )}
          
          {(modeData.length > 0 || isLoadingModeWise) && (
            <DynamicModeWiseChart 
              data={modeData}
              isLoading={isLoadingModeWise}
            />
          )}
          
          {error && (
            <div className="text-center p-8 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              {error}
            </div>
          )}
        </div>'''
content = pattern_chart.sub(new_chart, content)

file_path.write_text(content, encoding='utf-8')
print("Patched DynamicReportDashboard JSX parts.")
