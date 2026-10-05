import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BASNavbar from "../../../components/layout/UserNavbar";
import { getCases } from "../../../services/api/case";
import { getCaseFiles } from "../../../services/api/file";
import {
  getTransactionRelationships,
  getTransactionModes
} from "../../../services/api/bankTransaction";
import RelationshipGraph from "../../../components/reports/RelationshipGraph";

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

export default function TransactionRelationshipReport() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [activeCaseId, setActiveCaseId] = useState(caseId || "");
  const [allCases, setAllCases] = useState([]);

  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  const [modes, setModes] = useState([]);

  const [filters, setFilters] = useState({
    transactionMode: "All",
    minAmount: "",
    maxAmount: "",
    transactionType: "All",
  });

  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    transactions: [],
    summary: {},
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // ============================================================
  // GRAPH ZOOM
  // ============================================================

  const [graphZoom, setGraphZoom] = useState(1);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.1;

  const zoomIn = () => {
    setGraphZoom((prev) =>
      Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2)))
    );
  };

  const zoomOut = () => {
    setGraphZoom((prev) =>
      Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2)))
    );
  };

  const resetZoom = () => {
    setGraphZoom(1);
  };

  // ============================================================
  // LOAD CASES
  // ============================================================

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await getCases();

        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

        setAllCases(list);
      } catch (err) {
        console.error("Failed to load cases:", err);
      }
    }

    fetchCases();
  }, []);

  // ============================================================
  // LOAD FILES FOR SELECTED CASE
  // ============================================================

  useEffect(() => {
    if (!activeCaseId) {
      setFiles([]);
      setSelectedFileIds([]);
      return;
    }

    async function fetchFiles() {
      try {
        const res = await getCaseFiles(activeCaseId);

        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

        setFiles(list);

        if (list.length >= 1) {
          setSelectedFileIds([list[0].id]);
        } else {
          setSelectedFileIds([]);
        }
      } catch (err) {
        console.error("Failed to load files:", err);
        setFiles([]);
        setSelectedFileIds([]);
      }
    }

    fetchFiles();
  }, [activeCaseId]);

  // ============================================================
  // LOAD TRANSACTION MODES
  // ============================================================

  useEffect(() => {
    async function fetchModes() {
      try {
        const res = await getTransactionModes();

        const modeList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

        setModes(modeList);
      } catch (err) {
        console.error("Failed to load modes:", err);
      }
    }

    fetchModes();
  }, []);

  // ============================================================
  // APPLY FILTERS
  // ============================================================

  const handleApplyFilters = async () => {
    if (!activeCaseId) {
      setError("Please select a case.");
      return;
    }

    if (selectedFileIds.length < 1) {
      setError("Please select at least one file to find relationships.");

      setGraphData({
        nodes: [],
        edges: [],
        transactions: [],
        summary: {},
      });

      return;
    }

    setIsLoading(true);
    setError(null);
    setInitialLoad(false);

    try {
      const res = await getTransactionRelationships(activeCaseId, {
        fileIds: selectedFileIds,
        ...filters,
      });

      if (res?.data) {
        setGraphData({
          nodes: res.data.nodes || [],
          edges: res.data.edges || [],
          transactions: res.data.transactions || [],
          summary: res.data.summary || {},
        });
      } else {
        setGraphData({
          nodes: [],
          edges: [],
          transactions: [],
          summary: {},
        });
      }

      // Reset zoom whenever a new graph is generated
      setGraphZoom(1);
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
        "Failed to load relationship graph. The backend may be offline."
      );

      setGraphData({
        nodes: [],
        edges: [],
        transactions: [],
        summary: {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // KPI CALCULATIONS
  // ============================================================

  const totalRelationships =
    graphData.summary?.relationship_count || 0;

  const totalTransactions =
    graphData.summary?.transaction_count || 0;

  const totalDebit =
    graphData.summary?.total_debit || 0;

  const totalCredit =
    graphData.summary?.total_credit || 0;

  const totalAmount = totalDebit + totalCredit;

  // ============================================================
  // FILE SELECTION
  // ============================================================

  const toggleFileSelection = (fileId) => {
    setSelectedFileIds((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }

      return [...prev, fileId];
    });
  };

  return (
    <div className="min-h-screen bg-[#020b09] text-white flex flex-col font-sans overflow-x-hidden">
      <BASNavbar />

      <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
              Transaction Flow Report
            </h1>

            <p className="mt-1.5 text-sm text-slate-400">
              Visualize monetary flows and relationships between multiple bank statements.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/cases")}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            Back to Cases
          </button>
        </div>

        {/* ======================================================
            CONTROLS SECTION
        ====================================================== */}

        <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-6 mb-8 shadow-2xl">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* CASE SELECTION */}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Case
              </label>

              <select
                value={activeCaseId}
                onChange={(e) => setActiveCaseId(e.target.value)}
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition outline-none"
              >
                <option value="" disabled>
                  Select a case...
                </option>

                {allCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_name || `Case ${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* TRANSACTION MODE */}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Transaction Mode
              </label>

              <select
                value={filters.transactionMode}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    transactionMode: e.target.value,
                  }))
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >
                <option value="All">
                  All Modes
                </option>

                {modes.map((m, i) => (
                  <option key={i} value={m}>
                    {m}
                  </option>
                ))}

                <option value="UPI">UPI</option>
                <option value="IMPS">IMPS</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CASH">CASH</option>
              </select>
            </div>

            {/* MINIMUM AMOUNT */}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Min Amount (₹)
              </label>

              <select
                value={filters.minAmount}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minAmount: e.target.value,
                  }))
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >
                <option value="">
                  Any Amount
                </option>

                <option value="10000">
                  {"> ₹10,000"}
                </option>

                <option value="50000">
                  {"> ₹50,000"}
                </option>

                <option value="100000">
                  {"> ₹1,00,000"}
                </option>

                <option value="500000">
                  {"> ₹5,00,000"}
                </option>
              </select>
            </div>

            {/* TRANSACTION TYPE */}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Txn Type
              </label>

              <select
                value={filters.transactionType}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    transactionType: e.target.value,
                  }))
                }
                className="w-full bg-[#020b09] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
              >
                <option value="All">
                  All (Debit & Credit)
                </option>

                <option value="debit">
                  Debits Only
                </option>

                <option value="credit">
                  Credits Only
                </option>
              </select>
            </div>
          </div>

          {/* FILE SELECTION */}

          {activeCaseId && (
            <div className="mt-6 pt-6 border-t border-white/[0.06]">

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Select Statements for Relationship Analysis (Min. 1)
              </label>

              <div className="flex flex-wrap gap-3">

                {files.map((f) => {
                  const isSelected =
                    selectedFileIds.includes(f.id);

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        toggleFileSelection(f.id)
                      }
                      title={f.original_filename || `Statement ${f.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                          : "bg-[#020b09] border-white/[0.1] text-slate-400 hover:border-slate-500"
                      }`}
                    >

                      <div
                        className={`w-3 h-3 rounded flex items-center justify-center border ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-slate-500"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-2 h-2 text-black"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {f.account_number?.toString().trim() ||
                        "Account number not available"}
                    </button>
                  );
                })}

                {files.length === 0 && (
                  <span className="text-xs text-rose-400">
                    No files found for this case.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ACTIONS */}

          <div className="mt-6 pt-6 border-t border-white/[0.06] flex justify-end">

            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={
                isLoading ||
                selectedFileIds.length < 1
              }
              className={`px-8 py-2.5 rounded-xl font-bold text-sm transition shadow-lg ${
                isLoading ||
                selectedFileIds.length < 1
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-400 text-black hover:bg-emerald-300 shadow-emerald-500/20"
              }`}
            >
              {isLoading
                ? "Generating Graph..."
                : "Apply Filters & Generate Graph"}
            </button>

          </div>
        </div>

        {/* ======================================================
            ERROR STATE
        ====================================================== */}

        {error && (
          <div className="mb-8 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-xl text-sm font-semibold flex items-center gap-3">

            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            {error}
          </div>
        )}

        {/* ======================================================
            KPI CARDS
        ====================================================== */}

        {!initialLoad && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

            {/* SELECTED FILES */}

            <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                Selected Files
              </span>

              <span className="text-2xl font-extrabold text-white">
                {selectedFileIds.length}
              </span>

            </div>

            {/* RELATIONSHIPS */}

            <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

              <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">
                Direct Relationships
              </span>

              <span className="text-2xl font-extrabold text-emerald-400">
                {totalRelationships}
              </span>

            </div>

            {/* TRANSACTIONS */}

            <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

              <span className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-wider mb-1">
                Total Transactions
              </span>

              <span className="text-2xl font-extrabold text-cyan-400">
                {totalTransactions}
              </span>

            </div>

            {/* TOTAL VOLUME */}

            <div className="bg-[#061411] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-center">

              <span className="text-[10px] text-indigo-500/70 font-bold uppercase tracking-wider mb-1">
                Total Volume
              </span>

              <span className="text-2xl font-extrabold text-indigo-400">
                {formatCurrency(totalAmount)}
              </span>

            </div>

          </div>
        )}

        {/* ======================================================
            GRAPH
        ====================================================== */}

        {!initialLoad && !error && (
          <div className="bg-[#061411] border border-white/[0.08] rounded-2xl overflow-hidden">

            {/* GRAPH HEADER */}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.08]">

              <div>
                <h2 className="text-sm font-bold text-white">
                  Transaction Relationship Graph
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Explore relationships between accounts and transactions.
                </p>
              </div>

              {/* ==================================================
                  ZOOM CONTROLS
              ================================================== */}

              <div className="flex items-center gap-2">

                {/* ZOOM OUT */}

                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={graphZoom <= MIN_ZOOM}
                  title="Zoom Out"
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                    graphZoom <= MIN_ZOOM
                      ? "bg-slate-900 border-white/[0.05] text-slate-700 cursor-not-allowed"
                      : "bg-[#020b09] border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </button>

                {/* ZOOM VALUE */}

                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset Zoom"
                  className="min-w-[68px] h-9 px-3 rounded-lg bg-[#020b09] border border-white/[0.1] text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 transition"
                >
                  {Math.round(graphZoom * 100)}%
                </button>

                {/* ZOOM IN */}

                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={graphZoom >= MAX_ZOOM}
                  title="Zoom In"
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                    graphZoom >= MAX_ZOOM
                      ? "bg-slate-900 border-white/[0.05] text-slate-700 cursor-not-allowed"
                      : "bg-[#020b09] border-white/[0.1] text-slate-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>

                {/* RESET */}

                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset Zoom"
                  className="h-9 px-3 rounded-lg bg-[#020b09] border border-white/[0.1] text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-500 transition"
                >
                  Reset
                </button>

              </div>
            </div>

            {/* ==================================================
                GRAPH CONTAINER
            ================================================== */}

            <div
              className="relative w-full overflow-auto"
              style={{
                height: "700px",
              }}
            >

              {/* GRAPH ZOOM AREA */}

              <div
                className="min-w-full min-h-full flex items-center justify-center"
                style={{
                  transform: `scale(${graphZoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s ease",
                  width:
                    graphZoom > 1
                      ? `${graphZoom * 100}%`
                      : "100%",
                  height:
                    graphZoom > 1
                      ? `${graphZoom * 100}%`
                      : "100%",
                }}
              >

                <div className="w-full h-full">

                  <RelationshipGraph
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    transactions={graphData.transactions}
                  />

                </div>
              </div>
            </div>

            {/* ==================================================
                ZOOM FOOTER
            ================================================== */}

            <div className="px-5 py-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">

              <div className="flex items-center gap-2 text-xs text-slate-500">

                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                  <path d="M8 11h6" />
                  <path d="M11 8v6" />
                </svg>

                <span>
                  Use the controls to zoom the relationship graph.
                </span>

              </div>

              <div className="text-xs text-slate-600">
                Zoom:{" "}
                <span className="text-emerald-400 font-semibold">
                  {Math.round(graphZoom * 100)}%
                </span>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================
            INITIAL STATE
        ====================================================== */}

        {initialLoad && !isLoading && !error && (
          <div className="h-[400px] border border-white/[0.04] bg-[#03100d]/50 rounded-2xl flex flex-col items-center justify-center border-dashed">

            <svg
              className="w-12 h-12 text-slate-700 mb-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>

            <p className="text-slate-500 font-medium">
              Select 1 or more files and apply filters to generate graph.
            </p>

          </div>
        )}

      </main>
    </div>
  );
}