import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import NcrpHierarchicalGraph from "../../../components/reports/NcrpHierarchicalGraph";
import NcrpAccountDrawer from "../../../components/reports/NcrpAccountDrawer";
import NcrpAccountPanel from "../../../components/reports/NcrpAccountPanel";

import { getCases } from "../../../services/api/case";
import { getCaseNcrpFiles, getNcrpHierarchicalGraph } from "../../../services/api/ncrp";

/**
 * Initial empty shape for graph data ensuring nodes and edges are always arrays
 */
const INITIAL_GRAPH_STATE = {
  file_id: null,
  case_id: null,
  filename: "",
  root_accounts: [],
  selected_root: null,
  nodes: [],
  edges: [],
  available_layers: [],
  available_banks: [],
  available_acknowledgements: [],
  max_layer: 1,
  total_amount: 0.0,
  total_disputed_amount: 0.0,
  total_transactions: 0,
  distinct_accounts_count: 0,
  has_outgoing: true,
  message: null,
};

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "Not Available";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function maskAccountNumber(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.length <= 4) return s;
  if (s.length <= 6) return s.slice(0, 1) + "X".repeat(s.length - 2) + s.slice(-1);
  return s.slice(0, 2) + "X".repeat(s.length - 6) + s.slice(-4);
}

/**
 * Normalizes graph API responses at the data-fetching boundary.
 * Guarantees that nodes and edges are always valid arrays, metadata defaults are applied,
 * and during expansion, merges new nodes/edges into existing graph without duplicates.
 */
function normalizeGraphResponse(rawResponse, prevGraph = null, shouldMerge = false) {
  if (!rawResponse) {
    return prevGraph || { ...INITIAL_GRAPH_STATE };
  }

  const data =
    rawResponse?.data && typeof rawResponse.data === "object"
      ? rawResponse.data
      : rawResponse;

  if (!data || typeof data !== "object") {
    return prevGraph || { ...INITIAL_GRAPH_STATE };
  }

  const incomingNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const incomingEdges = Array.isArray(data.edges) ? data.edges : [];

  let finalNodes = incomingNodes;
  let finalEdges = incomingEdges;

  if (shouldMerge && prevGraph && Array.isArray(prevGraph.nodes) && prevGraph.nodes.length > 0) {
    const nodeMap = new Map();
    prevGraph.nodes.forEach((n) => {
      if (n && n.account) nodeMap.set(String(n.account), n);
    });
    incomingNodes.forEach((n) => {
      if (n && n.account) nodeMap.set(String(n.account), n);
    });
    finalNodes = Array.from(nodeMap.values());

    const edgeMap = new Map();
    prevGraph.edges.forEach((e) => {
      if (e) {
        const k = e.id || `${e.source_acc}->${e.target_acc}@${e.layer_num}`;
        edgeMap.set(k, e);
      }
    });
    incomingEdges.forEach((e) => {
      if (e) {
        const k = e.id || `${e.source_acc}->${e.target_acc}@${e.layer_num}`;
        edgeMap.set(k, e);
      }
    });
    finalEdges = Array.from(edgeMap.values());
  }

  const distinctCount =
    typeof data.distinct_accounts_count === "number"
      ? data.distinct_accounts_count
      : finalNodes.length;

  return {
    file_id: data.file_id ?? prevGraph?.file_id ?? null,
    case_id: data.case_id ?? prevGraph?.case_id ?? null,
    filename: data.filename || prevGraph?.filename || "",
    root_accounts: Array.isArray(data.root_accounts)
      ? data.root_accounts
      : prevGraph?.root_accounts || [],
    selected_root: data.selected_root || prevGraph?.selected_root || null,
    nodes: finalNodes,
    edges: finalEdges,
    available_layers: Array.isArray(data.available_layers)
      ? data.available_layers
      : prevGraph?.available_layers || [],
    available_banks: Array.isArray(data.available_banks)
      ? data.available_banks
      : prevGraph?.available_banks || [],
    available_acknowledgements: Array.isArray(data.available_acknowledgements)
      ? data.available_acknowledgements
      : prevGraph?.available_acknowledgements || [],
    max_layer: typeof data.max_layer === "number" ? data.max_layer : prevGraph?.max_layer || 1,
    total_amount: Number(data.total_amount) || 0,
    total_disputed_amount: Number(data.total_disputed_amount) || 0,
    total_transactions: Number(data.total_transactions) || 0,
    distinct_accounts_count: distinctCount,
    has_outgoing: data.has_outgoing !== undefined ? Boolean(data.has_outgoing) : true,
    message: data.message || null,
  };
}

/**
 * Searchable Select Component for Case and Workbook pickers
 */
