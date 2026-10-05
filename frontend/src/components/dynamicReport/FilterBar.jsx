import React, { useMemo } from "react";

export default function FilterBar({
  columns = [],
  datasetMeta = {},
  filters,
  setFilters,
  totalRowCount = 0,
  filteredRowCount = 0,
}) {
  const { roles = {} } = datasetMeta;
  const hasDebitCredit = Boolean(roles.debit && roles.credit);

  // Discover categorical columns with manageable cardinalities (2 to 25 unique values)
  const categoricalCols = useMemo(() => {
    return columns.filter(
      (c) =>
        c.type === "text" &&
        c.uniqueValues >= 2 &&
        c.uniqueValues <= 35 &&
        c.name !== roles.narration &&
        c.name !== roles.reference
    );
  }, [columns, roles]);

  const activeCategoryCol = categoricalCols[0]?.name || null;

  // Clear all filters
  const handleResetFilters = () => {
    setFilters({
      search: "",
      startDate: "",
      endDate: "",
      txType: "all",
      categoryVal: "all",
      minAmount: "",
      maxAmount: "",
    });
  };

  const isFiltered =
    filters.search ||
    filters.startDate ||
    filters.endDate ||
    filters.txType !== "all" ||
    filters.categoryVal !== "all" ||
    filters.minAmount ||
    filters.maxAmount;

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-[#031512]/90 p-4 backdrop-blur-xl shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Row 1: Search + Date Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Global Search Bar */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400/70">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search narration, ref, amount..."
              className="w-full bg-[#010e0b] border border-emerald-500/30 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, search: "" })}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Range: From */}
          <div className="flex items-center gap-1.5 bg-[#010e0b] px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">From:</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex items-center gap-1.5 bg-[#010e0b] px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">To:</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
            />
          </div>

          {/* Transaction Type Filter (Debit/Credit/All) */}
          {hasDebitCredit && (
            <div className="flex items-center bg-[#010e0b] p-1 rounded-xl border border-emerald-500/30 text-xs">
              <button
                type="button"
                onClick={() => setFilters({ ...filters, txType: "all" })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filters.txType === "all"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, txType: "debit" })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filters.txType === "debit"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Debit
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, txType: "credit" })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filters.txType === "credit"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Credit
              </button>
            </div>
          )}

          {/* Dynamic Category Filter */}
          {activeCategoryCol && (
            <div className="flex items-center gap-1.5 bg-[#010e0b] px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {activeCategoryCol}:
              </span>
              <select
                value={filters.categoryVal}
                onChange={(e) => setFilters({ ...filters, categoryVal: e.target.value })}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="all">All Values</option>
                {categoricalCols
                  .find((c) => c.name === activeCategoryCol)
                  ?.sampleValues?.map((val) => (
                    <option key={String(val)} value={String(val)}>
                      {String(val)}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Right side: Active count badge + Reset Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-mono font-bold text-emerald-400">
              {filteredRowCount.toLocaleString()}
            </span>{" "}
            of <span className="font-mono text-slate-300">{totalRowCount.toLocaleString()}</span> rows
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs font-medium hover:bg-rose-900/30 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>✕</span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
