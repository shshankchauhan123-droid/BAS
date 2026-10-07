filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('lg:grid-cols-4', 'lg:grid-cols-5')

new_kpi = '''          <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
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
        </div>'''

text = text.replace('          </div>\n        </div>', '          </div>\n' + new_kpi)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