function SearchableSelect({
  label,
  stepNumber,
  value,
  options = [],
  onSelect,
  placeholder = "Select...",
  searchPlaceholder = "Type to filter...",
  disabled = false,
  loading = false,
  emptyMessage = "No items found",
  badgeColor = "purple",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleDocClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedItem = useMemo(() => {
    return options.find((opt) => String(opt.id) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(query);
      const matchSub = opt.subtitle?.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      return matchLabel || matchSub || matchBadge;
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative flex flex-col gap-1.5 ${isOpen ? "z-40" : "z-10"}`} ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-bold text-[#172554]">
          {stepNumber && (
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                badgeColor === "purple"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {stepNumber}
            </span>
          )}
          {label}
          {loading && (
            <span className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
          )}
        </label>
      )}

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-200 outline-none ${
          disabled
            ? "cursor-not-allowed border-[#E2E8F0] bg-slate-100 text-[#94A3B8]"
            : isOpen
            ? "border-purple-500 bg-white ring-3 ring-purple-500/10 shadow-sm"
            : "border-[#DCE5EF] bg-white text-[#172554] hover:border-purple-300"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedItem ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold text-[#172554]">
                {selectedItem.label}
              </span>
              {selectedItem.badge && (
                <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 uppercase">
                  {selectedItem.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate text-[#94A3B8]">
              {loading ? "Loading..." : placeholder}
            </span>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-purple-600" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-[#DCE5EF] bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-[#172554] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(value);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-purple-50 text-purple-900 font-bold"
                        : "hover:bg-slate-50 text-[#172554]"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{opt.label}</span>
                        {opt.badge && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-[#64748B]">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="truncate text-[10px] text-[#64748B] mt-0.5">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-[#94A3B8]">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NcrpHierarchicalFlowReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const caseIdFromUrl = searchParams.get("caseId") || "";
  const fileIdFromUrl = searchParams.get("fileId") || "";

  // State
  const [casesList, setCasesList] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(caseIdFromUrl);
  const [ncrpFilesList, setNcrpFilesList] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(fileIdFromUrl);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Graph Data & Expansion — Always initialized to safe object shape
  const [graphData, setGraphData] = useState(INITIAL_GRAPH_STATE);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [selectedRootAccount, setSelectedRootAccount] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState([]);
  const [expandAll, setExpandAll] = useState(false);

  // Request token ref to avoid race conditions and discard stale asynchronous responses
  const requestCounterRef = useRef(0);
  const isExpandingRef = useRef(false);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [bankFilter, setBankFilter] = useState("ALL");
  const [minAmount, setMinAmount] = useState("");

  // Drawer Panel
  const [drawerAccount, setDrawerAccount] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Protected safe access arrays
  const nodes = useMemo(() => (Array.isArray(graphData?.nodes) ? graphData.nodes : []), [graphData?.nodes]);
  const edges = useMemo(() => (Array.isArray(graphData?.edges) ? graphData.edges : []), [graphData?.edges]);
  const rootAccounts = useMemo(() => (Array.isArray(graphData?.root_accounts) ? graphData.root_accounts : []), [graphData?.root_accounts]);
  const availableLayers = useMemo(() => (Array.isArray(graphData?.available_layers) ? graphData.available_layers : []), [graphData?.available_layers]);
  const availableBanks = useMemo(() => (Array.isArray(graphData?.available_banks) ? graphData.available_banks : []), [graphData?.available_banks]);

  // Layer 1 Starting Account Selection state
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [isStartingAccountSelectorOpen, setIsStartingAccountSelectorOpen] = useState(true);
  const [revealedSourceAccounts, setRevealedSourceAccounts] = useState({});

  const toggleRevealSourceAccount = (account, e) => {
    if (e) e.stopPropagation();
    setRevealedSourceAccounts((prev) => ({
      ...prev,
      [account]: !prev[account],
    }));
  };

  const filteredRootAccounts = useMemo(() => {
    if (!sourceSearchQuery.trim()) return rootAccounts;
    const q = sourceSearchQuery.toLowerCase().trim();
    return rootAccounts.filter((r) => {
      const acc = String(r.account || "").toLowerCase();
      const raw = String(r.raw_account || "").toLowerCase();
      const bank = String(r.bank || "").toLowerCase();
      const ack = String(r.ack_no || "").toLowerCase();
      return acc.includes(q) || raw.includes(q) || bank.includes(q) || ack.includes(q);
    });
  }, [rootAccounts, sourceSearchQuery]);

  const handleSelectStartingAccount = (account) => {
    if (!account) return;
    setSelectedRootAccount(account);
    setDrawerAccount(account);
    setExpandedAccounts([]);
    setExpandAll(false);
    fetchGraph({
      overrideRoot: account,
      overrideExpanded: [],
      overrideExpandAll: false,
      isExpandingAction: false,
    });
  };


  // 1. Fetch accessible cases
  useEffect(() => {
    let isMounted = true;
    async function loadCases() {
      try {
        setLoadingCases(true);
        const res = await getCases();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setCasesList(list);
          if (caseIdFromUrl) {
            setSelectedCaseId(caseIdFromUrl);
          } else if (list.length > 0 && !selectedCaseId) {
            setSelectedCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [caseIdFromUrl]);

  // 2. Fetch NCRP files for selected case
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFilesList([]);
      setSelectedFileId("");
      setGraphData({ ...INITIAL_GRAPH_STATE });
      setGraphError(null);
      return;
    }

    let isMounted = true;
    async function loadFiles() {
      try {
        setLoadingFiles(true);
        const res = await getCaseNcrpFiles(selectedCaseId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setNcrpFilesList(list);
          setSelectedRootAccount("");
          setExpandedAccounts([]);
          setDrawerAccount(null);
          setIsDrawerOpen(false);
          setGraphData({ ...INITIAL_GRAPH_STATE });
          if (fileIdFromUrl && list.some((f) => String(f.id) === String(fileIdFromUrl))) {
            setSelectedFileId(fileIdFromUrl);
          } else if (list.length > 0) {
            setSelectedFileId(String(list[0].id));
          } else {
            setSelectedFileId("");
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP files:", err);
      } finally {
        if (isMounted) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, fileIdFromUrl]);

  // 3. Update query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCaseId) params.set("caseId", selectedCaseId);
    if (selectedFileId) params.set("fileId", selectedFileId);
    setSearchParams(params, { replace: true });
  }, [selectedCaseId, selectedFileId, setSearchParams]);

  // 4. Fetch Hierarchical Graph Data
  const fetchGraph = useCallback(
    async ({
      overrideRoot = null,
      overrideExpanded = null,
      overrideExpandAll = null,
      isExpandingAction = false,
    } = {}) => {
      if (!selectedFileId) {
        setGraphData({ ...INITIAL_GRAPH_STATE });
        setGraphError(null);
        return;
      }

      const currentRequestId = ++requestCounterRef.current;

      if (isExpandingAction) {
        setIsExpanding(true);
        isExpandingRef.current = true;
      } else {
        setLoadingGraph(true);
      }
      setGraphError(null);

      try {
        const rootToUse = overrideRoot !== null ? overrideRoot : selectedRootAccount;
        const expandedToUse = overrideExpanded !== null ? overrideExpanded : expandedAccounts;
        const expandAllToUse = overrideExpandAll !== null ? overrideExpandAll : expandAll;

        const res = await getNcrpHierarchicalGraph(selectedFileId, {
          caseId: selectedCaseId,
          rootAccount: rootToUse || undefined,
          expandedAccounts: expandedToUse,
          expandAll: expandAllToUse,
          bankName: bankFilter !== "ALL" ? bankFilter : undefined,
          minAmount: minAmount !== "" ? Number(minAmount) : undefined,
          search: searchQuery || undefined,
        });

        // Ignore stale asynchronous responses
        if (currentRequestId !== requestCounterRef.current) {
          return;
        }

        setGraphData((prev) => {
          const normalized = normalizeGraphResponse(res, prev, isExpandingAction);

          // Update selected root if not yet selected
          if (!selectedRootAccount && normalized.selected_root) {
            setSelectedRootAccount(normalized.selected_root);
          }
          if (!drawerAccount && (normalized.selected_root || normalized.nodes?.[0]?.account)) {
            setDrawerAccount(normalized.selected_root || normalized.nodes[0]?.account);
          }

          // Handle terminal node notification if present
          if (normalized.message && !normalized.has_outgoing) {
            Swal.fire({
              icon: "info",
              title: "Terminal Account",
              text: normalized.message,
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3500,
            });
          }

          return normalized;
        });
      } catch (err) {
        if (currentRequestId !== requestCounterRef.current) {
          return;
        }
        console.error("Failed to fetch hierarchical graph:", err);
        const errMsg = err?.message || "Failed to load hierarchical money flow graph.";
        setGraphError(errMsg);

        // Preserve existing graph if expanding; do NOT set graphData to null
        setGraphData((prev) => (isExpandingAction && prev ? prev : { ...INITIAL_GRAPH_STATE }));

        Swal.fire({
          icon: "error",
          title: "Graph Error",
          text: errMsg,
        });
      } finally {
        if (currentRequestId === requestCounterRef.current) {
          setLoadingGraph(false);
          setIsExpanding(false);
          isExpandingRef.current = false;
        }
      }
    },
    [selectedFileId, selectedCaseId, selectedRootAccount, expandedAccounts, expandAll, bankFilter, minAmount, searchQuery]
  );

  // Trigger fetch when primary selection dependencies change
  useEffect(() => {
    if (selectedFileId) {
      fetchGraph();
    } else {
      setGraphData({ ...INITIAL_GRAPH_STATE });
      setGraphError(null);
    }
  }, [selectedFileId, selectedCaseId, selectedRootAccount, expandAll, bankFilter]);

  // Keep selected root aligned if rootAccounts list changes
  useEffect(() => {
    if (rootAccounts.length > 0 && selectedRootAccount) {
      const exists = rootAccounts.some((r) => r.account === selectedRootAccount);
      if (!exists) {
        setSelectedRootAccount("");
      }
    }
  }, [rootAccounts, selectedRootAccount]);


  // Node selection handler -> Open Account Drawer
  const handleSelectAccount = (accountNumber) => {
    setDrawerAccount(accountNumber);
    setIsDrawerOpen(true);
  };

  // CHANGE 3: Single-click Account Node Interaction
  // 1. Immediately selects that account and updates the right-side profile panel
  // 2. Automatically expands its next layer if outgoing transfers exist
  // 3. Second click on same expanded account collapses its descendants while keeping the account selected
  // 4. Clicking another account updates the profile panel to that account and expands that account
  // 5. Terminal accounts (no outgoing transfers): updates profile panel, does not attempt expansion
  // 6. Guards against rapid clicks to prevent duplicate state or requests
  const handleNodeClick = useCallback(
    (accountNumber, node) => {
      if (!accountNumber) return;

      // 1. Immediately select account and update profile panel
      setDrawerAccount(accountNumber);
      setIsDrawerOpen(true);

      // 2. Terminal account: select account, update profile, do not attempt expansion
      if (!node?.has_outgoing) {
        return;
      }

      // 3. Rapid click protection: avoid initiating concurrent fetches while an expansion is in flight
      if (isExpandingRef.current) {
        return;
      }

      // 4. Toggle expansion / collapse
      setExpandedAccounts((prev) => {
        const isAlreadyExpanded = prev.includes(accountNumber);
        let nextExpanded;

        if (isAlreadyExpanded) {
          // Second click on expanded account: collapse its descendants
          const descendants = new Set();
          const queue = [accountNumber];
          while (queue.length > 0) {
            const curr = queue.shift();
            edges.forEach((e) => {
              if (e && e.source_acc === curr && !descendants.has(e.target_acc)) {
                descendants.add(e.target_acc);
                queue.push(e.target_acc);
              }
            });
          }
          nextExpanded = prev.filter((a) => a !== accountNumber && !descendants.has(a));
        } else {
          // First click on unexpanded account: expand next layer
          nextExpanded = [...prev, accountNumber];
        }

        fetchGraph({
          overrideExpanded: nextExpanded,
          isExpandingAction: !isAlreadyExpanded,
        });

        return nextExpanded;
      });
    },
    [edges, fetchGraph]
  );

  // Node progressive expansion toggle with in-progress state and graph preservation
  const handleExpandAccount = (accountNumber) => {
    if (!accountNumber) return;
    if (isExpandingRef.current) return;
    setExpandedAccounts((prev) => {
      const isAlreadyExpanded = prev.includes(accountNumber);
      let nextExpanded;
      if (isAlreadyExpanded) {
        // Collect all descendants of accountNumber to collapse full subtree
        const descendants = new Set();
        const queue = [accountNumber];
        while (queue.length > 0) {
          const curr = queue.shift();
          edges.forEach((e) => {
            if (e && e.source_acc === curr && !descendants.has(e.target_acc)) {
              descendants.add(e.target_acc);
              queue.push(e.target_acc);
            }
          });
        }
        nextExpanded = prev.filter((a) => a !== accountNumber && !descendants.has(a));
      } else {
        nextExpanded = [...prev, accountNumber];
      }

      fetchGraph({
        overrideExpanded: nextExpanded,
        isExpandingAction: !isAlreadyExpanded,
      });

      return nextExpanded;
    });
  };

  // Terminal node click
  const handleTerminalClick = (accountNumber) => {
    Swal.fire({
      icon: "info",
      title: "Terminal Account",
      text: "No further linked transactions available for this account.",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3500,
    });
  };

  // Reset to Layer 1 root
  const handleResetToRoot = () => {
    setExpandedAccounts([]);
    setExpandAll(false);
    fetchGraph({
      overrideExpanded: [],
      overrideExpandAll: false,
      isExpandingAction: false,
    });
  };

  // Expand all layers
  const handleExpandAll = () => {
    setExpandAll(true);
    fetchGraph({
      overrideExpandAll: true,
      isExpandingAction: false,
    });
  };

  // Export graph data to Excel
  const handleExportData = () => {
    if (nodes.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Data",
        text: "No graph data available to export.",
      });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Nodes sheet
    const nodesData = nodes.map((n) => ({
      "Account Number": n.account,
      "Masked Account": n.masked_account,
      "Bank / FI": n.bank,
      "Layer": n.layer,
      "Role": n.role,
      "Total Inflow (₹)": n.total_in,
      "Total Outflow (₹)": n.total_out,
      "Disputed Exposure (₹)": n.disputed_amount,
      "Hold Amount (₹)": n.hold_amount,
      "Transactions Count": n.tx_count,
      "IFSC Code": n.ifsc || "N/A",
      "Account Holder": n.account_holder || "N/A",
      "Acknowledgement No": n.ack_no || "N/A",
    }));
    const wsNodes = XLSX.utils.json_to_sheet(nodesData);
    XLSX.utils.book_append_sheet(wb, wsNodes, "Accounts Hierarchy");

    // Edges sheet
    const edgesData = edges.map((e) => ({
      "Source Account": e.source_acc,
      "Source Bank": e.source_bank,
      "Target Account": e.target_acc,
      "Target Bank": e.target_bank,
      "Amount (₹)": e.amount,
      "Disputed Amount (₹)": e.disputed_amount,
      "Transfers Count": e.tx_count,
      "Layer": e.layer,
      "UTR": e.utr || "N/A",
      "Transaction Date": e.date || "N/A",
      "Source Sheet": e.sheet_name,
    }));
    const wsEdges = XLSX.utils.json_to_sheet(edgesData);
    XLSX.utils.book_append_sheet(wb, wsEdges, "Money Flow Links");

    XLSX.writeFile(wb, `NCRP_Hierarchical_Money_Flow_File_${selectedFileId}.xlsx`);
  };

  // Selector dropdown options
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: `${c.case_name || "Untitled Case"} — ${c.case_number || `Case #${c.id}`}`,
      subtitle: `Status: ${c.status || "ACTIVE"}`,
      badge: c.status || "ACTIVE",
    }));
  }, [casesList]);

  const fileOptions = useMemo(() => {
    return ncrpFilesList.map((f) => ({
      id: f.id,
      label: f.original_filename || f.filename || `File #${f.id}`,
      subtitle: `${f.total_rows || 0} rows • ${f.sheet_count || 0} sheets • ${f.status || "COMPLETED"}`,
      badge: f.status || "COMPLETED",
    }));
  }, [ncrpFilesList]);

  // Selected file metadata
  const currentFile = useMemo(() => {
    return ncrpFilesList.find((f) => String(f.id) === String(selectedFileId));
  }, [ncrpFilesList, selectedFileId]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F8FC] text-[#172033]">
      <BASNavbar />

      <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] mb-1">
              <button
                type="button"
                onClick={() => navigate(selectedCaseId ? `/reports/ncrp?caseId=${selectedCaseId}` : "/reports/ncrp")}
                className="hover:text-purple-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                NCRP Reports Hub
              </button>
              <span>/</span>
              <span className="text-[#172554] font-bold">NCRP Hierarchical Money Flow</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#172554] tracking-tight flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 border border-purple-200 shadow-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h4v4H4V6zm12 0h4v4h-4V6zM4 14h4v4H4v-4zm12 0h4v4h-4v-4zm-8-5h8M6 10v4m12-4v4" />
                </svg>
              </span>
              NCRP Hierarchical Money Flow Report
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Explore layer-wise NCRP transactions through an interactive account hierarchy with progressive traversal.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportData}
              disabled={nodes.length === 0}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-[#DCE5EF] bg-white text-[#172554] hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report Data
            </button>
          </div>
        </div>

        {/* TOP SECTION: Workbooks & Summary KPI Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Step 1 & 2 Selectors */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] pb-2 border-b border-[#F1F5F9]">
              Workbook Selection
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SearchableSelect
                label="Case File"
                stepNumber="1"
                value={selectedCaseId}
                options={caseOptions}
                onSelect={(val) => {
                  setSelectedCaseId(val);
                  setSelectedFileId("");
                  setSelectedRootAccount("");
                  setExpandedAccounts([]);
                  setExpandAll(false);
                  setDrawerAccount(null);
                  setIsDrawerOpen(false);
                  setGraphData({ ...INITIAL_GRAPH_STATE });
                }}
                placeholder="Choose investigation case"
                loading={loadingCases}
                badgeColor="purple"
              />

              <SearchableSelect
                label="NCRP Workbook"
                stepNumber="2"
                value={selectedFileId}
                options={fileOptions}
                onSelect={(val) => {
                  setSelectedFileId(val);
                  setSelectedRootAccount("");
                  setExpandedAccounts([]);
                  setExpandAll(false);
                  setDrawerAccount(null);
                  setIsDrawerOpen(false);
                  setGraphData({ ...INITIAL_GRAPH_STATE });
                }}
                placeholder="Select imported Excel file"
                loading={loadingFiles}
                disabled={!selectedCaseId || fileOptions.length === 0}
                emptyMessage="No NCRP workbooks uploaded"
                badgeColor="purple"
              />
            </div>

            {/* Layer 1 Sources Quick Indicator */}
            {selectedFileId && rootAccounts.length > 0 && (
              <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#64748B]">Layer 1 Starting Account:</span>
                <span className="font-bold text-purple-700">
                  {selectedRootAccount
                    ? `${maskAccountNumber(selectedRootAccount)}`
                    : `${rootAccounts.length} Sources (Select below)`}
                </span>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1: Selected Workbook */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Workbook
              </span>
              <div className="my-1">
                <span className="text-xs font-bold text-[#172554] truncate block" title={currentFile?.original_filename}>
                  {currentFile?.original_filename || "Not Available"}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {currentFile ? `${currentFile.sheet_count || 0} sheets • ${currentFile.status}` : "Uncalculated"}
                </span>
              </div>
              <span className="text-[10px] text-purple-700 font-semibold">
                Excel Import
              </span>
            </div>

            {/* KPI 2: Observed Layers */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Observed Layers
              </span>
              <div className="my-1">
                <span className="text-lg font-black text-purple-700">
                  {availableLayers.length > 0
                    ? `Layer 1 – ${Math.max(...availableLayers)}`
                    : "Not Available"}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {graphData?.max_layer ? `Max Depth: Layer ${graphData.max_layer}` : "Uncalculated"}
                </span>
              </div>
              <span className="text-[10px] text-purple-700 font-semibold">
                Hierarchical DAG
              </span>
            </div>

            {/* KPI 3: Distinct Accounts */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Distinct Accounts
              </span>
              <div className="my-1">
                <span className="text-lg font-black text-[#172554]">
                  {graphData?.distinct_accounts_count !== undefined && graphData?.distinct_accounts_count !== null
                    ? `${graphData.distinct_accounts_count}`
                    : nodes.length > 0
                    ? `${nodes.length}`
                    : "Not Available"}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {nodes.length > 0 ? `${nodes.length} in current view` : "Uncalculated"}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">
                Verified Entities
              </span>
            </div>

            {/* KPI 4: Financial Volume vs Disputed */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Volume vs Exposure
              </span>
              <div className="my-1">
                <span className="text-xs font-black text-[#172554] block">
                  ₹{formatIndianCurrency(graphData?.total_amount)}
                </span>
                <span className="text-[10px] font-bold text-amber-700 block">
                  Exp: ₹{formatIndianCurrency(graphData?.total_disputed_amount)}
                </span>
              </div>
              <span className="text-[10px] text-blue-700 font-semibold">
                {graphData?.total_transactions || 0} Linked Transactions
              </span>
            </div>
          </div>
        </div>

        {/* DEDICATED SECTION: Select Starting Account — Layer 1 */}
        {selectedFileId && rootAccounts.length > 0 && (
          <div className="rounded-2xl border border-purple-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 border border-purple-200 shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-[#172554] tracking-tight">
                      Select Starting Account — Layer 1
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      {rootAccounts.length} source{rootAccounts.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Select a Layer 1 sender or suspect account to trace its outward money flow and all connected receiver accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto">
                {/* Search bar inside Layer 1 selector */}
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => setSourceSearchQuery(e.target.value)}
                    placeholder="Search account, bank, ACK..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-[#DCE5EF] bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {selectedRootAccount && (
                  <button
                    type="button"
                    onClick={() => setIsStartingAccountSelectorOpen((prev) => !prev)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-[#DCE5EF] bg-slate-50 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 transition-colors shrink-0"
                    title={isStartingAccountSelectorOpen ? "Collapse selector" : "Expand selector"}
                  >
                    {isStartingAccountSelectorOpen ? "Collapse" : "Change Source"}
                  </button>
                )}
              </div>
            </div>

            {/* Active investigation pill if collapsed */}
            {!isStartingAccountSelectorOpen && selectedRootAccount && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-900">Active Starting Source:</span>
                  <span className="font-mono font-bold text-purple-700">{maskAccountNumber(selectedRootAccount)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStartingAccountSelectorOpen(true)}
                  className="font-bold text-purple-700 hover:text-purple-900 underline"
                >
                  Switch Starting Account
                </button>
              </div>
            )}

            {/* Cards Grid */}
            {isStartingAccountSelectorOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
                {filteredRootAccounts.length > 0 ? (
                  filteredRootAccounts.map((src) => {
                    const isSelected = src.account === selectedRootAccount;
                    const isRevealed = !!revealedSourceAccounts[src.account];
                    const receiversCount = src.distinct_receivers_count ?? src.receivers?.length ?? 0;
                    const transfersCount = src.outgoing_tx_count || src.total_transfers || 0;
                    const totalOutflow = src.total_outgoing_amount || src.total_amount || 0;

                    return (
                      <div
                        key={src.account}
                        onClick={() => handleSelectStartingAccount(src.account)}
                        className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? "border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/30 shadow-md"
                            : "border-[#E2E8F0] bg-white hover:border-purple-300 hover:shadow-md"
                        }`}
                      >
                        <div>
                          {/* Card Top: Masked ID, Reveal, Copy, Badge */}
                          <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-mono text-xs font-bold text-[#172554] tracking-tight truncate">
                                {isRevealed ? src.account : src.masked_account || maskAccountNumber(src.account)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => toggleRevealSourceAccount(src.account, e)}
                                className="p-1 text-[#94A3B8] hover:text-[#172554] transition-colors"
                                title={isRevealed ? "Mask Account" : "Reveal Account"}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {isRevealed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  )}
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(String(src.account));
                                  Swal.fire({
                                    icon: "success",
                                    title: "Account Copied",
                                    text: String(src.account),
                                    toast: true,
                                    position: "top-end",
                                    showConfirmButton: false,
                                    timer: 2000,
                                  });
                                }}
                                className="p-1 text-[#94A3B8] hover:text-purple-700 transition-colors"
                                title="Copy account number"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>

                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? "bg-purple-600 text-white shadow-xs"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}>
                              {isSelected ? "Active Root" : "Layer 1 Source"}
                            </span>
                          </div>

                          {/* Bank Name & Ack */}
                          <div className="py-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#172554] truncate">
                              <svg className="w-3.5 h-3.5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              <span className="truncate">{src.bank || "Unknown Bank"}</span>
                            </div>
                            {src.ack_no && (
                              <div className="text-[10px] text-[#64748B] flex items-center gap-1">
                                <span className="font-semibold text-[#94A3B8]">ACK:</span>
                                <span className="font-mono truncate">{src.ack_no}</span>
                              </div>
                            )}
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center my-1">
                            <div>
                              <span className="text-[9px] font-semibold text-[#64748B] block">Total Outflow</span>
                              <span className="text-xs font-bold text-purple-700 block truncate">
                                ₹{formatIndianCurrency(totalOutflow)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-[#64748B] block">Transfers</span>
                              <span className="text-xs font-bold text-[#172554] block">
                                {transfersCount}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-[#64748B] block">Receivers</span>
                              <span className="text-xs font-bold text-emerald-700 block">
                                {receiversCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Selection Action Button */}
                        <div className="pt-2">
                          {isSelected ? (
                            <div className="w-full py-1.5 px-3 rounded-xl bg-purple-600 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-xs">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Active Investigation Starting Account</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStartingAccount(src.account);
                              }}
                              className="w-full py-1.5 px-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-purple-200"
                            >
                              <span>Investigate This Account</span>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-6 text-center text-xs text-[#94A3B8]">
                    No Layer 1 source accounts found matching &quot;{sourceSearchQuery}&quot;.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INVESTIGATION TOOLBAR & FILTERS */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Highlight account, IFSC, bank..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-[#DCE5EF] bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-3 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Bank Filter Dropdown */}
            {availableBanks.length > 0 && (
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl border border-[#DCE5EF] bg-slate-50 text-[#172554] focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Banks ({availableBanks.length})</option>
                {availableBanks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            {/* Min Amount Threshold */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    fetchGraph();
                  }
                }}
                placeholder="Min Transfer (₹)"
                className="w-32 text-xs py-2 px-3 rounded-xl border border-[#DCE5EF] bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
              />
              {minAmount && (
                <button
                  type="button"
                  onClick={() => fetchGraph()}
                  className="px-2 py-1.5 text-xs font-bold rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200"
                  title="Apply amount filter"
                >
                  Apply
                </button>
              )}
            </div>
          </div>

          {/* Layer Depth Quick Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              disabled={expandAll || nodes.length === 0}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white disabled:opacity-40 transition-colors"
            >
              Expand All Layers
            </button>

            <button
              type="button"
              onClick={handleResetToRoot}
              disabled={expandedAccounts.length === 0 && !expandAll}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-[#DCE5EF] bg-white text-[#64748B] hover:text-[#172554] hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Reset to Root
            </button>

            {/* Mobile Account Details Toggle */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="lg:hidden px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-200 bg-purple-50 text-purple-700 flex items-center gap-1.5 hover:bg-purple-600 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{drawerAccount ? "View Profile" : "Account Profile"}</span>
            </button>
          </div>
        </div>

        {/* MAIN WORKSPACE: GRAPH CANVAS + FIXED DEDICATED RIGHT PANEL ON DESKTOP */}
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* Central Interactive Graph Area */}
          <div className="flex-1 w-full min-w-0 h-[680px] relative">
            {!selectedFileId ? (
              /* Condition 1: No file selected */
              <div className="h-full w-full rounded-2xl border border-dashed border-[#CBD5E1] bg-white flex flex-col items-center justify-center p-8 text-center">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#172554]">
                  No NCRP Workbook Selected
                </h3>
                <p className="text-xs text-[#64748B] max-w-sm mt-1">
                  Select a case and an imported NCRP Excel workbook from the selectors above to render the hierarchical money flow network.
                </p>
              </div>
            ) : loadingGraph && nodes.length === 0 ? (
              /* Condition 2: Initial loading state when graph is not yet populated */
              <div className="h-full w-full rounded-2xl border border-[#E2E8F0] bg-white flex flex-col items-center justify-center space-y-3">
                <div className="h-10 w-10 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-[#172554]">
                  Computing hierarchical money flow DAG...
                </p>
                <p className="text-[11px] text-[#64748B]">
                  Traversing sender-to-receiver edges from root suspect
                </p>
              </div>
            ) : graphError && nodes.length === 0 ? (
              /* Condition 3: Failed request state */
              <div className="h-full w-full rounded-2xl border border-rose-200 bg-white flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#172554]">
                  Failed to Load Graph Data
                </h3>
                <p className="text-xs text-rose-600 max-w-md">
                  {graphError}
                </p>
                <button
                  type="button"
                  onClick={() => fetchGraph()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Retry Loading Graph
                </button>
              </div>
            ) : !selectedRootAccount ? (
              /* Condition 4A: Prompt to select a starting account from the list above */
              <div className="h-full w-full rounded-2xl border border-purple-200 bg-white flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="h-14 w-14 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shadow-xs">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-[#172554]">
                  Select a Layer 1 Starting Account Above
                </h3>
                <p className="text-xs text-[#64748B] max-w-md">
                  This investigation contains {rootAccounts.length} distinct Layer 1 source accounts. Please select one of the cards in the <strong>&quot;Select Starting Account — Layer 1&quot;</strong> section above to load its transaction hierarchy and all connected receiver accounts.
                </p>
              </div>
            ) : nodes.length === 0 ? (
              /* Condition 4: Empty graph state (no records found or filtered out) */
              <div className="h-full w-full rounded-2xl border border-[#E2E8F0] bg-white flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 text-[#64748B] flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#172554]">
                  No transaction records found
                </h3>
                <p className="text-xs text-[#64748B] max-w-md">
                  {searchQuery || bankFilter !== "ALL" || minAmount
                    ? "No transactions match your active search and filter criteria."
                    : "The selected NCRP workbook does not contain layer-wise money transfer transactions."}
                </p>
                {(searchQuery || bankFilter !== "ALL" || minAmount) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setBankFilter("ALL");
                      setMinAmount("");
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-[#DCE5EF] bg-slate-50 text-[#172554] hover:bg-slate-100 transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              /* Condition 5: Successful Graph render with live nodes & edges */
              <>
                {isExpanding && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-purple-900/90 text-white text-xs font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 animate-in fade-in duration-200">
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Expanding layer...</span>
                  </div>
                )}
                <NcrpHierarchicalGraph
                  nodes={nodes}
                  edges={edges}
                  selectedRoot={selectedRootAccount || graphData?.selected_root}
                  selectedAccount={drawerAccount}
                  expandedAccounts={expandedAccounts}
                  onNodeClick={handleNodeClick}
                  onSelectAccount={handleSelectAccount}
                  onExpandAccount={handleExpandAccount}
                  onTerminalClick={handleTerminalClick}
                  searchQuery={searchQuery}
                  bankFilter={bankFilter}
                  isLoading={isExpanding}
                />
              </>
            )}
          </div>

          {/* Fixed Dedicated Right-Side Information Panel on Desktop */}
          <div className="hidden lg:block w-[460px] xl:w-[500px] shrink-0 sticky top-2">
            <NcrpAccountPanel
              account={drawerAccount}
              rootAccount={selectedRootAccount || graphData?.selected_root}
              fileId={selectedFileId}
              caseId={selectedCaseId}
              onExpandInGraph={handleExpandAccount}
              onSelectAccount={handleSelectAccount}
              onClose={() => setDrawerAccount(null)}
              isCollapsible={false}
              moneyTransferOnly={true}
            />
          </div>
        </div>
      </main>

      {/* Mobile Slide-Over Drawer for small screens */}
      <div className="lg:hidden">
        <NcrpAccountDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          account={drawerAccount}
          rootAccount={selectedRootAccount || graphData?.selected_root}
          fileId={selectedFileId}
          caseId={selectedCaseId}
          onExpandInGraph={handleExpandAccount}
          onSelectAccount={handleSelectAccount}
          moneyTransferOnly={true}
        />
      </div>

      <UserFooter />
    </div>
  );
}
