import React, { useMemo, useState } from "react";

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyFull(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function TransactionGraphView({
  transactions = [],
  summary = null,
  formatDate = (d) => d,
}) {
  const [activeTab, setActiveTab] = useState("flow"); // "flow", "balance", "channels", "forensics"
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // ------------------------------------------------------------
  // Process Transactions Data for Charts
  // ------------------------------------------------------------
  const processedData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        dailyFlow: [],
        balanceHistory: [],
        channelDistribution: [],
        topDebits: [],
        topCredits: [],
        counterparties: [],
        metrics: {
          totalCredit: 0,
          totalDebit: 0,
          netFlow: 0,
          creditCount: 0,
          debitCount: 0,
          maxCredit: 0,
          maxDebit: 0,
          avgTransaction: 0,
          highValueCount: 0,
        },
      };
    }

    // Sort chronologically (oldest to newest for visual timeline)
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.transaction_date || 0);
      const dateB = new Date(b.transaction_date || 0);
      return dateA - dateB || (a.id || 0) - (b.id || 0);
    });

    let totalCredit = 0;
    let totalDebit = 0;
    let creditCount = 0;
    let debitCount = 0;
    let maxCredit = 0;
    let maxDebit = 0;
    let highValueCount = 0;

    // Daily Flow Aggregation
    const flowMap = new Map();
    const channelMap = new Map();
    const entityMap = new Map();

    sorted.forEach((tx) => {
      const cr = Number(tx.credit) || 0;
      const dr = Number(tx.debit) || 0;
      const bal = tx.balance !== null && tx.balance !== undefined ? Number(tx.balance) : null;
      const dateStr = tx.transaction_date ? String(tx.transaction_date).split("T")[0] : "Unknown";

      if (cr > 0) {
        totalCredit += cr;
        creditCount++;
        if (cr > maxCredit) maxCredit = cr;
        if (cr >= 50000) highValueCount++;
      }
      if (dr > 0) {
        totalDebit += dr;
        debitCount++;
        if (dr > maxDebit) maxDebit = dr;
        if (dr >= 50000) highValueCount++;
      }

      // Daily flow
      if (!flowMap.has(dateStr)) {
        flowMap.set(dateStr, {
          date: dateStr,
          credit: 0,
          debit: 0,
          txCount: 0,
          lastBalance: bal,
        });
      }
      const dayEntry = flowMap.get(dateStr);
      dayEntry.credit += cr;
      dayEntry.debit += dr;
      dayEntry.txCount += 1;
      if (bal !== null) {
        dayEntry.lastBalance = bal;
      }

      // Channel detection
      const rawText = (tx.description || tx.raw_narration || "").toUpperCase();
      let channel = tx.channel || "OTHER";
      if (!tx.channel) {
        if (rawText.includes("UPI/")) channel = "UPI";
        else if (rawText.includes("IMPS")) channel = "IMPS";
        else if (rawText.includes("NEFT") || rawText.includes("RTGS")) channel = "NEFT/RTGS";
        else if (rawText.includes("ATM") || rawText.includes("CASH WDL") || rawText.includes("NWD")) channel = "ATM CASH";
        else if (rawText.includes("CDM") || rawText.includes("CASH DEP")) channel = "CASH DEPOSIT";
        else if (rawText.includes("CHQ") || rawText.includes("CHEQUE") || tx.cheque_number) channel = "CHEQUE";
        else if (rawText.includes("POS ") || rawText.includes("ECOM")) channel = "POS / E-COM";
        else if (rawText.includes("CHG") || rawText.includes("CHARGES") || rawText.includes("GST") || rawText.includes("INT.PD")) channel = "CHARGES / INT";
      }

      const channelUpper = String(channel).toUpperCase();
      if (!channelMap.has(channelUpper)) {
        channelMap.set(channelUpper, { channel: channelUpper, amount: 0, count: 0, credits: 0, debits: 0 });
      }
      const chEntry = channelMap.get(channelUpper);
      chEntry.amount += cr + dr;
      chEntry.credits += cr;
      chEntry.debits += dr;
      chEntry.count += 1;

      // Extract counterparty / beneficiary hint from narration
      let counterparty = "General Transaction";
      if (rawText.includes("UPI/")) {
        const parts = rawText.split("/");
        if (parts.length >= 3 && parts[2]) {
          counterparty = parts[2].trim().slice(0, 30);
        } else if (parts.length >= 2 && parts[1]) {
          counterparty = parts[1].trim().slice(0, 30);
        }
      } else if (rawText.includes("IMPS/") || rawText.includes("NEFT-")) {
        const parts = rawText.split(/[-/]/);
        if (parts.length >= 3 && parts[2]) {
          counterparty = parts[2].trim().slice(0, 30);
        }
      } else {
        const snippet = rawText.split(/\s{2,}|\n/)[0]?.slice(0, 30) || "Direct Transfer";
        counterparty = snippet;
      }

      if (counterparty && counterparty.length > 3) {
        if (!entityMap.has(counterparty)) {
          entityMap.set(counterparty, { name: counterparty, amount: 0, credits: 0, debits: 0, count: 0 });
        }
        const ent = entityMap.get(counterparty);
        ent.amount += cr + dr;
        ent.credits += cr;
        ent.debits += dr;
        ent.count += 1;
      }
    });

    const dailyFlow = Array.from(flowMap.values());
    const balanceHistory = sorted
      .filter((tx) => tx.balance !== null && tx.balance !== undefined)
      .map((tx) => ({
        id: tx.id,
        date: tx.transaction_date ? String(tx.transaction_date).split("T")[0] : "",
        balance: Number(tx.balance),
        narration: tx.description || tx.raw_narration || "",
        credit: Number(tx.credit) || 0,
        debit: Number(tx.debit) || 0,
      }));

    // Channel array sorted by total amount
    const totalVolume = totalCredit + totalDebit || 1;
    const channelDistribution = Array.from(channelMap.values())
      .map((c) => ({
        ...c,
        percentage: ((c.amount / totalVolume) * 100).toFixed(1),
      }))
      .sort((a, b) => b.amount - a.amount);

    // Top debits & credits
    const topDebits = [...transactions]
      .filter((t) => Number(t.debit) > 0)
      .sort((a, b) => Number(b.debit) - Number(a.debit))
      .slice(0, 5);

    const topCredits = [...transactions]
      .filter((t) => Number(t.credit) > 0)
      .sort((a, b) => Number(b.credit) - Number(a.credit))
      .slice(0, 5);

    const counterparties = Array.from(entityMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return {
      dailyFlow,
      balanceHistory,
      channelDistribution,
      topDebits,
      topCredits,
      counterparties,
      metrics: {
        totalCredit: summary?.total_credit !== undefined ? Number(summary.total_credit) : totalCredit,
        totalDebit: summary?.total_debit !== undefined ? Number(summary.total_debit) : totalDebit,
        netFlow: (summary?.total_credit !== undefined && summary?.total_debit !== undefined)
          ? Number(summary.total_credit) - Number(summary.total_debit)
          : totalCredit - totalDebit,
        creditCount,
        debitCount,
        maxCredit: summary?.max_credit || maxCredit,
        maxDebit: summary?.max_debit || maxDebit,
        avgTransaction: (totalCredit + totalDebit) / (creditCount + debitCount || 1),
        highValueCount,
      },
    };
  }, [transactions, summary]);

  // If no transactions
  if (!transactions || transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 mb-4 border border-cyan-400/20">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h4 className="text-base font-bold text-white">No Visual Data Available</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          No transactions are currently available to chart. Please ensure the file has completed processing.
        </p>
      </div>
    );
  }

  const { dailyFlow, balanceHistory, channelDistribution, topDebits, topCredits, counterparties, metrics } = processedData;

  // ------------------------------------------------------------
  // SVG Chart Computations: Cash Flow Bar Chart
  // ------------------------------------------------------------
  const maxDayAmount = Math.max(
    ...dailyFlow.map((d) => Math.max(d.credit, d.debit)),
    1000
  );

  // SVG Chart Computations: Balance Curve
  const minBalance = Math.min(...balanceHistory.map((b) => b.balance), 0);
  const maxBalance = Math.max(...balanceHistory.map((b) => b.balance), 1000);
  const balanceRange = maxBalance - minBalance || 1;

  // Build Balance SVG points
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  const balancePoints = balanceHistory.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(balanceHistory.length - 1, 1)) * plotWidth;
    const y = svgHeight - paddingY - ((pt.balance - minBalance) / balanceRange) * plotHeight;
    return { x, y, ...pt };
  });

  const balancePathD = balancePoints.length > 0
    ? balancePoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x},${pt.y}`, "")
    : "";

  const balanceAreaD = balancePoints.length > 0
    ? `${balancePathD} L ${balancePoints[balancePoints.length - 1].x},${svgHeight - paddingY} L ${balancePoints[0].x},${svgHeight - paddingY} Z`
    : "";

  return (
    <div className="space-y-6">
      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">Total Inflow (Cr)</span>
            <span className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
          </div>
          <p className="text-xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {formatCurrency(metrics.totalCredit)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-300/70 font-medium">
            <span>{metrics.creditCount} transactions</span>
            <span>&bull;</span>
            <span>Peak: {formatCurrency(metrics.maxCredit)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300/80">Total Outflow (Dr)</span>
            <span className="h-6 w-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </span>
          </div>
          <p className="text-xl font-extrabold text-rose-400 font-mono tracking-tight">
            {formatCurrency(metrics.totalDebit)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-rose-300/70 font-medium">
            <span>{metrics.debitCount} transactions</span>
            <span>&bull;</span>
            <span>Peak: {formatCurrency(metrics.maxDebit)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/80">Net Cash Flow</span>
            <span className="h-6 w-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className={`text-xl font-extrabold font-mono tracking-tight ${metrics.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {metrics.netFlow >= 0 ? `+${formatCurrency(metrics.netFlow)}` : formatCurrency(metrics.netFlow)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-cyan-300/70 font-medium">
            <span>Flow Ratio: {(metrics.totalCredit / (metrics.totalDebit || 1)).toFixed(2)}x</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">High-Value Flags</span>
            <span className="h-6 w-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className="text-xl font-extrabold text-amber-400 font-mono tracking-tight">
            {metrics.highValueCount}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-300/70 font-medium">
            <span>Transactions &ge; ₹50,000</span>
          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("flow")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "flow"
                ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/20"
                : "text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.05]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Cash Flow Timeline
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("balance")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "balance"
                ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20"
                : "text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.05]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Balance Curve
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("channels")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "channels"
                ? "bg-indigo-400 text-black shadow-lg shadow-indigo-400/20"
                : "text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.05]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Channels & Methods
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("forensics")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "forensics"
                ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                : "text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.05]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Top Exposures
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
            <span>Credits (Inflow)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
            <span>Debits (Outflow)</span>
          </div>
        </div>
      </div>

      {/* Tab 1: Cash Flow Timeline (Bar Chart) */}
      {activeTab === "flow" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h5 className="text-sm font-bold text-white">Daily Inflow vs Outflow Distribution</h5>
              <p className="text-xs text-slate-400">Comparing daily aggregated credits and debits over time</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {dailyFlow.length} Active Days
            </span>
          </div>

          {dailyFlow.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No date distribution available</div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2 overflow-x-auto border-b border-white/[0.06]">
                {dailyFlow.slice(-30).map((day, idx) => {
                  const creditHeight = Math.max((day.credit / maxDayAmount) * 100, 2);
                  const debitHeight = Math.max((day.debit / maxDayAmount) * 100, 2);

                  return (
                    <div
                      key={day.date || idx}
                      className="group relative flex-1 min-w-[18px] max-w-[36px] flex flex-col items-center justify-end h-full cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(day)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-[10px] shadow-2xl">
                        <div className="font-bold text-white mb-0.5">{formatDate(day.date)}</div>
                        <div className="text-emerald-400">Cr: +{formatCurrencyFull(day.credit)}</div>
                        <div className="text-rose-400">Dr: -{formatCurrencyFull(day.debit)}</div>
                      </div>

                      {/* Bar Pair */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-full">
                        <div
                          style={{ height: `${creditHeight}%` }}
                          className="w-1/2 rounded-t-sm bg-gradient-to-t from-emerald-500/60 to-emerald-400 transition-all group-hover:brightness-125"
                        />
                        <div
                          style={{ height: `${debitHeight}%` }}
                          className="w-1/2 rounded-t-sm bg-gradient-to-t from-rose-500/60 to-rose-400 transition-all group-hover:brightness-125"
                        />
                      </div>

                      <span className="text-[9px] font-mono text-slate-500 mt-2 truncate w-full text-center">
                        {String(day.date).slice(-2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hover detail banner */}
              {hoveredPoint ? (
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2 text-xs">
                  <span className="font-semibold text-white">Date: {formatDate(hoveredPoint.date)}</span>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-emerald-400 font-bold">+Cr {formatCurrencyFull(hoveredPoint.credit)}</span>
                    <span className="text-rose-400 font-bold">-Dr {formatCurrencyFull(hoveredPoint.debit)}</span>
                    {hoveredPoint.lastBalance !== null && (
                      <span className="text-slate-300">Bal: {formatCurrencyFull(hoveredPoint.lastBalance)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic text-center">
                  Hover over bars to inspect daily credits, debits, and closing balance.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Balance Curve (SVG Line Chart) */}
      {activeTab === "balance" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h5 className="text-sm font-bold text-white">Account Balance Evolution Trajectory</h5>
              <p className="text-xs text-slate-400">Step-by-step running balance timeline across transactions</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-rose-400">Low: {formatCurrency(minBalance)}</span>
              <span className="text-emerald-400">Peak: {formatCurrency(maxBalance)}</span>
            </div>
          </div>

          {balanceHistory.length < 2 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Insufficient balance points to plot curve (minimum 2 required)
            </div>
          ) : (
            <div className="relative">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 overflow-visible">
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(255,255,255,0.08)" />

                {/* Area under curve */}
                <path d={balanceAreaD} fill="url(#balanceGradient)" />

                {/* Balance stroke curve */}
                <path d={balancePathD} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Highlight points */}
                {balancePoints.map((pt, i) => (
                  <circle
                    key={pt.id || i}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    className="fill-cyan-400 hover:fill-white hover:r-5 cursor-pointer transition-all stroke-slate-900 stroke-2"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {/* Hover detail */}
              {hoveredPoint && hoveredPoint.balance !== undefined && (
                <div className="mt-3 flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2 text-xs">
                  <span className="font-semibold text-white">Date: {formatDate(hoveredPoint.date)}</span>
                  <span className="text-slate-300 truncate max-w-sm">{hoveredPoint.narration}</span>
                  <span className="text-cyan-400 font-mono font-bold">Balance: {formatCurrencyFull(hoveredPoint.balance)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Channels & Methods Breakdown */}
      {activeTab === "channels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-6 space-y-4">
            <div>
              <h5 className="text-sm font-bold text-white">Transaction Channel Distribution</h5>
              <p className="text-xs text-slate-400">Total volume and split by clearing mechanism</p>
            </div>

            <div className="space-y-3 pt-2">
              {channelDistribution.map((ch) => (
                <div key={ch.channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{ch.channel}</span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400 text-[11px]">{ch.count} txs ({ch.percentage}%)</span>
                      <span className="font-bold text-white">{formatCurrency(ch.amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden flex">
                    <div
                      style={{ width: `${ch.percentage}%` }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-6 space-y-4">
            <div>
              <h5 className="text-sm font-bold text-white">Frequent Counterparties / Payees</h5>
              <p className="text-xs text-slate-400">Top entities detected from transfer narrations</p>
            </div>

            <div className="space-y-2.5 pt-2">
              {counterparties.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No counterparties identified</p>
              ) : (
                counterparties.map((ent, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-slate-200 truncate">{ent.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ent.count} transactions</p>
                    </div>
                    <div className="text-right font-mono flex-shrink-0">
                      <p className="text-xs font-bold text-white">{formatCurrency(ent.amount)}</p>
                      <p className="text-[10px] text-slate-400">
                        {ent.credits > 0 && <span className="text-emerald-400 mr-2">+{formatCurrency(ent.credits)}</span>}
                        {ent.debits > 0 && <span className="text-rose-400">-{formatCurrency(ent.debits)}</span>}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Top High-Value Exposures (Forensics) */}
      {activeTab === "forensics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Debits */}
          <div className="rounded-2xl border border-rose-500/20 bg-[#020b09] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-rose-300">Top 5 Largest Outflows (Debits)</h5>
                <p className="text-xs text-slate-400">Highest value withdrawals and payments</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-rose-400" />
            </div>

            <div className="space-y-2.5 pt-2">
              {topDebits.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="p-3 rounded-xl border border-rose-500/10 bg-rose-950/10 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{formatDate(tx.transaction_date)}</span>
                    <span className="text-sm font-extrabold font-mono text-rose-400">
                      -{formatCurrencyFull(tx.debit)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-1">
                    {tx.description || tx.raw_narration || "Debit Transfer"}
                  </p>
                  {tx.balance !== null && (
                    <p className="text-[10px] font-mono text-slate-500">
                      Post-tx Balance: {formatCurrencyFull(tx.balance)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top Credits */}
          <div className="rounded-2xl border border-emerald-500/20 bg-[#020b09] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-emerald-300">Top 5 Largest Inflows (Credits)</h5>
                <p className="text-xs text-slate-400">Highest value deposits and incoming funds</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-2.5 pt-2">
              {topCredits.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-950/10 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{formatDate(tx.transaction_date)}</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-400">
                      +{formatCurrencyFull(tx.credit)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-1">
                    {tx.description || tx.raw_narration || "Credit Deposit"}
                  </p>
                  {tx.balance !== null && (
                    <p className="text-[10px] font-mono text-slate-500">
                      Post-tx Balance: {formatCurrencyFull(tx.balance)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
