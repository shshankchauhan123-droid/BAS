import React from "react";

export default function DatasetSelector({
  datasets = [],
  activeDatasetId,
  onSelectDataset,
  onRemoveDataset,
  onTriggerUpload,
  onOpenPreview,
}) {
  if (!datasets || datasets.length === 0) return null;

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 px-4 rounded-xl border border-emerald-500/20 bg-[#031310]/80 backdrop-blur-md">
      {/* Left: Tab items */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/80 mr-1 shrink-0">
          Datasets:
        </span>
        {datasets.map((ds, idx) => {
          const isActive = ds.id === activeDatasetId;
          return (
            <div
              key={ds.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-200 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "border-emerald-900/40 bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-emerald-700/50"
              }`}
              onClick={() => onSelectDataset(ds.id)}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <span className="max-w-[140px] truncate" title={ds.fileName}>
                {ds.fileName || `Report #${idx + 1}`}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-emerald-300 font-mono">
                {ds.rowCount} rows
              </span>

              {/* Remove button (if more than 1 dataset) */}
              {datasets.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDataset(ds.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity p-0.5"
                  title="Remove this dataset"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right actions: View Schema / Upload More */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenPreview}
          className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Schema & Preview</span>
        </button>

        <button
          type="button"
          onClick={onTriggerUpload}
          className="px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 hover:border-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Dataset</span>
        </button>
      </div>
    </div>
  );
}
