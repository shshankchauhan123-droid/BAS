import React, { useRef, useState } from "react";
import { parseRawDataset, parseUploadedFile } from "../../utils/dataParser";
import { SAMPLE_DATASETS } from "../../utils/sampleDatasets";

export default function FileUploader({
  onDatasetLoaded,
  isProcessing = false,
  compact = false,
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingState, setLoadingState] = useState(false);

  const handleFileProcess = async (file) => {
    if (!file) return;
    setErrorMsg("");
    setLoadingState(true);

    try {
      const dataset = await parseUploadedFile(file);
      onDatasetLoaded(dataset);
    } catch (err) {
      console.error("File parsing error:", err);
      setErrorMsg(err.message || "Failed to parse file. Please verify format.");
    } finally {
      setLoadingState(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleLoadSample = (sample) => {
    try {
      setLoadingState(true);
      setErrorMsg("");
      const dataset = parseRawDataset(sample.rows, sample.name);
      dataset.description = sample.description;
      onDatasetLoaded(dataset);
    } catch (err) {
      setErrorMsg("Failed to load sample dataset.");
    } finally {
      setLoadingState(false);
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={handleInputChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingState || isProcessing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all cursor-pointer disabled:opacity-50"
        >
          {loadingState ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          )}
          <span>Upload New File</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#031512]/90 to-[#020b09]/95 p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Title & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-emerald-500/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-emerald-400/90">
              Step 1 — Data Ingestion
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1">
            Upload Statement or Dataset
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-detects columns, timestamps, currencies, debits/credits, and balances.
          </p>
        </div>

        {/* Quick Demo Previews */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Or load demo:</span>
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleLoadSample(sample)}
              disabled={loadingState || isProcessing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{sample.badge}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          dragActive
            ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.25)] scale-[1.005]"
            : "border-emerald-500/25 bg-[#01100e]/60 hover:border-emerald-400/50 hover:bg-emerald-950/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] mb-3">
          {loadingState ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          ) : (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-200">
          <span className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-4">
            Click to upload
          </span>{" "}
          or drag and drop your file here
        </p>

        <p className="text-xs text-slate-400 mt-1">
          Supports <span className="text-emerald-300 font-mono">.CSV</span>,{" "}
          <span className="text-emerald-300 font-mono">.XLSX</span>,{" "}
          <span className="text-emerald-300 font-mono">.XLS</span>, and{" "}
          <span className="text-emerald-300 font-mono">.JSON</span> files
        </p>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-emerald-500/10 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Automatic Header Detection
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            Zero Hardcoding
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Instant In-Browser Parsing
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
