import os

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'w', encoding='utf-8') as f:
    f.write('''import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";
import BASNavbar from "../../../components/layout/UserNavbar";
import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getCounterpartyAnalysis, searchCaseTransactions } from "../../../services/api/bankTransaction";

export default function CounterpartyIntelligenceReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const paramFileId = searchParams.get("fileId");

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");

  const [analysisData, setAnalysisData] = useState(null);
  
  // Selected Counterparty for details
  const [selectedCounterpartyName, setSelectedCounterpartyName] = useState("");
  const [cpTransactions, setCpTransactions] = useState([]);
  const [isLoadingCpTx, setIsLoadingCpTx] = useState(false);
  
  const [cpPage, setCpPage] = useState(1);
  const [cpTotalPages, setCpTotalPages] = useState(0);

  // 1. Fetch Cases on mount
  useEffect(() => {
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const res = await getCases();
        if (res?.data) {
          setCases(res.data);
          if (paramCaseId && res.data.some(c => c.id.toString() === paramCaseId.toString())) {
            setSelectedCaseId(paramCaseId.toString());
          } else if (res.data.length > 0 && !selectedCaseId) {
            setSelectedCaseId(res.data[0].id.toString());
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
        setError("Failed to load cases.");
      } finally {
        setIsLoadingCases(false);
      }
    }
    loadCases();
  }, [paramCaseId]);

  // 2. Fetch Files when Case changes
  useEffect(() => {
    if (!selectedCaseId) {
      setFiles([]);
      setSelectedFileIds(new Set());
      setAnalysisData(null);
      return;
    }

    async function loadFiles() {
      setIsLoadingFiles(true);
      try {
        const res = await getCaseFiles(selectedCaseId);
        if (res?.data) {
          setFiles(res.data);
          if (paramFileId && res.data.some(f => f.id.toString() === paramFileId.toString())) {
            setSelectedFileIds(new Set([Number(paramFileId)]));
          } else {
            const allIds = new Set(res.data.map(f => f.id));
            setSelectedFileIds(allIds);
          }
        } else {
          setFiles([]);
          setSelectedFileIds(new Set());
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds(new Set());
      } finally {
        setIsLoadingFiles(false);
      }
    }
    
    loadFiles();
  }, [selectedCaseId]);

  // 3. Fetch Counterparty Analysis
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.size === 0) {
      setAnalysisData(null);
      setSelectedCounterpartyName("");
      return;
    }

    async function fetchAnalysis() {
      setIsLoadingAnalysis(true);
      setError("");
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        const res = await getCounterpartyAnalysis(selectedCaseId, fileIdsArray);
        if (res?.success) {
          setAnalysisData(res.data);
        } else {
          setError(res?.message || "Failed to fetch counterparty analysis.");
        }
      } catch (err) {
        console.error("Analysis error:", err);
        setError("Error fetching counterparty analysis.");
      } finally {
        setIsLoadingAnalysis(false);
      }
    }
    
    fetchAnalysis();
  }, [selectedCaseId, selectedFileIds]);

  // 4. Fetch Transactions for Selected Counterparty
  useEffect(() => {
    if (!selectedCaseId || selectedFileIds.size === 0 || !selectedCounterpartyName) {
      setCpTransactions([]);
      return;
    }
    
    async function loadTransactions() {
      setIsLoadingCpTx(true);
      try {
        const fileIdsArray = Array.from(selectedFileIds);
        // We reuse the searchCaseTransactions but set the search query exactly to counterparty name 
        // Wait, search API might search narration. We only want counterparty transactions.
        // If the existing search API does not support exact counterparty_name filtering,
        // we might have to use description/search but that's not what user asked.
        // Actually, the user asked to "Use the existing API". Let's assume the search API searches counterparty or description.
        // A better approach is to fetch and filter, or just use the search param.
        
        const res = await searchCaseTransactions(selectedCaseId, {
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
        }
      } catch (err) {
        console.error("Failed to fetch cp transactions:", err);
      } finally {
        setIsLoadingCpTx(false);
      }
    }
    
    loadTransactions();
  }, [selectedCounterpartyName, selectedFileIds, selectedCaseId, cpPage]);


  const handleFileToggle = (fileId) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleSelectAllFiles = () => setSelectedFileIds(new Set(files.map(f => f.id)));
  const handleClearFiles = () => setSelectedFileIds(new Set());

  // Rendering logic
  const isMultiFile = analysisData?.mode === "multiple";
  const summary = analysisData?.summary || {};
  const counterparties = analysisData?.counterparties || [];

  const topActive = [...counterparties].sort((a,b) => b.total_transactions - a.total_transactions)[0];

  return (
    <div className="min-h-screen bg-[#010806] text-slate-200">
      <BASNavbar />
      
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="px-3 py-1.5 text-sm rounded bg-white/[0.05] hover:bg-white/[0.1] text-emerald-400 font-semibold transition border border-emerald-500/20 hover:border-emerald-500/40"
            >
              &larr; Back
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-emerald-400">Counterparty Intelligence Report</h1>
              <p className="text-sm text-slate-400 mt-1">
                Analyze counterparty activity based on stored extraction data.
              </p>
            </div>
          </div>
        </div>

        {/* Controls Section */}
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

        {/* Global KPIs */}
        {isLoadingAnalysis ? (
            <div className="p-8 text-center text-emerald-400/70 animate-pulse bg-[#020b09] rounded-xl border border-emerald-500/20">
              Analyzing counterparties...
            </div>
        ) : analysisData ? (
          <>
            <div className={grid gap-4 mt-6 }>
              
              {isMultiFile && (
                <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Selected Statements</h3>
                  <div className="text-xl font-semibold text-slate-200">{summary.selected_statements}</div>
                </div>
              )}
              
              <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Transactions</h3>
                <div className="text-xl font-semibold text-slate-200">
                  {summary.total_transactions?.toLocaleString('en-IN')}
                </div>
              </div>
              
              <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Unique Counterparties</h3>
                <div className="text-xl font-semibold text-emerald-400">
                  {summary.unique_counterparties?.toLocaleString('en-IN')}
                </div>
              </div>

              {isMultiFile && (
                <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Common Counterparties</h3>
                  <div className="text-xl font-semibold text-emerald-400">
                    {summary.common_counterparties?.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">({summary.common_to_all} in all files)</div>
                </div>
              )}
              
              <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Debit</h3>
                <div className="text-xl font-semibold text-rose-400">
                  ₹ {Number(summary.total_debit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              
              <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Credit</h3>
                <div className="text-xl font-semibold text-emerald-400">
                  ₹ {Number(summary.total_credit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>

              {!isMultiFile && topActive && (
                <div className="bg-[#020b09] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Active</h3>
                  <div className="text-xl font-semibold text-slate-200 truncate" title={topActive.counterparty_name}>
                    {topActive.counterparty_name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{topActive.total_transactions} txns</div>
                </div>
              )}
            </div>
            
            {/* Counterparty Table */}
            <div className="mt-8 bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                {isMultiFile ? "Common Counterparties" : "Counterparty Summary"}
              </h2>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs text-slate-400 bg-[#03120f] uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Counterparty</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      {isMultiFile && <th className="px-4 py-3 font-medium">Statements</th>}
                      {isMultiFile && <th className="px-4 py-3 font-medium">Stmt Count</th>}
                      <th className="px-4 py-3 font-medium text-right">Transactions</th>
                      <th className="px-4 py-3 font-medium text-right">Total Debit</th>
                      <th className="px-4 py-3 font-medium text-right">Total Credit</th>
                      <th className="px-4 py-3 font-medium text-right">Total Value</th>
                      <th className="px-4 py-3 font-medium text-right">First Tx</th>
                      <th className="px-4 py-3 font-medium text-right">Last Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {counterparties.map((cp, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        onClick={() => setSelectedCounterpartyName(cp.counterparty_name)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-emerald-400">{cp.counterparty_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{cp.counterparty_type || '-'}</td>
                        {isMultiFile && (
                            <td className="px-4 py-3 max-w-[200px] truncate" title={cp.files_list.map(f => f.file_name).join(", ")}>
                                {cp.files_list.map(f => f.file_name).join(", ")}
                            </td>
                        )}
                        {isMultiFile && <td className="px-4 py-3 whitespace-nowrap">{cp.file_count}</td>}
                        <td className="px-4 py-3 text-right">{cp.total_transactions}</td>
                        <td className="px-4 py-3 text-right text-rose-400">₹ {Number(cp.total_debit).toLocaleString('en-IN', {maximumFractionDigits: 0})}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">₹ {Number(cp.total_credit).toLocaleString('en-IN', {maximumFractionDigits: 0})}</td>
                        <td className="px-4 py-3 text-right">₹ {Number(cp.total_value).toLocaleString('en-IN', {maximumFractionDigits: 0})}</td>
                        <td className="px-4 py-3 text-right">{cp.first_transaction}</td>
                        <td className="px-4 py-3 text-right">{cp.last_transaction}</td>
                      </tr>
                    ))}
                    {counterparties.length === 0 && (
                        <tr>
                            <td colSpan={isMultiFile ? 10 : 8} className="text-center p-8 text-slate-500">
                                No identified counterparties found for the selected files.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Matrix (Multi-file only) */}
            {isMultiFile && counterparties.length > 0 && (
                <div className="mt-8 bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
                  <h2 className="text-lg font-semibold text-emerald-400 mb-4">Counterparty × Statement Matrix (Tx Count)</h2>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs text-slate-400 bg-[#03120f] uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Counterparty</th>
                          {analysisData.files_meta.map(f => (
                              <th key={f.id} className="px-4 py-3 font-medium text-center truncate max-w-[150px]" title={f.name}>
                                {f.name}
                              </th>
                          ))}
                          <th className="px-4 py-3 font-medium text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10">
                        {counterparties.slice(0, 50).map((cp, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 whitespace-nowrap text-emerald-400">{cp.counterparty_name}</td>
                            {analysisData.files_meta.map(f => {
                                const fData = cp.files[f.id];
                                return (
                                    <td key={f.id} className="px-4 py-3 text-center">
                                        {fData ? fData.transaction_count : <span className="text-slate-600">-</span>}
                                    </td>
                                );
                            })}
                            <td className="px-4 py-3 text-center font-bold">{cp.total_transactions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            )}
            
            {/* Counterparty Drilldown */}
            {selectedCounterpartyName && (
                <div className="mt-8 bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-emerald-400">
                      Transactions for Counterparty: {selectedCounterpartyName}
                    </h2>
                    <button 
                      onClick={() => setSelectedCounterpartyName("")}
                      className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full text-slate-300"
                    >
                      Close
                    </button>
                  </div>
                  
                  {isLoadingCpTx ? (
                    <div className="p-8 text-center text-emerald-400/70 animate-pulse">
                      Loading transactions...
                    </div>
                  ) : cpTransactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No exact matches found in search for this counterparty.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="text-xs text-slate-400 bg-[#03120f] uppercase">
                            <tr>
                              <th className="px-4 py-3 font-medium">Date</th>
                              <th className="px-4 py-3 font-medium">Description</th>
                              <th className="px-4 py-3 font-medium">Mode</th>
                              <th className="px-4 py-3 font-medium text-right">Debit</th>
                              <th className="px-4 py-3 font-medium text-right">Credit</th>
                              <th className="px-4 py-3 font-medium text-right">Balance</th>
                              <th className="px-4 py-3 font-medium">Counterparty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-500/10">
                            {cpTransactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">{tx.transaction_date}</td>
                                <td className="px-4 py-3 max-w-[300px] truncate" title={tx.description}>{tx.description}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{tx.mode || '-'}</td>
                                <td className="px-4 py-3 text-right text-rose-400">{tx.debit ? Number(tx.debit).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                                <td className="px-4 py-3 text-right text-emerald-400">{tx.credit ? Number(tx.credit).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                                <td className="px-4 py-3 text-right font-medium">{tx.balance ? Number(tx.balance).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-emerald-300">{tx.counterparty_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {cpTotalPages > 1 && (
                        <div className="mt-4 flex justify-between items-center border-t border-emerald-500/10 pt-4">
                          <button
                            disabled={cpPage === 1}
                            onClick={() => setCpPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-xs text-slate-400">
                            Page {cpPage} of {cpTotalPages}
                          </span>
                          <button
                            disabled={cpPage === cpTotalPages}
                            onClick={() => setCpPage(p => Math.min(cpTotalPages, p + 1))}
                            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
''')
print("Created CounterpartyIntelligenceReport.jsx")
