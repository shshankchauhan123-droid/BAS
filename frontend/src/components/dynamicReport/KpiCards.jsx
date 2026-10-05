import React from "react";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/formatters";

export default function KpiCards({
  kpis,
  datasetMeta = {},
}) {
  if (!kpis) return null;

  const {
    totalRecords = 0,
    hasFinancialColumns = false,
    totalDebit = 0,
    totalCredit = 0,
    netFlow = 0,
    openingBalance = null,
    closingBalance = null,
    dateRangeStr = "-",
    summaryMetrics = [],
  } = kpis;

  const isNetPositive = netFlow >= 0;

  return (
    <div className="w-full space-y-3">
      {/* Financial Executive Summary Cards (when financial columns exist) */}
      {hasFinancialColumns && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Transactions */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#031814]/90 to-[#020f0d]/95 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Total Records
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              {totalRecords.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
              {dateRangeStr}
            </div>
            <div className="absolute top-2 right-2.5 text-xs text-emerald-400/40">📊</div>
          </div>

          {/* Total Debit */}
          <div className="p-4 rounded-2xl border border-rose-500/25 bg-gradient-to-b from-rose-950/20 to-[#020f0d]/95 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-all">
            <div className="text-[10px] uppercase font-bold tracking-wider text-rose-300/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Total Debit
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-300 font-mono mt-1" title={formatCurrency(totalDebit)}>
              {formatCurrencyCompact(totalDebit)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Outflow Volume
            </div>
            <div className="absolute top-2 right-2.5 text-xs text-rose-400/40">🔻</div>
          </div>

          {/* Total Credit */}
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-[#020f0d]/95 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-400/50 transition-all">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Total Credit
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-1" title={formatCurrency(totalCredit)}>
              {formatCurrencyCompact(totalCredit)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Inflow Volume
            </div>
            <div className="absolute top-2 right-2.5 text-xs text-emerald-400/40">🔺</div>
          </div>

          {/* Net Flow */}
          <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all ${
            isNetPositive
              ? "border-emerald-500/30 bg-emerald-950/15 hover:border-emerald-400/50"
              : "border-amber-500/30 bg-amber-950/15 hover:border-amber-400/50"
          }`}>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Net Flow (Cr - Dr)
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${isNetPositive ? "text-emerald-300" : "text-amber-400"}`} title={formatCurrency(netFlow)}>
              {isNetPositive ? "+" : ""}{formatCurrencyCompact(netFlow)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {isNetPositive ? "Surplus Cashflow" : "Net Deficit"}
            </div>
            <div className="absolute top-2 right-2.5 text-xs text-teal-400/40">⚖️</div>
          </div>

          {/* Opening Balance */}
          {openingBalance !== null && (
            <div className="p-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-[#020f0d]/95 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
              <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-300/80">
                Opening Balance
              </div>
              <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono mt-1" title={formatCurrency(openingBalance)}>
                {formatCurrencyCompact(openingBalance)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Starting Position
              </div>
              <div className="absolute top-2 right-2.5 text-xs text-cyan-400/40">🔓</div>
            </div>
          )}

          {/* Closing Balance */}
          {closingBalance !== null && (
            <div className="p-4 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-950/25 to-[#020f0d]/95 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-teal-400/50 transition-all">
              <div className="text-[10px] uppercase font-bold tracking-wider text-teal-300">
                Closing Balance
              </div>
              <div className="text-xl sm:text-2xl font-black text-teal-200 font-mono mt-1" title={formatCurrency(closingBalance)}>
                {formatCurrencyCompact(closingBalance)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Current Position
              </div>
              <div className="absolute top-2 right-2.5 text-xs text-teal-400/40">🔒</div>
            </div>
          )}
        </div>
      )}

      {/* Selected Metric Cards (For any dataset or chosen series) */}
      {summaryMetrics.length > 0 && !hasFinancialColumns && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-[#031814]/90 backdrop-blur-xl shadow-lg">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Rows</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{totalRecords.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{dateRangeStr}</div>
          </div>
          {summaryMetrics.slice(0, 4).map((m) => (
            <div key={m.colName} className="p-4 rounded-2xl border border-emerald-500/20 bg-[#031814]/90 backdrop-blur-xl shadow-lg">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 truncate" title={m.colName}>
                {m.colName}
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono mt-1">
                {formatNumber(m.sum)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                <span>Avg: {formatNumber(m.avg)}</span>
                <span>Max: {formatNumber(m.max)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
