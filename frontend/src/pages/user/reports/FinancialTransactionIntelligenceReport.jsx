import React, { useRef, useState, useEffect } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import * as echarts from 'echarts';
import { formatFinancialValue } from "../../../utils/chartFormatter";


import BASNavbar from "../../../components/layout/UserNavbar";

import { getCases } from "../../../services/api/case";

import { getCaseFiles } from "../../../services/api/file";

import { getFinancialAnalysis } from "../../../services/api/bankTransaction";



const formatDate = (dateStr) => {

  if (!dateStr) return '-';

  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];

  const parts = dateStr.split('-');

  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;

  return dateStr;

};



const formatAmt = (val) => {

  if (val === null || val === undefined) return '-';

  return `₹${Number(val).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;

};



export default function FinancialTransactionIntelligenceReport() {

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



  const [analysisData, setAnalysisData] = useState(null);



  // Filtering

  const [filters, setFilters] = useState({

      dateFrom: "",

      dateTo: "",

      transactionType: "",

      minAmount: "",

      maxAmount: "",

      channel: ""

  });



  const distChartRef = useRef(null);

  const dailyChartRef = useRef(null);

  const monthlyChartRef = useRef(null);

  const balanceChartRef = useRef(null);



  useEffect(() => {

    fetchCases();

  }, []);



  useEffect(() => {

    if (selectedCaseId) {

      fetchFiles(selectedCaseId);

    } else {

      setFiles([]);

      setSelectedFileIds(new Set());

    }

  }, [selectedCaseId]);



  useEffect(() => {

    if (paramFileId && files.length > 0) {

      const fId = parseInt(paramFileId, 10);

      if (files.some(f => f.id === fId)) {

        setSelectedFileIds(new Set([fId]));

      }

    }

  }, [paramFileId, files]);



  const fetchCases = async () => {

    setIsLoadingCases(true);

    try {

      const res = await getCases();

      setCases(res.data);

    } catch (err) {

      console.error(err);

    } finally {

      setIsLoadingCases(false);

    }

  };



  const fetchFiles = async (caseId) => {

    setIsLoadingFiles(true);

    try {

      const res = await getCaseFiles(caseId);

      setFiles(res.data);

    } catch (err) {

      console.error(err);

    } finally {

      setIsLoadingFiles(false);

    }

  };



  const handleFileToggle = (fileId) => {

    const newSet = new Set(selectedFileIds);

    if (newSet.has(fileId)) {

      newSet.delete(fileId);

    } else {

      newSet.add(fileId);

    }

    setSelectedFileIds(newSet);

  };



  const handleFilterChange = (e) => {

      setFilters({...filters, [e.target.name]: e.target.value});

  };



  const applyFilters = () => {

      fetchAnalysis();

  };



  const fetchAnalysis = async () => {

    if (!selectedCaseId) return;

    setIsLoadingAnalysis(true);

    setAnalysisData(null);

    try {

      const filterParams = {

          fileIds: Array.from(selectedFileIds),

          ...filters

      };

      const res = await getFinancialAnalysis(selectedCaseId, filterParams);

      if (res.error) {

          setAnalysisData(null);

      } else {

          setAnalysisData(res);

      }

    } catch (err) {

      console.error(err);

    } finally {

      setIsLoadingAnalysis(false);

    }

  };



  useEffect(() => {

    if (selectedFileIds.size > 0) {

      fetchAnalysis();

    }

  }, [selectedFileIds]);



  // Charts

  useEffect(() => {

      if (!analysisData) return;



      if (distChartRef.current && analysisData.amount_distribution) {

          const chart = echarts.init(distChartRef.current);

          chart.setOption({

            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },

            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },

            xAxis: {

              type: 'category',

              data: analysisData.amount_distribution.map(d => d.range),

              axisLabel: { color: '#94a3b8' }

            },

            yAxis: {

              type: 'value',

              axisLabel: { color: '#94a3b8' }

            },

            series: [{

              name: 'Transactions',

              type: 'bar',

              data: analysisData.amount_distribution.map(d => d.count),

              itemStyle: { color: '#6366f1' }

            }]

          });

      }



      if (dailyChartRef.current && analysisData.daily_activity) {

          const chart = echarts.init(dailyChartRef.current);

          chart.setOption({

            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },

            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },

            xAxis: {

              type: 'category',

              data: analysisData.daily_activity.map(d => d.date_str),

              axisLabel: { color: '#94a3b8' }

            },

            yAxis: {

              type: 'value',

              axisLabel: { color: '#94a3b8' }

            },

            series: [

              {

                name: 'Debit',

                type: 'line',

                data: analysisData.daily_activity.map(d => d.debit),

                itemStyle: { color: '#f43f5e' }

              },

              {

                name: 'Credit',

                type: 'line',

                data: analysisData.daily_activity.map(d => d.credit),

                itemStyle: { color: '#34d399' }

              },

            ]

          });

      }



      if (monthlyChartRef.current && analysisData.monthly_activity) {

          const chart = echarts.init(monthlyChartRef.current);

          chart.setOption({

            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },

            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },

            xAxis: {

              type: 'category',

              data: analysisData.monthly_activity.map(d => d.month_str),

              axisLabel: { color: '#94a3b8' }

            },

            yAxis: {

              type: 'value',

              axisLabel: { color: '#94a3b8' }

            },

            series: [{

              name: 'Net Flow',

              type: 'bar',

              data: analysisData.monthly_activity.map(d => d.net_flow),

              itemStyle: { color: '#38bdf8' }

            }]

          });

      }



      if (balanceChartRef.current && analysisData.balance?.trend?.length > 0) {

          const chart = echarts.init(balanceChartRef.current);

          chart.setOption({

            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) { let res = `<b>${params[0].axisValue}</b><br/>`; params.forEach(p => { let v = p.seriesName.includes('Transaction') || p.seriesName === 'Transactions' ? p.value : formatFinancialValue(p.value); res += `${p.marker} ${p.seriesName}: <b>${v}</b><br/>`; }); return res; } },

            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },

            xAxis: {

              type: 'category',

              data: analysisData.balance.trend.map(d => d.date_str),

              axisLabel: { color: '#94a3b8' }

            },

            yAxis: {

              type: 'value',

              axisLabel: { color: '#94a3b8' }

            },

            series: [{

              name: 'Balance',

              type: 'line',

              areaStyle: { opacity: 0.1 },

              data: analysisData.balance.trend.map(d => d.balance),

              itemStyle: { color: '#f59e0b' }

            }]

          });

      }

  }, [analysisData]);



  const handlePrint = () => {

    window.print();

  };



  const isMultiFile = selectedFileIds.size > 1;



  return (

    <div className="min-h-screen bg-[#020b09] text-slate-300 font-sans">

      <BASNavbar />



      <div className="max-w-7xl mx-auto px-4 py-8 mt-16 print:mt-0 print:p-0">



        {/* Header */}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">

          <div>

            <h1 className="text-2xl font-bold text-emerald-400">

              Financial Transaction Intelligence

            </h1>

            <p className="text-sm text-slate-500">

              Data-driven financial behavior analysis

            </p>

          </div>



          <div className="flex gap-2 print:hidden">

            <button

              onClick={handlePrint}

              className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-lg transition border border-emerald-500/20 flex items-center gap-2"

            >

              <svg

                className="w-4 h-4"

                fill="none"

                stroke="currentColor"

                viewBox="0 0 24 24"

              >

                <path

                  strokeLinecap="round"

                  strokeLinejoin="round"

                  strokeWidth={2}

                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H9v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"

                />

              </svg>

              Export PDF

            </button>



            <button

              onClick={() => navigate('/dashboard/reports')}

              className="bg-[#03120f] border border-emerald-500/20 text-emerald-500 px-4 py-2 rounded hover:bg-emerald-500/10 transition"

            >

              Back to Reports

            </button>

          </div>

        </div>



        {/* Filters Panel - Print Hidden */}

        <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Select Case

              </label>

              <select

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50"

                value={selectedCaseId}

                onChange={(e) => setSelectedCaseId(e.target.value)}

              >

                <option value="">-- Select Case --</option>

                {cases.map(c => (

                  <option key={c.id} value={c.id}>

                    {c.case_name}

                  </option>

                ))}

              </select>

            </div>



            <div className="lg:col-span-3">

              <label className="block text-xs text-slate-500 mb-1">

                Select Statements ({selectedFileIds.size})

              </label>



              <div className="bg-[#020b09] border border-emerald-500/20 rounded-lg p-2 max-h-[80px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">

                {isLoadingFiles ? (

                  <div className="text-sm text-slate-500 italic">

                    Loading files...

                  </div>

                ) : files.length === 0 ? (

                  <div className="text-sm text-slate-500 italic">

                    No files available.

                  </div>

                ) : (

                  files.map((f) => (

                    <label

                      key={f.id}

                      className="flex items-center gap-2 group cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20 pr-3"

                    >

                      <input

                        type="checkbox"

                        checked={selectedFileIds.has(f.id)}

                        onChange={() => handleFileToggle(f.id)}

                        className="form-checkbox bg-[#03120f] border-emerald-500/30 text-emerald-500 rounded focus:ring-emerald-500/50"

                      />



                      <span

                        className="text-sm text-slate-300 truncate max-w-[150px]"

                        title={f.original_filename}

                      >

                        {f.original_filename}

                      </span>

                    </label>

                  ))

                )}

              </div>

            </div>

          </div>



          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">

            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Date From

              </label>

              <input

                type="date"

                name="dateFrom"

                value={filters.dateFrom}

                onChange={handleFilterChange}

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm"

              />

            </div>



            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Date To

              </label>

              <input

                type="date"

                name="dateTo"

                value={filters.dateTo}

                onChange={handleFilterChange}

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm"

              />

            </div>



            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Type

              </label>

              <select

                name="transactionType"

                value={filters.transactionType}

                onChange={handleFilterChange}

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm"

              >

                <option value="">All</option>

                <option value="debit">Debit</option>

                <option value="credit">Credit</option>

              </select>

            </div>



            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Min Amount

              </label>

              <input

                type="number"

                name="minAmount"

                value={filters.minAmount}

                onChange={handleFilterChange}

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm"

                placeholder="₹"

              />

            </div>



            <div>

              <label className="block text-xs text-slate-500 mb-1">

                Max Amount

              </label>

              <input

                type="number"

                name="maxAmount"

                value={filters.maxAmount}

                onChange={handleFilterChange}

                className="w-full bg-[#020b09] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm"

                placeholder="₹"

              />

            </div>



            <div className="flex items-end">

              <button

                onClick={applyFilters}

                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg transition text-sm"

              >

                Apply Filters

              </button>

            </div>

          </div>

        </div>



        {/* Print Context Info */}

        <div className="hidden print:block mb-8">

          <h2 className="text-xl font-bold text-slate-800">

            Case ID: {selectedCaseId}

          </h2>



          <p className="text-sm text-slate-600">

            Selected Statements: {Array.from(selectedFileIds).join(", ")}

          </p>



          {(filters.dateFrom || filters.dateTo) && (

            <p className="text-sm text-slate-600">

              Period: {filters.dateFrom || 'Start'} to {filters.dateTo || 'End'}

            </p>

          )}

        </div>



        {isLoadingAnalysis ? (

          <div className="flex justify-center items-center py-20">

            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>

          </div>

        ) : analysisData ? (

          <div className="space-y-8">



            {/* KPIs */}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

              {[

                {

                  label: "Total Value",

                  val: analysisData.kpis.total_value,

                  color: "emerald"

                },

                {

                  label: "Highest Tx",

                  val: analysisData.kpis.highest_transaction,

                  color: "rose"

                },

                {

                  label: "Average Tx",

                  val: analysisData.kpis.average_transaction,

                  color: "blue"

                },

                {

                  label: "Median Tx",

                  val: analysisData.kpis.median_transaction,

                  color: "purple"

                },

                {

                  label: "Highest Debit",

                  val: analysisData.kpis.highest_debit,

                  color: "rose"

                },

                {

                  label: "Highest Credit",

                  val: analysisData.kpis.highest_credit,

                  color: "emerald"

                }

              ].map((k, i) => (

                <div

                  key={i}

                  className={`bg-[#03120f] border border-${k.color}-500/20 rounded-xl p-4 text-center break-words`}

                >

                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">

                    {k.label}

                  </p>



                  <p className={`text-xl font-semibold text-${k.color}-400`}>

                    {formatAmt(k.val)}

                  </p>

                </div>

              ))}

            </div>



            {/* Financial Concentration & Stats */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Financial Concentration

                </h3>



                <div className="space-y-4">

                  {[

                    {

                      label: "Top 5 Transactions",

                      data: analysisData.concentration.top_5

                    },

                    {

                      label: "Top 10 Transactions",

                      data: analysisData.concentration.top_10

                    },

                    {

                      label: "Top 25 Transactions",

                      data: analysisData.concentration.top_25

                    }

                  ].map((c, i) => (

                    <div

                      key={i}

                      className="flex justify-between items-center border-b border-emerald-500/10 pb-2"

                    >

                      <span className="text-slate-400 text-sm">

                        {c.label}

                      </span>



                      <div className="text-right">

                        <div className="text-emerald-300 font-medium">

                          {formatAmt(c.data.value)}

                        </div>



                        <div className="text-xs text-slate-500">

                          {c.data.percentage.toFixed(1)}% of total movement

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              </div>



              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Transaction Statistics

                </h3>



                <div className="grid grid-cols-2 gap-4">

                  <div className="text-sm">

                    <span className="text-slate-500">Total Count:</span>

                    <span className="text-slate-300 float-right">

                      {analysisData.stats.total_transactions}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Min Amount:</span>

                    <span className="text-slate-300 float-right">

                      {formatAmt(analysisData.stats.min_transaction)}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Debit Count:</span>

                    <span className="text-slate-300 float-right">

                      {analysisData.stats.debit_count}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Credit Count:</span>

                    <span className="text-slate-300 float-right">

                      {analysisData.stats.credit_count}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Avg Debit:</span>

                    <span className="text-slate-300 float-right">

                      {formatAmt(analysisData.stats.avg_debit)}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Avg Credit:</span>

                    <span className="text-slate-300 float-right">

                      {formatAmt(analysisData.stats.avg_credit)}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Total Debit:</span>

                    <span className="text-rose-400 float-right">

                      {formatAmt(analysisData.stats.total_debit)}

                    </span>

                  </div>



                  <div className="text-sm">

                    <span className="text-slate-500">Total Credit:</span>

                    <span className="text-emerald-400 float-right">

                      {formatAmt(analysisData.stats.total_credit)}

                    </span>

                  </div>

                </div>

              </div>

            </div>



            {/* Top Transactions */}

            <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

              <h3 className="text-emerald-400 font-semibold mb-4">

                Top Transactions

              </h3>



              <div className="overflow-x-auto custom-scrollbar">

                <table className="w-full text-left text-sm text-slate-300">

                  <thead className="text-xs text-slate-400 bg-[#020b09] uppercase">

                    <tr>

                      <th className="px-4 py-3 font-medium">Rank</th>

                      <th className="px-4 py-3 font-medium">Date</th>

                      <th className="px-4 py-3 font-medium">Description</th>

                      <th className="px-4 py-3 font-medium text-right">Debit</th>

                      <th className="px-4 py-3 font-medium text-right">Credit</th>

                      <th className="px-4 py-3 font-medium text-right">Amount</th>

                    </tr>

                  </thead>



                  <tbody className="divide-y divide-emerald-500/10">

                    {analysisData.top_transactions.overall.map((t, idx) => (

                      <tr

                        key={idx}

                        className="hover:bg-white/[0.02]"

                      >

                        <td className="px-4 py-2">

                          {idx + 1}

                        </td>



                        <td className="px-4 py-2 whitespace-nowrap">

                          {formatDate(t.transaction_date)}

                        </td>



                        <td

                          className="px-4 py-2 truncate max-w-xs"

                          title={t.description}

                        >

                          {t.description}

                        </td>



                        <td className="px-4 py-2 text-right text-rose-400">

                          {t.debit > 0 ? formatAmt(t.debit) : '-'}

                        </td>



                        <td className="px-4 py-2 text-right text-emerald-400">

                          {t.credit > 0 ? formatAmt(t.credit) : '-'}

                        </td>



                        <td className="px-4 py-2 text-right font-medium">

                          {formatAmt(t.amount)}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>



            {/* Charts Section */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:break-inside-avoid">

              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Amount Distribution

                </h3>



                <div

                  ref={distChartRef}

                  className="w-full h-64"

                ></div>

              </div>



              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Daily Financial Activity

                </h3>



                <div

                  ref={dailyChartRef}

                  className="w-full h-64"

                ></div>

              </div>

            </div>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:break-inside-avoid">

              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Monthly Net Flow

                </h3>



                <div

                  ref={monthlyChartRef}

                  className="w-full h-64"

                ></div>

              </div>



              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4 flex justify-between">

                  <span>Balance Trend</span>



                  <span className="text-sm font-normal text-slate-400">

                    Current: {formatAmt(analysisData.balance.closing)}

                  </span>

                </h3>



                <div

                  ref={balanceChartRef}

                  className="w-full h-64"

                ></div>

              </div>

            </div>



            {/* Multi-file Comparison */}

            {isMultiFile && analysisData.file_comparison && (

              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4 print:break-inside-avoid">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  File-wise Financial Comparison

                </h3>



                <div className="overflow-x-auto custom-scrollbar">

                  <table className="w-full text-left text-sm text-slate-300">

                    <thead className="text-xs text-slate-400 bg-[#020b09] uppercase">

                      <tr>

                        <th className="px-4 py-3 font-medium">

                          Account Name / File

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Tx Count

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Debit

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Credit

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Total Value

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Highest Tx

                        </th>

                      </tr>

                    </thead>



                    <tbody className="divide-y divide-emerald-500/10">

                      {analysisData.file_comparison.map((f, idx) => (

                        <tr

                          key={idx}

                          className="hover:bg-white/[0.02]"

                        >

                          <td className="px-4 py-2 font-medium text-emerald-300">

                            {f.account_name}

                          </td>



                          <td className="px-4 py-2 text-right">

                            {f.transaction_count}

                          </td>



                          <td className="px-4 py-2 text-right text-rose-400">

                            {formatAmt(f.debit)}

                          </td>



                          <td className="px-4 py-2 text-right text-emerald-400">

                            {formatAmt(f.credit)}

                          </td>



                          <td className="px-4 py-2 text-right font-medium">

                            {formatAmt(f.total_value)}

                          </td>



                          <td className="px-4 py-2 text-right">

                            {formatAmt(f.highest_tx)}

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

            )}



            {/* Frequencies and Round Values */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:break-inside-avoid">

              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <h3 className="text-emerald-400 font-semibold mb-4">

                  Most Frequent Amounts

                </h3>



                <div className="overflow-x-auto custom-scrollbar max-h-80">

                  <table className="w-full text-left text-sm text-slate-300 relative">

                    <thead className="text-xs text-slate-400 bg-[#020b09] uppercase sticky top-0">

                      <tr>

                        <th className="px-4 py-3 font-medium">

                          Amount

                        </th>

                        <th className="px-4 py-3 font-medium">

                          Occurrences

                        </th>

                        <th className="px-4 py-3 font-medium">

                          Type

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Total Value

                        </th>

                      </tr>

                    </thead>



                    <tbody className="divide-y divide-emerald-500/10">

                      {analysisData.most_frequent_amounts.slice(0,25).map((f, idx) => (

                        <tr

                          key={idx}

                          className="hover:bg-white/[0.02]"

                        >

                          <td className="px-4 py-2 font-medium">

                            {formatAmt(f.amount)}

                          </td>



                          <td className="px-4 py-2">

                            {f.occurrences}

                          </td>



                          <td className="px-4 py-2">

                            {f.type}

                          </td>



                          <td className="px-4 py-2 text-right">

                            {formatAmt(f.total_value)}

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>



              <div className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4">

                <div className="flex justify-between items-center mb-4">

                  <h3 className="text-emerald-400 font-semibold">

                    Round-Value Transactions

                  </h3>



                  <span className="text-xs text-slate-500 bg-[#020b09] px-2 py-1 rounded">

                    Count: {analysisData.round_values.total_count}

                  </span>

                </div>



                <div className="overflow-x-auto custom-scrollbar max-h-80">

                  <table className="w-full text-left text-sm text-slate-300 relative">

                    <thead className="text-xs text-slate-400 bg-[#020b09] uppercase sticky top-0">

                      <tr>

                        <th className="px-4 py-3 font-medium">

                          Amount

                        </th>

                        <th className="px-4 py-3 font-medium">

                          Occurrences

                        </th>

                        <th className="px-4 py-3 font-medium text-right">

                          Total Value

                        </th>

                      </tr>

                    </thead>



                    <tbody className="divide-y divide-emerald-500/10">

                      {analysisData.round_values.details.slice(0,25).map((f, idx) => (

                        <tr

                          key={idx}

                          className="hover:bg-white/[0.02]"

                        >

                          <td className="px-4 py-2 font-medium">

                            {formatAmt(f.amount)}

                          </td>



                          <td className="px-4 py-2">

                            {f.occurrences}

                          </td>



                          <td className="px-4 py-2 text-right">

                            {formatAmt(f.total_value)}

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>



          </div>

        ) : (

          <div className="text-center py-20 text-slate-500">

            Please select a case and statement(s) to view the analysis.

          </div>

        )}

      </div>

    </div>

  );

}