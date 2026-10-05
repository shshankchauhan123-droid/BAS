import React from "react";

export default function ReportBuilder({
  columns = [],
  xAxis,
  setXAxis,
  yAxes = [],
  setYAxes,
  aggregation,
  setAggregation,
  granularity,
  setGranularity,
  chartType,
  setChartType,
  sortOrder,
  setSortOrder,
}) {
  if (!columns || columns.length === 0) return null;

  // Split columns into Date, Numeric, Text for smart dropdown ordering
  const dateColumns = columns.filter((c) => c.isDate);
  const numericColumns = columns.filter((c) => c.isNumeric);
  const otherColumns = columns.filter((c) => !c.isDate && !c.isNumeric);

  const activeXColDef = columns.find((c) => c.name === xAxis);
  const isDateX = activeXColDef?.isDate;

  // Toggle Y-axis selection
  const handleToggleY = (colName) => {
    if (yAxes.includes(colName)) {
      if (yAxes.length > 1) {
        setYAxes(yAxes.filter((y) => y !== colName));
      }
    } else {
      setYAxes([...yAxes, colName]);
    }
  };

  const chartTypeOptions = [
    { id: "area", label: "Area Timeline", icon: "📈" },
    { id: "line", label: "Line Chart", icon: "📉" },
    { id: "bar", label: "Bar Chart", icon: "📊" },
    { id: "scatter", label: "Scatter Plot", icon: "⚬" },
  ];

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#031512]/95 to-[#020d0b]/98 p-5 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-emerald-500/10 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">⚙️</span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Step 2 — Report Builder & Dimension Mapping
            </h3>
            <p className="text-[11px] text-slate-400">
              Customize axes, series metrics, grouping granularity, and visualization type.
            </p>
          </div>
        </div>

        {/* Quick Chart Type Selector */}
        <div className="flex items-center gap-1 bg-[#010c0a] p-1 rounded-xl border border-emerald-500/20">
          {chartTypeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setChartType(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                chartType === opt.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{opt.icon}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Builder Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* X-AXIS SELECTOR */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
            <span>X-Axis Dimension</span>
            {isDateX && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                Timeline Ready
              </span>
            )}
          </label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value)}
            className="w-full bg-[#021310] border border-emerald-500/30 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer font-medium"
          >
            {dateColumns.length > 0 && (
              <optgroup label="📅 Detected Date & Timeline Columns">
                {dateColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} (Date)
                  </option>
                ))}
              </optgroup>
            )}
            {numericColumns.length > 0 && (
              <optgroup label="🔢 Numeric Columns">
                {numericColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </optgroup>
            )}
            {otherColumns.length > 0 && (
              <optgroup label="🔤 Categorical / Text Columns">
                {otherColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} (Text)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* TIME GRANULARITY (If X-axis is Date) */}
        {isDateX ? (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
              Timeline Granularity
            </label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="w-full bg-[#021310] border border-emerald-500/30 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer font-medium"
            >
              <option value="raw">Raw Transactions (Continuous)</option>
              <option value="daily">Daily Interval</option>
              <option value="weekly">Weekly Rollup</option>
              <option value="monthly">Monthly Rollup</option>
              <option value="quarterly">Quarterly Rollup</option>
              <option value="yearly">Yearly Rollup</option>
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
              Sort Sequence
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-[#021310] border border-emerald-500/30 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer font-medium"
            >
              <option value="asc">Ascending (A → Z or Low → High)</option>
              <option value="desc">Descending (Z → A or High → Low)</option>
            </select>
          </div>
        )}

        {/* AGGREGATION METHOD */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
            Aggregation Method
          </label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            className="w-full bg-[#021310] border border-emerald-500/30 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer font-medium"
          >
            <option value="sum">Sum (Total Aggregate)</option>
            <option value="average">Average (Mean Value)</option>
            <option value="count">Count (Frequency)</option>
            <option value="max">Maximum (Peak)</option>
            <option value="min">Minimum (Trough)</option>
          </select>
        </div>

        {/* SORT / ORDER */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
            Chronology / Sort
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full bg-[#021310] border border-emerald-500/30 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer font-medium"
          >
            <option value="asc">Chronological (Oldest → Newest)</option>
            <option value="desc">Reverse Chronological (Newest → Oldest)</option>
          </select>
        </div>
      </div>

      {/* Y-AXIS MULTI-SELECT SERIES */}
      <div className="mt-4 pt-3 border-t border-emerald-500/10">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <span>Y-Axis Value Series (Select One or Multiple)</span>
            <span className="text-[10px] text-slate-400 font-normal">
              — Multi-series auto-renders comparison curves
            </span>
          </label>
          <span className="text-[10px] text-emerald-300 font-mono">
            {yAxes.length} series selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {numericColumns.map((col) => {
            const isSelected = yAxes.includes(col.name);
            return (
              <button
                key={col.name}
                type="button"
                onClick={() => handleToggleY(col.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    : "border-emerald-900/40 bg-[#021310]/60 text-slate-400 hover:text-slate-200 hover:border-emerald-700/50"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded flex items-center justify-center text-[9px] border ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-400 text-black font-bold"
                      : "border-slate-600 bg-black/40"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span>{col.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({col.detectedFormat || col.type})
                </span>
              </button>
            );
          })}

          {/* If there are no detected numeric columns or user wants to pick other columns */}
          {numericColumns.length === 0 && (
            <div className="text-xs text-amber-400 p-2 rounded-lg border border-amber-500/30 bg-amber-950/20">
              ⚠️ No numeric columns detected automatically. Please check your data preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
