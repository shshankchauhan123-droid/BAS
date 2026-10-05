import React from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";

export default function DataPreviewModal({
  isOpen,
  onClose,
  dataset,
}) {
  if (!isOpen || !dataset) return null;

  const {
    fileName,
    rowCount,
    columnCount,
    columns = [],
    previewRows = [],
    dateRange = {},
  } = dataset;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-emerald-500/30 bg-[#02110e] text-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-[#031814]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-emerald-400/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Dataset Schema & Data Preview
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {fileName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-950/20">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Rows</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">{rowCount.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-950/20">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Columns Detected</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{columnCount}</div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-950/20 col-span-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Detected Date Span</div>
              <div className="text-sm font-semibold text-slate-200 font-mono mt-1">
                {dateRange.start && dateRange.end
                  ? `${dateRange.start}  →  ${dateRange.end}`
                  : "No date column detected"}
              </div>
            </div>
          </div>

          {/* Detected Schema Breakdown */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400/90 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Inferred Column Schema & Roles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {columns.map((col) => (
                <div
                  key={col.name}
                  className="p-3 rounded-xl border border-emerald-500/15 bg-[#031915]/60 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate" title={col.name}>
                      {col.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full shrink-0 ${
                        col.type === "currency"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : col.type === "number"
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                          : col.type === "date"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "bg-slate-700/40 text-slate-300 border border-slate-600/30"
                      }`}
                    >
                      {col.detectedFormat || col.type}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Unique: <b className="text-slate-300 font-mono">{col.uniqueValues}</b></span>
                    {col.financialRole && (
                      <span className="text-emerald-400 font-medium">Role: {col.financialRole}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* First 10 Rows Raw Data Preview */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400/90 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Raw Sample Rows (First 10)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#010c0a]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-emerald-500/20 bg-emerald-950/40 text-slate-300">
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400">#</th>
                    {columns.map((c) => (
                      <th key={c.name} className="py-2.5 px-3 font-semibold text-slate-300 whitespace-nowrap">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-emerald-500/[0.04]">
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      {columns.map((c) => {
                        const val = row[c.name];
                        return (
                          <td key={c.name} className="py-2 px-3 whitespace-nowrap font-mono text-slate-300 text-[11px]">
                            {val !== null && val !== undefined ? String(val) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-emerald-500/20 bg-[#031814] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
