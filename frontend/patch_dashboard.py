import pathlib
import re

file_path = pathlib.Path(r'C:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\analysis\DynamicReportDashboard.jsx')
content = file_path.read_text(encoding='utf-8')

# Change imports
content = content.replace('DynamicTimelineChart', 'DynamicModeWiseChart')
content = content.replace('getCaseTimeline', 'getCaseModeWise')
content = content.replace('import DynamicTimelineChart from "../../../components/dynamicReport/DynamicTimelineChart";', 'import DynamicModeWiseChart from "../../../components/dynamicReport/DynamicModeWiseChart";\nimport { useNavigate } from "react-router-dom";')

# Change state and data fetching
content = content.replace('const [timelineData, setTimelineData] = useState([]);', 'const [modeData, setModeData] = useState([]);\n  const [totalTransactions, setTotalTransactions] = useState(0);')
content = content.replace('const [interval, setInterval] = useState("month");', '')
content = content.replace('const [requestedInterval, setRequestedInterval] = useState("");', '')
content = content.replace('const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);', 'const [isLoadingModeWise, setIsLoadingModeWise] = useState(false);')

# Update use effect for fetching data
fetch_pattern = re.compile(r'  // 3\. Fetch Timeline Data when File Selection Changes\n.*?}\n\n    fetchTimeline\(\);\n\n    return \(\) => \{\n      abortController\.abort\(\);\n    \};\n  \}, \[selectedCaseId, selectedFileIds, requestedInterval\]\);', re.DOTALL)
new_fetch = '''  // 3. Fetch Mode-Wise Data when File Selection Changes
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.size === 0) {
      setModeData([]);
      setTotalTransactions(0);
      return;
    }

    async function fetchModeWise() {
      setIsLoadingModeWise(true);
      setError("");
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCaseModeWise(selectedCaseId, fileIdsArray);
        if (res?.success) {
          setModeData(res.data || []);
          setTotalTransactions(res.total_transactions || 0);
        } else {
          setError(res?.message || "Failed to fetch mode-wise data.");
        }
      } catch (err) {
        console.error("Timeline error:", err);
        setError("Failed to fetch mode-wise data.");
      } finally {
        setIsLoadingModeWise(false);
      }
    }

    fetchModeWise();

  }, [selectedCaseId, selectedFileIds]);
'''
content = fetch_pattern.sub(new_fetch, content)

# Change useNavigate
content = content.replace('export default function DynamicReportDashboard() {', 'export default function DynamicReportDashboard() {\n  const navigate = useNavigate();')

# Change header
header_pattern = re.compile(r'<h1 className="text-2xl font-semibold text-emerald-400">Dynamic Data Report & Timeline Visualization</h1>.*?<p className="text-slate-400 mt-1 text-sm">.*?Production-grade.*?<br />.*?Interactive ECharts timeline.*?</p>', re.DOTALL)
new_header = '''<div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)} 
                className="px-3 py-1.5 text-sm rounded bg-white/[0.05] hover:bg-white/[0.1] text-emerald-400 font-semibold transition"
              >
                &larr; Back
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-emerald-400">Transaction Mode Wise Report</h1>
                <p className="text-slate-400 mt-1 text-sm">
                  Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.
                </p>
              </div>
            </div>'''
content = header_pattern.sub(new_header, content)

# Remove interval controls
interval_pattern = re.compile(r'\{/\* X-AXIS INTERVAL \*/\}.*?</div>\n                  </div>', re.DOTALL)
content = interval_pattern.sub('', content)

# Update KPI card
kpi_pattern = re.compile(r'\{/\* === KPI CARDS === \*/\}.*?\{/\* === TIMELINE CHART === \*/\}', re.DOTALL)
new_kpi = '''{/* === KPI CARDS === */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#061411] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden">
            <h4 className="text-sm font-semibold text-emerald-500 mb-1">Total Transactions</h4>
            <div className="text-2xl font-bold text-white">
              {totalTransactions.toLocaleString()}
            </div>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
              <svg className="h-16 w-16 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
          </div>
        </div>

        {/* === TIMELINE CHART === */}'''
content = kpi_pattern.sub(new_kpi, content)

# Update chart rendering
chart_pattern = re.compile(r'<DynamicTimelineChart\s+data=\{timelineData\}\s+interval=\{interval\}\s+isLoading=\{isLoadingTimeline\}\s+/>', re.DOTALL)
content = chart_pattern.sub(r'<DynamicModeWiseChart data={modeData} isLoading={isLoadingModeWise} />', content)

# Update empty state
empty_pattern = re.compile(r'\{\!isLoadingTimeline && timelineData\.length === 0 && \!error && \(\s*<div.*?</div>\s*\)\}', re.DOTALL)
new_empty = '''{!isLoadingModeWise && modeData.length === 0 && !error && (
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
        )}'''
content = empty_pattern.sub(new_empty, content)


file_path.write_text(content, encoding='utf-8')
print("Patched DynamicReportDashboard.jsx")
