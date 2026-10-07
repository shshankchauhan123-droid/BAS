import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BASNavbar from "../../../components/layout/UserNavbar";
import DynamicModeWiseChart from "../../../components/dynamicReport/DynamicModeWiseChart";
import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import { getCaseModeWise, searchCaseTransactions } from "../../../services/api/bankTransaction";

export default function DynamicReportDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramCaseId = searchParams.get("caseId");
  const paramFileId = searchParams.get("fileId");

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || "");
  
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  
  const [modeData, setModeData] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  
  
  
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingModeWise, setIsLoadingModeWise] = useState(false);
  const [error, setError] = useState("");

  const [selectedMode, setSelectedMode] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(0);
  const [transactionTotal, setTransactionTotal] = useState(0);


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
      setModeData([]);
      setTotalTransactions(0);
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
            // By default select all files
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

  // 3. Fetch Mode-Wise Data when File Selection Changes
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
        console.error("Mode-wise error:", err);
        setError("Error fetching mode-wise data.");
      } finally {
        setIsLoadingModeWise(false);
      }
    }

    fetchModeWise();
    
  }, [selectedCaseId, selectedFileIds]);

  
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

  const handleFileToggle = (fileId) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleSelectAllFiles = () => {
    setSelectedFileIds(new Set(files.map(f => f.id)));
  };

  const handleClearFiles = () => {
    setSelectedFileIds(new Set());
  };


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
              <h1 className="text-2xl font-semibold text-emerald-400">Transaction Mode Wise Report</h1>
              <p className="text-sm text-slate-400 mt-1">
                Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.
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

        

        {/* Chart Section */}
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
              totalTransactions={totalTransactions}
              onBarClick={handleBarClick}
            />
          )}

          {selectedMode && (
            <div id="transactions-grid" className="mt-8 bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-emerald-400">
                  Transactions for Mode: {selectedMode}
                </h2>
                <span className="text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full">
                  Total: {transactionTotal}
                </span>
              </div>
              
              {isTransactionsLoading ? (
                <div className="p-8 text-center text-emerald-400/70 animate-pulse">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No transactions found for this mode.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs text-slate-400 bg-[#03120f] uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Account Name</th>
                          <th className="px-4 py-3 font-medium">Account Number</th>
                          <th className="px-4 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium text-right">Debit</th>
                          <th className="px-4 py-3 font-medium text-right">Credit</th>
                          <th className="px-4 py-3 font-medium text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">{tx.transaction_date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{tx.account_name || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{tx.account_number || '-'}</td>
                            <td className="px-4 py-3 max-w-[300px] truncate" title={tx.description}>{tx.description}</td>
                            <td className="px-4 py-3 text-right text-rose-400">{tx.debit ? Number(tx.debit).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                            <td className="px-4 py-3 text-right text-emerald-400">{tx.credit ? Number(tx.credit).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                            <td className="px-4 py-3 text-right font-medium">{tx.balance ? Number(tx.balance).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {transactionTotalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center border-t border-emerald-500/10 pt-4">
                      <button
                        disabled={transactionPage === 1}
                        onClick={() => setTransactionPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-slate-400">
                        Page {transactionPage} of {transactionTotalPages}
                      </span>
                      <button
                        disabled={transactionPage === transactionTotalPages}
                        onClick={() => setTransactionPage(p => Math.min(transactionTotalPages, p + 1))}
                        className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {error && (
            <div className="text-center p-8 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
