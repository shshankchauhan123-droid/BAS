import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";

import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import NcrpLayerFlowChart from "../../../components/reports/NcrpLayerFlowChart";

import { getCases } from "../../../services/api/case";
import {
  getCaseNcrpFiles,
  getNcrpFileView,
  getNcrpSankey,
  getNcrpTransactions,
  getNcrpLayerActivity,
  getNcrpAccountProfile,
  getNcrpTraceNext,
} from "../../../services/api/ncrp";
import { formatFinancialValue } from "../../../utils/chartFormatter";

/**
 * Format amounts into Indian numbering system (e.g. 1,23,456.78)
 */
function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format byte size into human readable string
 */
function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Searchable Select Dropdown Component
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
  badgeColor = "emerald",
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
    <div ref={dropdownRef} className={`relative flex-1 ${isOpen ? "z-40" : "z-10"}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {stepNumber && (
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black ${
                  badgeColor === "purple"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {stepNumber}
              </span>
            )}
            <span>{label}</span>
          </span>
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          )}
        </label>
      )}

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold shadow-2xs transition-all ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : isOpen
            ? "border-emerald-500 bg-white ring-2 ring-emerald-500/20"
            : "border-slate-300 bg-white hover:border-slate-400 text-slate-800"
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          {selectedItem ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold text-slate-900">
                  {selectedItem.label}
                </span>
                {selectedItem.badge && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                      badgeColor === "purple"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {selectedItem.badge}
                  </span>
                )}
              </div>
              {selectedItem.subtitle && (
                <span className="truncate text-[11px] font-normal text-slate-500">
                  {selectedItem.subtitle}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ml-2 ${
            isOpen ? "rotate-180 text-emerald-600" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2">
            <svg
              className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50/90 text-emerald-950 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold">
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                              badgeColor === "purple"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="truncate text-[10px] text-slate-500 font-normal">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <svg
                        className="h-4 w-4 text-emerald-600 shrink-0 ml-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NcrpMoneyFlowReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCaseId = searchParams.get("caseId");

  // 1. Case State
  const [casesList, setCasesList] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(urlCaseId || "");
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [caseError, setCaseError] = useState("");

  // 2. NCRP Files State
  const [ncrpFiles, setNcrpFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");

  // 3. Dynamic Layer Summaries & Available Layers
  const [layerSummaries, setLayerSummaries] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState("1"); // Default to Layer 1
  const [isLoadingLayerSummaries, setIsLoadingLayerSummaries] = useState(false);

  // 4. Selected-Layer Graph Flow State
  const [flowData, setFlowData] = useState({
    nodes: [],
    links: [],
    kpis: null,
  });
  const [isLoadingFlow, setIsLoadingFlow] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [disputeMetricMode, setDisputeMetricMode] = useState("transaction"); // "transaction" | "disputed"

  // 5. Account / Connection Selection State (Drill-down Focus)
  const [selectedSender, setSelectedSender] = useState(null);
  const [selectedReceiver, setSelectedReceiver] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // 5b. Consolidated 360° Account Profile & Next-Layer Trace State
  const [accountProfile, setAccountProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [traceInfo, setTraceInfo] = useState(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  // 5c. Multi-Layer Trace Navigation History Stack
  const [traceHistory, setTraceHistory] = useState([]);

  // 5d. Layer Multi-Worksheet Activity Breakdown State
  const [layerActivity, setLayerActivity] = useState(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [accountPanelTab, setAccountPanelTab] = useState("counterparties"); // "counterparties" | "withdrawals" | "holds" | "records"

  // 6. Senders & Receivers quick search within selected layer
  const [senderFilterQuery, setSenderFilterQuery] = useState("");
  const [receiverFilterQuery, setReceiverFilterQuery] = useState("");

  // 7. Selected-Layer Transactions Table State
  const [tableTransactions, setTableTransactions] = useState([]);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [tableError, setTableError] = useState("");
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedTableSearch, setDebouncedTableSearch] = useState("");
  const [tableBank, setTableBank] = useState("ALL");
  const [tableDateFrom, setTableDateFrom] = useState("");
  const [tableDateTo, setTableDateTo] = useState("");
  const [tableMinAmount, setTableMinAmount] = useState("");
  const [tableMaxAmount, setTableMaxAmount] = useState("");
  const [tableSortBy, setTableSortBy] = useState("row_number");
  const [tableSortOrder, setTableSortOrder] = useState("asc");
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [availableBanks, setAvailableBanks] = useState([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // 8. Workbook download state
  const [isDownloadingWorkbook, setIsDownloadingWorkbook] = useState(false);

  // Debounce table search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTableSearch(tableSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [tableSearch]);

  // Load authorized cases on initial mount
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      try {
        setIsLoadingCases(true);
        setCaseError("");
        const res = await getCases();
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (isMounted) {
          setCasesList(list);
          if (urlCaseId) {
            setSelectedCaseId(urlCaseId);
          } else if (list.length > 0 && !selectedCaseId) {
            setSelectedCaseId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
        if (isMounted) {
          setCaseError(
            err?.response?.data?.detail ||
              err?.message ||
              "Unable to load investigation cases."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCases(false);
        }
      }
    }
    fetchCases();
    return () => {
      isMounted = false;
    };
  }, [urlCaseId]);

  // When selectedCaseId changes: reset and load NCRP files
  useEffect(() => {
    if (!selectedCaseId) {
      setNcrpFiles([]);
      setSelectedFileId("");
      setLayerSummaries([]);
      setFlowData({ nodes: [], links: [], kpis: null });
      return;
    }

    let isMounted = true;
    async function fetchNcrpFiles() {
      try {
        setIsLoadingFiles(true);
        setFilesError("");
        setSelectedFileId("");
        setLayerSummaries([]);
        setFlowData({ nodes: [], links: [], kpis: null });
        setSelectedSender(null);
        setSelectedReceiver(null);
        setSelectedLink(null);

        const res = await getCaseNcrpFiles(selectedCaseId);
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (isMounted) {
          setNcrpFiles(list);
          if (list.length > 0) {
            setSelectedFileId(String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Failed to load NCRP files for case:", err);
        if (isMounted) {
          setFilesError(
            err?.response?.data?.detail ||
              err?.message ||
              "Failed to load NCRP workbooks for this case."
          );
          setNcrpFiles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFiles(false);
        }
      }
    }

    fetchNcrpFiles();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // Selected file object
  const activeFile = useMemo(() => {
    return ncrpFiles.find((f) => String(f.id) === String(selectedFileId)) || null;
  }, [ncrpFiles, selectedFileId]);

  // Load complete layer summaries for the workbook
  const fetchWorkbookLayerSummaries = useCallback(async () => {
    if (!selectedFileId || !selectedCaseId) {
      setLayerSummaries([]);
      return;
    }
    if (activeFile && String(activeFile.status).toUpperCase() !== "COMPLETED") {
      setLayerSummaries([]);
      return;
    }

    try {
      setIsLoadingLayerSummaries(true);
      const res = await getNcrpSankey(selectedFileId, {
        caseId: selectedCaseId,
        moneyTransferOnly: true,
      });

      if (res && Array.isArray(res.layer_summaries) && res.layer_summaries.length > 0) {
        setLayerSummaries(res.layer_summaries);
        // Default to first available layer if current selectedLayer is not in summaries
        const layerExists = res.layer_summaries.some(
          (s) => String(s.layer_num) === String(selectedLayer) || s.layer === `Layer ${selectedLayer}`
        );
        if (!layerExists && res.layer_summaries.length > 0) {
          setSelectedLayer(String(res.layer_summaries[0].layer_num));
        }
      } else if (res && Array.isArray(res.available_layers) && res.available_layers.length > 0) {
        // Fallback if layer_summaries is empty
        const fallback = res.available_layers.map((l, idx) => ({
          layer: `Layer ${l}`,
          layer_num: Number(l) || idx + 1,
          transaction_count: 0,
          unique_senders: 0,
          unique_receivers: 0,
          total_amount: 0,
          total_disputed: 0,
          distinct_accounts: 0,
        }));
        setLayerSummaries(fallback);
      }
    } catch (err) {
      console.error("Failed to load workbook layer summaries:", err);
    } finally {
      setIsLoadingLayerSummaries(false);
    }
  }, [selectedFileId, selectedCaseId, activeFile]);

  useEffect(() => {
    fetchWorkbookLayerSummaries();
  }, [fetchWorkbookLayerSummaries]);

  // Fetch money flow visualization for the SELECTED LAYER
  const fetchSelectedLayerFlow = useCallback(async () => {
    if (!selectedFileId || !selectedCaseId || !selectedLayer) {
      setFlowData({ nodes: [], links: [], kpis: null });
      return;
    }
    if (activeFile && String(activeFile.status).toUpperCase() !== "COMPLETED") {
      setFlowData({ nodes: [], links: [], kpis: null });
      return;
    }

    try {
      setIsLoadingFlow(true);
      setFlowError("");
      const res = await getNcrpSankey(selectedFileId, {
        caseId: selectedCaseId,
        moneyTransferOnly: true,
        layer: selectedLayer,
      });

      if (res && typeof res === "object") {
        setFlowData({
          nodes: Array.isArray(res.nodes) ? res.nodes : [],
          links: Array.isArray(res.links) ? res.links : [],
          kpis: res.kpis || null,
        });

        if (Array.isArray(res.available_banks) && res.available_banks.length > 0) {
          setAvailableBanks(res.available_banks);
        }
      }
    } catch (err) {
      console.error("Failed to load selected layer flow:", err);
      setFlowError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load money transfer flow for this layer."
      );
    } finally {
      setIsLoadingFlow(false);
    }
  }, [selectedFileId, selectedCaseId, selectedLayer, activeFile]);

  useEffect(() => {
    fetchSelectedLayerFlow();
  }, [fetchSelectedLayerFlow]);

  // Load layer multi-worksheet activity breakdown
  const fetchLayerActivity = useCallback(async () => {
    if (!selectedFileId || !selectedCaseId || !selectedLayer) {
      setLayerActivity(null);
      return;
    }
    if (activeFile && String(activeFile.status).toUpperCase() !== "COMPLETED") {
      setLayerActivity(null);
      return;
    }

    try {
      setIsLoadingActivity(true);
      const res = await getNcrpLayerActivity(selectedFileId, {
        caseId: selectedCaseId,
        layer: selectedLayer,
      });
      if (res && typeof res === "object") {
        setLayerActivity(res);
      }
    } catch (err) {
      console.error("Failed to load layer activity breakdown:", err);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [selectedFileId, selectedCaseId, selectedLayer, activeFile]);

  useEffect(() => {
    fetchLayerActivity();
  }, [fetchLayerActivity]);

  // Load 360-degree account profile and forward trace
  useEffect(() => {
    if (!selectedAccount || !selectedFileId) {
      setAccountProfile(null);
      setTraceInfo(null);
      return;
    }

    let isMounted = true;
    async function loadAccountData() {
      try {
        setIsLoadingProfile(true);
        const prof = await getNcrpAccountProfile(selectedFileId, selectedAccount, {
          caseId: selectedCaseId,
          layer: selectedLayer,
        });
        if (isMounted) setAccountProfile(prof);
      } catch (err) {
        console.error("Failed to load account profile:", err);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }

      try {
        setIsLoadingTrace(true);
        const curNum = Number(selectedLayer) || 1;
        const trace = await getNcrpTraceNext(selectedFileId, selectedAccount, curNum, {
          caseId: selectedCaseId,
        });
        if (isMounted) setTraceInfo(trace);
      } catch (err) {
        console.error("Failed to load forward trace:", err);
      } finally {
        if (isMounted) setIsLoadingTrace(false);
      }
    }

    loadAccountData();
    return () => {
      isMounted = false;
    };
  }, [selectedAccount, selectedFileId, selectedCaseId, selectedLayer]);

  // Fetch transactions table strictly filtered to the SELECTED LAYER
  const fetchLayerTransactions = useCallback(async () => {
    if (!selectedFileId || !selectedCaseId || !selectedLayer) {
      setTableTransactions([]);
      setTableTotal(0);
      return;
    }

    try {
      setIsLoadingTable(true);
      setTableError("");

      let targetSheet = "ALL";
      if (selectedCategory && selectedCategory !== "ALL") {
        const catMatch = layerActivity?.categories?.find(
          (c) => c.category === selectedCategory || c.sheet_name === selectedCategory
        );
        targetSheet = catMatch ? catMatch.sheet_name : selectedCategory;
      }

      const res = await getNcrpTransactions(selectedFileId, {
        caseId: selectedCaseId,
        layer: selectedLayer,
        sheetName: targetSheet,
        bankName: tableBank !== "ALL" ? tableBank : null,
        search: debouncedTableSearch || null,
        dateFrom: tableDateFrom || null,
        dateTo: tableDateTo || null,
        minAmount: tableMinAmount !== "" ? tableMinAmount : null,
        maxAmount: tableMaxAmount !== "" ? tableMaxAmount : null,
        skip: (tablePage - 1) * tablePageSize,
        limit: tablePageSize,
        sortBy: tableSortBy,
        sortOrder: tableSortOrder,
      });

      if (res && Array.isArray(res.items)) {
        setTableTransactions(res.items);
        setTableTotal(Number(res.total || res.items.length));
        if (Array.isArray(res.banks) && res.banks.length > 0) {
          setAvailableBanks(res.banks);
        }
      } else {
        setTableTransactions([]);
        setTableTotal(0);
      }
    } catch (err) {
      console.error("Failed to load layer transactions table:", err);
      setTableError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load transactions for this layer."
      );
      setTableTransactions([]);
      setTableTotal(0);
    } finally {
      setIsLoadingTable(false);
    }
  }, [
    selectedFileId,
    selectedCaseId,
    selectedLayer,
    selectedCategory,
    layerActivity,
    tableBank,
    debouncedTableSearch,
    tableDateFrom,
    tableDateTo,
    tableMinAmount,
    tableMaxAmount,
    tablePage,
    tablePageSize,
    tableSortBy,
    tableSortOrder,
  ]);

  useEffect(() => {
    fetchLayerTransactions();
  }, [fetchLayerTransactions]);

  // Reset pagination when layer or table filters change
  useEffect(() => {
    setTablePage(1);
    setExpandedRowId(null);
  }, [
    selectedLayer,
    selectedCategory,
    tableBank,
    debouncedTableSearch,
    tableDateFrom,
    tableDateTo,
    tableMinAmount,
    tableMaxAmount,
  ]);

  // Clean Account / Link selection when layer or workbook changes
  const handleSelectLayer = (layerNum) => {
    setSelectedLayer(String(layerNum));
    setSelectedSender(null);
    setSelectedReceiver(null);
    setSelectedLink(null);
    setSelectedAccount(null);
    setSelectedCategory("ALL");
    setSenderFilterQuery("");
    setReceiverFilterQuery("");
  };

  // Derive unique Sender and Receiver accounts from current layer links
  const { senderAccounts, receiverAccounts, allLinksInLayer } = useMemo(() => {
    const links = flowData.links || [];
    const sendersMap = new Map();
    const receiversMap = new Map();

    links.forEach((l) => {
      const srcAcc = l.source_acc;
      const tgtAcc = l.target_acc;
      const val = Number(l.value || 0);
      const disp = Number(l.disputed_value || 0);
      const count = Number(l.tx_count || 1);

      // Sender aggregation
      if (!sendersMap.has(srcAcc)) {
        sendersMap.set(srcAcc, {
          account: srcAcc,
          bank: l.source_bank || "Source Bank",
          outgoing_count: 0,
          outgoing_amount: 0,
          disputed_amount: 0,
          receivers: new Set(),
        });
      }
      const sObj = sendersMap.get(srcAcc);
      sObj.outgoing_count += count;
      sObj.outgoing_amount += val;
      sObj.disputed_amount += disp;
      sObj.receivers.add(tgtAcc);

      // Receiver aggregation
      if (!receiversMap.has(tgtAcc)) {
        receiversMap.set(tgtAcc, {
          account: tgtAcc,
          bank: l.target_bank || "Destination Bank",
          incoming_count: 0,
          incoming_amount: 0,
          disputed_amount: 0,
          senders: new Set(),
        });
      }
      const rObj = receiversMap.get(tgtAcc);
      rObj.incoming_count += count;
      rObj.incoming_amount += val;
      rObj.disputed_amount += disp;
      rObj.senders.add(srcAcc);
    });

    const sendersArr = Array.from(sendersMap.values()).map((s) => ({
      ...s,
      distinct_receivers: s.receivers.size,
    })).sort((a, b) => b.outgoing_amount - a.outgoing_amount);

    const receiversArr = Array.from(receiversMap.values()).map((r) => ({
      ...r,
      distinct_senders: r.senders.size,
    })).sort((a, b) => b.incoming_amount - a.incoming_amount);

    return {
      senderAccounts: sendersArr,
      receiverAccounts: receiversArr,
      allLinksInLayer: links,
    };
  }, [flowData.links]);

  // Filtered senders and receivers for Area A and Area C search
  const displayedSenders = useMemo(() => {
    if (!senderFilterQuery.trim()) return senderAccounts;
    const q = senderFilterQuery.toLowerCase();
    return senderAccounts.filter(
      (s) =>
        s.account.toLowerCase().includes(q) ||
        (s.bank && s.bank.toLowerCase().includes(q))
    );
  }, [senderAccounts, senderFilterQuery]);

  const displayedReceivers = useMemo(() => {
    if (!receiverFilterQuery.trim()) return receiverAccounts;
    const q = receiverFilterQuery.toLowerCase();
    return receiverAccounts.filter(
      (r) =>
        r.account.toLowerCase().includes(q) ||
        (r.bank && r.bank.toLowerCase().includes(q))
    );
  }, [receiverAccounts, receiverFilterQuery]);

  // Check if a receiver account exists in subsequent layer
  const nextLayerNum = useMemo(() => {
    const curNum = Number(selectedLayer);
    const candidate = curNum + 1;
    const hasNext = layerSummaries.some((s) => s.layer_num === candidate);
    return hasNext ? candidate : null;
  }, [selectedLayer, layerSummaries]);

  // Jump to next layer with specific account
  const handleJumpToNextLayer = (account) => {
    if (!nextLayerNum) return;
    setSelectedLayer(String(nextLayerNum));
    setSelectedSender(account);
    setSelectedReceiver(null);
    setSelectedLink(null);
    setSelectedAccount(account);
  };

  const [copiedAcc, setCopiedAcc] = useState("");
  const handleCopy = (acc) => {
    if (!acc) return;
    navigator.clipboard?.writeText(String(acc));
    setCopiedAcc(String(acc));
    setTimeout(() => setCopiedAcc(""), 2000);
  };

  const normAccount = (val) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/^[-_:\s]+/, "").trim();
  };

  // Click handlers for Account / Link selection
  const handleToggleSender = (account) => {
    if (selectedSender && normAccount(selectedSender) === normAccount(account)) {
      setSelectedSender(null);
      setSelectedAccount(null);
    } else {
      setSelectedSender(account);
      setSelectedAccount(account);
      setSelectedReceiver(null);
      setSelectedLink(null);
    }
  };

  const handleToggleReceiver = (account) => {
    if (selectedReceiver && normAccount(selectedReceiver) === normAccount(account)) {
      setSelectedReceiver(null);
      setSelectedAccount(null);
    } else {
      setSelectedReceiver(account);
      setSelectedAccount(account);
      setSelectedSender(null);
      setSelectedLink(null);
    }
  };

  const handleInspectAccount = (account) => {
    if (!account || account === "-") return;
    setSelectedAccount(account);
    const isSender = senderAccounts.some((s) => normAccount(s.account) === normAccount(account));
    const isReceiver = receiverAccounts.some((r) => normAccount(r.account) === normAccount(account));
    if (isSender) {
      setSelectedSender(account);
      setSelectedReceiver(null);
    } else if (isReceiver) {
      setSelectedReceiver(account);
      setSelectedSender(null);
    } else {
      setSelectedSender(null);
      setSelectedReceiver(null);
    }
    setSelectedLink(null);
  };

  // Trace Next Layer handler with history stack
  const handleTraceForward = (account, targetNextLayer) => {
    const accToTrace = account || selectedAccount;
    const nextLayer = targetNextLayer || traceInfo?.next_layer;
    if (!nextLayer || !accToTrace) return;

    // Push current step to history stack
    setTraceHistory((prev) => [
      ...prev,
      {
        layer: selectedLayer,
        account: accToTrace,
        title: `Layer ${selectedLayer} (${accToTrace})`,
      },
    ]);

    // Switch to target layer
    setSelectedLayer(String(nextLayer));
    setSelectedAccount(accToTrace);
    setSelectedSender(accToTrace);
    setSelectedReceiver(null);
    setSelectedLink(null);
  };

  // Back to Previous Layer handler
  const handleBackToPreviousTrace = () => {
    if (traceHistory.length === 0) return;
    const prevStep = traceHistory[traceHistory.length - 1];
    setTraceHistory((prev) => prev.slice(0, -1));

    setSelectedLayer(String(prevStep.layer));
    setSelectedAccount(prevStep.account);
    setSelectedReceiver(prevStep.account);
    setSelectedSender(null);
    setSelectedLink(null);
  };

  const handleSelectLink = (link) => {
    if (!link) return;
    setSelectedLink(link);
    setSelectedSender(null);
    setSelectedReceiver(null);
  };

  const handleClearFocusSelection = () => {
    setSelectedSender(null);
    setSelectedReceiver(null);
    setSelectedLink(null);
    setSelectedAccount(null);
  };

  // Detailed data for Right Panel when Sender is selected
  const selectedSenderData = useMemo(() => {
    if (!selectedSender) return null;
    const normSelected = normAccount(selectedSender);
    const base = senderAccounts.find((s) => normAccount(s.account) === normSelected) || {
      account: selectedSender,
      bank: "Source Bank",
      outgoing_count: 0,
      outgoing_amount: 0,
      disputed_amount: 0,
      distinct_receivers: 0,
    };

    const connectedLinks = allLinksInLayer.filter(
      (l) => normAccount(l.source_acc) === normSelected
    );

    const connectedReceivers = connectedLinks
      .map((l) => ({
        account: l.target_acc,
        bank: l.target_bank,
        amount: Number(l.value || 0),
        disputed: Number(l.disputed_value || 0),
        tx_count: Number(l.tx_count || 1),
        utr: l.utr,
      }))
      .sort((a, b) => b.amount - a.amount);

    const txs = [];
    connectedLinks.forEach((l) => {
      if (Array.isArray(l.transactions)) {
        txs.push(...l.transactions);
      }
    });

    return {
      ...base,
      connectedReceivers,
      transactions: txs,
    };
  }, [selectedSender, senderAccounts, allLinksInLayer]);

  // Detailed data for Right Panel when Receiver is selected
  const selectedReceiverData = useMemo(() => {
    if (!selectedReceiver) return null;
    const normSelected = normAccount(selectedReceiver);
    const base = receiverAccounts.find((r) => normAccount(r.account) === normSelected) || {
      account: selectedReceiver,
      bank: "Destination Bank",
      incoming_count: 0,
      incoming_amount: 0,
      disputed_amount: 0,
      distinct_senders: 0,
    };

    const connectedLinks = allLinksInLayer.filter(
      (l) => normAccount(l.target_acc) === normSelected
    );

    const connectedSenders = connectedLinks
      .map((l) => ({
        account: l.source_acc,
        bank: l.source_bank,
        amount: Number(l.value || 0),
        disputed: Number(l.disputed_value || 0),
        tx_count: Number(l.tx_count || 1),
        utr: l.utr,
      }))
      .sort((a, b) => b.amount - a.amount);

    const txs = [];
    connectedLinks.forEach((l) => {
      if (Array.isArray(l.transactions)) {
        txs.push(...l.transactions);
      }
    });

    return {
      ...base,
      connectedSenders,
      transactions: txs,
    };
  }, [selectedReceiver, receiverAccounts, allLinksInLayer]);

  // Detailed transactions under selected link
  const selectedLinkTransactions = useMemo(() => {
    if (!selectedLink) return [];
    if (Array.isArray(selectedLink.transactions) && selectedLink.transactions.length > 0) {
      return selectedLink.transactions;
    }
    const normSrc = normAccount(selectedLink.source_acc);
    const normTgt = normAccount(selectedLink.target_acc);
    return tableTransactions.filter((tx) => {
      const raw = tx.raw_data || {};
      const destAcc = normAccount(raw["Account No"] || raw["account_no"] || "");
      const srcAcc = normAccount(tx.account_or_wallet_id || "");
      return srcAcc === normSrc && destAcc === normTgt;
    });
  }, [selectedLink, tableTransactions]);

  // Filter table records client-side if a specific sender, receiver, account, or link is focused
  const displayedTableTransactions = useMemo(() => {
    if (!selectedSender && !selectedReceiver && !selectedLink && !selectedAccount) {
      return tableTransactions;
    }

    return tableTransactions.filter((tx) => {
      const raw = tx.raw_data || {};
      const destAcc = normAccount(raw["Account No"] || raw["account_no"] || "");
      const srcAcc = normAccount(tx.account_or_wallet_id || "");

      if (selectedLink) {
        if (selectedLink.tx_ids && selectedLink.tx_ids.includes(tx.id)) return true;
        const normSrc = normAccount(selectedLink.source_acc);
        const normTgt = normAccount(selectedLink.target_acc);
        return srcAcc === normSrc && destAcc === normTgt;
      }
      if (selectedSender && selectedReceiver) {
        return srcAcc === normAccount(selectedSender) && destAcc === normAccount(selectedReceiver);
      }
      if (selectedSender) {
        return srcAcc === normAccount(selectedSender);
      }
      if (selectedReceiver) {
        return destAcc === normAccount(selectedReceiver);
      }
      if (selectedAccount) {
        return srcAcc === normAccount(selectedAccount) || destAcc === normAccount(selectedAccount);
      }
      return true;
    });
  }, [tableTransactions, selectedSender, selectedReceiver, selectedLink, selectedAccount]);

  // Export currently filtered layer records to Excel
  const handleExportFilteredToExcel = async () => {
    if (!selectedFileId || !selectedCaseId) return;

    try {
      setIsExportingExcel(true);
      let targetSheet = "ALL";
      if (selectedCategory && selectedCategory !== "ALL") {
        const catMatch = layerActivity?.categories?.find(
          (c) => c.category === selectedCategory || c.sheet_name === selectedCategory
        );
        targetSheet = catMatch ? catMatch.sheet_name : selectedCategory;
      }

      // Fetch all records for this layer and current filters (limit: 5000)
      const res = await getNcrpTransactions(selectedFileId, {
        caseId: selectedCaseId,
        layer: selectedLayer,
        sheetName: targetSheet,
        bankName: tableBank !== "ALL" ? tableBank : null,
        search: debouncedTableSearch || null,
        dateFrom: tableDateFrom || null,
        dateTo: tableDateTo || null,
        minAmount: tableMinAmount !== "" ? tableMinAmount : null,
        maxAmount: tableMaxAmount !== "" ? tableMaxAmount : null,
        skip: 0,
        limit: 5000,
        sortBy: tableSortBy,
        sortOrder: tableSortOrder,
      });

      const rowsToExport = (res && Array.isArray(res.items) ? res.items : displayedTableTransactions).map(
        (tx, idx) => {
          const raw = tx.raw_data || {};
          return {
            "S No": idx + 1,
            Worksheet: tx.sheet_name || "",
            "Acknowledgement No": tx.acknowledgement_no || "",
            "Account / Wallet ID": tx.account_or_wallet_id || "",
            "Action Bank / Sender Bank":
              raw["Action Taken By bank"] || raw["action_taken_by_bank"] || tx.bank_name || "",
            "Beneficiary / Receiver Account": raw["Account No"] || raw["account_no"] || "",
            "Beneficiary Bank / FI": tx.bank_name || raw["Bank/FIs"] || "",
            Layer: tx.layer || selectedLayer,
            "Transaction ID / UTR": tx.transaction_id_utr || "",
            "Transaction Date": tx.transaction_date ? tx.transaction_date.split("T")[0] : "",
            "Transaction Amount (INR)": tx.transaction_amount !== null ? Number(tx.transaction_amount) : 0,
            "Disputed Amount (INR)": tx.disputed_amount !== null ? Number(tx.disputed_amount) : 0,
            "Put on Hold Amount (INR)": raw["Put on Hold Amount"] || raw["Put on hold Amount"] || (tx.sheet_name === "Transaction put on hold" ? Number(tx.transaction_amount || 0) : ""),
            "ATM ID": raw["ATM ID"] || "",
            "ATM Location": raw["Place/Location of ATM"] || "",
            "Merchant Name": raw["Merchant Name"] || "",
            "MID / TID": raw["MID"] || raw["TID"] || "",
            "Cheque No": raw["Cheque No"] || "",
            "Branch Location": raw["Branch Location"] || "",
            "Reference No": raw["Reference No"] || raw["reference_no"] || "",
            Remarks: raw["Remarks"] || raw["remarks"] || "",
            "Date of Action": raw["Date of Action"] || raw["Put on hold Date"] || "",
          };
        }
      );

      const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
      const workbook = XLSX.utils.book_new();
      const sheetTabName = `Layer_${selectedLayer}_Activity`.slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTabName);
      XLSX.writeFile(
        workbook,
        `NCRP_Case_${selectedCaseId}_Layer_${selectedLayer}_Activity_Report.xlsx`
      );
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      alert("Unable to export transactions. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Download original Excel workbook
  const handleDownloadOriginalWorkbook = async () => {
    if (!activeFile?.id || !selectedCaseId) return;
    try {
      setIsDownloadingWorkbook(true);
      const blob = await getNcrpFileView(activeFile.id, selectedCaseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = activeFile.original_filename || `NCRP_Workbook_${activeFile.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Failed to download workbook:", err);
      alert("Unable to download original workbook.");
    } finally {
      setIsDownloadingWorkbook(false);
    }
  };

  // Case & File options
  const caseOptions = useMemo(() => {
    return casesList.map((c) => ({
      id: c.id,
      label: c.case_name || `Case #${c.id}`,
      subtitle: c.case_number ? `Case No: ${c.case_number}` : `Case ID: ${c.id}`,
      badge: c.status?.replaceAll("_", " "),
    }));
  }, [casesList]);

  const fileOptions = useMemo(() => {
    return ncrpFiles.map((f) => ({
      id: f.id,
      label: f.original_filename,
      subtitle: `${f.sheet_count || 1} sheets • ${Number(
        f.imported_rows ?? f.total_rows ?? 0
      ).toLocaleString("en-IN")} rows • ${formatFileSize(f.file_size)}`,
      badge: f.status || "COMPLETED",
    }));
  }, [ncrpFiles]);

  // Current active layer metadata
  const activeLayerSummary = useMemo(() => {
    return (
      layerSummaries.find(
        (s) => String(s.layer_num) === String(selectedLayer) || s.layer === `Layer ${selectedLayer}`
      ) || null
    );
  }, [layerSummaries, selectedLayer]);

  const layerTotalAmount = activeLayerSummary
    ? activeLayerSummary.total_amount
    : senderAccounts.reduce((sum, s) => sum + s.outgoing_amount, 0);

  const layerTotalDisputed = activeLayerSummary
    ? activeLayerSummary.total_disputed
    : senderAccounts.reduce((sum, s) => sum + s.disputed_amount, 0);

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col">
      <BASNavbar />

      <main className="flex-1 pb-16">
        {/* ============================================================
            1. PAGE HEADER
        ============================================================ */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    NCRP Financial Investigation
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-500">
                    Interactive Layer-Wise Money Flow Dashboard
                  </span>
                </div>
                <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                  Money Flow Investigation
                </h1>
                <p className="mt-1 text-xs text-[#64748B]">
                  Select an investigation layer to trace sender-to-receiver fund dissipation, connected accounts, and transactions.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start md:self-center">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      selectedCaseId
                        ? `/reports/ncrp?caseId=${encodeURIComponent(selectedCaseId)}`
                        : "/reports/ncrp"
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                  title="Return to NCRP Reports Hub"
                >
                  <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to NCRP Reports Hub
                </button>

                {activeFile && (
                  <button
                    type="button"
                    onClick={handleDownloadOriginalWorkbook}
                    disabled={isDownloadingWorkbook}
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-800 shadow-2xs transition hover:bg-purple-100 disabled:opacity-50"
                    title="Download original uploaded Excel workbook"
                  >
                    {isDownloadingWorkbook ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-600/30 border-t-purple-600" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Excel
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* ============================================================
              2. CASE & NCRP WORKBOOK SELECTOR
          ============================================================ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <SearchableSelect
                stepNumber="1"
                label="Select Investigation Case"
                value={selectedCaseId}
                options={caseOptions}
                onSelect={(id) => {
                  setSelectedCaseId(String(id));
                  setSearchParams({ caseId: String(id) }, { replace: true });
                }}
                loading={isLoadingCases}
                placeholder="Choose investigation case..."
                searchPlaceholder="Search case by name or number..."
                emptyMessage="No active cases found"
                badgeColor="emerald"
              />

              <div className="hidden lg:flex items-center justify-center pt-5 text-slate-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              <SearchableSelect
                stepNumber="2"
                label="Select NCRP Statement Workbook"
                value={selectedFileId}
                options={fileOptions}
                onSelect={(id) => {
                  setSelectedFileId(String(id));
                  setSelectedSender(null);
                  setSelectedReceiver(null);
                  setSelectedLink(null);
                }}
                disabled={!selectedCaseId || ncrpFiles.length === 0}
                loading={isLoadingFiles}
                placeholder={
                  !selectedCaseId
                    ? "Select a case first..."
                    : ncrpFiles.length === 0
                    ? "No NCRP workbooks uploaded"
                    : "Choose NCRP workbook..."
                }
                searchPlaceholder="Search workbook filename..."
                emptyMessage="No workbooks found for this case"
                badgeColor="purple"
              />
            </div>

            {/* Error notifications */}
            {caseError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {caseError}
              </div>
            )}
            {filesError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {filesError}
              </div>
            )}

            {selectedCaseId && !isLoadingFiles && ncrpFiles.length === 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>No NCRP Excel workbooks have been uploaded for this case yet.</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/upload/ncrp")}
                  className="rounded-lg bg-amber-600 px-3 py-1 font-bold text-white shadow-2xs hover:bg-amber-700 shrink-0 ml-3"
                >
                  Upload NCRP
                </button>
              </div>
            )}
          </section>

          {/* ============================================================
              3. DYNAMIC LAYER SUMMARY BOXES
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Investigation Layers Summary
                  </h2>
                  <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {layerSummaries.length} {layerSummaries.length === 1 ? "Layer" : "Layers"} Available
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any layer box to focus investigation
                </span>
              </div>

              {isLoadingLayerSummaries ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/2" />
                      <div className="h-5 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : layerSummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                  No layer data available for this workbook.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
                  {layerSummaries.map((box) => {
                    const isSelected =
                      String(selectedLayer) === String(box.layer_num) ||
                      selectedLayer === box.layer;

                    return (
                      <div
                        key={box.layer_num}
                        onClick={() => handleSelectLayer(box.layer_num)}
                        className={`cursor-pointer rounded-2xl p-3.5 transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-2 border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20"
                            : "border border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70 shadow-2xs"
                        }`}
                      >
                        {/* Box Top: Layer Title & Badge */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-black text-xs ${
                              isSelected ? "text-emerald-950 font-extrabold" : "text-slate-800"
                            }`}
                          >
                            {box.layer}
                          </span>
                          {isSelected ? (
                            <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-2xs">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              {box.transaction_count} txns
                            </span>
                          )}
                        </div>

                        {/* Box Volume */}
                        <div className="mt-2.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                            Amount
                          </span>
                          <p
                            className="font-black text-xs text-emerald-800 truncate mt-0.5"
                            title={`₹${formatIndianCurrency(box.total_amount)}`}
                          >
                            ₹{formatFinancialValue(box.total_amount)}
                          </p>
                        </div>

                        {/* Box Disputed Amount */}
                        <div className="mt-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                            Disputed
                          </span>
                          <p
                            className="font-bold text-[11px] text-amber-700 truncate mt-0.5"
                            title={`₹${formatIndianCurrency(box.total_disputed)}`}
                          >
                            ₹{formatFinancialValue(box.total_disputed)}
                          </p>
                        </div>

                        {/* Box Senders & Receivers Ratio */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-bold text-blue-700" title={`${box.unique_senders} unique origin senders`}>
                            {box.unique_senders}S
                          </span>
                          <span className="text-slate-300 font-bold">➔</span>
                          <span className="font-bold text-indigo-700" title={`${box.unique_receivers} unique beneficiary receivers`}>
                            {box.unique_receivers}R
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ============================================================
              4. SELECTED-LAYER THREE-PANEL INVESTIGATION DASHBOARD
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              {/* MULTI-LAYER TRACE TRAIL BREADCRUMB BANNER */}
              {traceHistory.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/80 p-3 shadow-2xs">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-purple-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Investigation Trace Trail:
                    </span>
                    {traceHistory.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-2 py-0.5 font-mono font-bold text-purple-900 shadow-2xs">
                          L{step.layer}: {step.account}
                        </span>
                        <span className="text-purple-400 font-bold">➔</span>
                      </React.Fragment>
                    ))}
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-700 px-2 py-0.5 font-mono font-bold text-white shadow-2xs">
                      L{selectedLayer}: {selectedAccount || "Current"} [Active]
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBackToPreviousTrace}
                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-purple-300 px-2.5 py-1 text-xs font-bold text-purple-800 shadow-2xs hover:bg-purple-100 transition"
                      title="Navigate back to previous investigation step"
                    >
                      ← Back to Layer {traceHistory[traceHistory.length - 1].layer}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTraceHistory([])}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                      title="Clear trace history"
                    >
                      Clear Trail
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION HEADER WITH STATS */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-[#172554] px-2.5 py-1 text-xs font-black text-white shadow-2xs">
                    Layer {selectedLayer}
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-[#172554] tracking-tight">
                      Layer {selectedLayer} Money Flow Investigation
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Sender accounts (left), money transfer flow (center), and interactive 360° account details (right).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-xl border border-blue-200 bg-blue-50/70 px-2.5 py-1 font-bold text-blue-900">
                    {layerActivity?.kpis?.unique_senders ?? senderAccounts.length} Senders
                  </span>
                  <span className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 font-bold text-indigo-900">
                    {layerActivity?.kpis?.unique_receivers ?? receiverAccounts.length} Receivers
                  </span>
                  <span className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 font-bold text-emerald-900">
                    ₹{formatFinancialValue(layerActivity?.kpis?.transfer_amount ?? layerTotalAmount)} Transfers
                  </span>
                  {(layerActivity?.kpis?.withdrawal_amount ?? 0) > 0 && (
                    <span className="rounded-xl border border-orange-200 bg-orange-50/70 px-2.5 py-1 font-bold text-orange-900">
                      ₹{formatFinancialValue(layerActivity.kpis.withdrawal_amount)} Withdrawals
                    </span>
                  )}
                  {(layerActivity?.kpis?.hold_amount ?? 0) > 0 && (
                    <span className="rounded-xl border border-cyan-200 bg-cyan-50/70 px-2.5 py-1 font-bold text-cyan-900">
                      ₹{formatFinancialValue(layerActivity.kpis.hold_amount)} On Hold
                    </span>
                  )}
                  <span className="rounded-xl border border-amber-200 bg-amber-50/70 px-2.5 py-1 font-bold text-amber-900">
                    ₹{formatFinancialValue(layerActivity?.kpis?.disputed_amount ?? layerTotalDisputed)} Disputed
                  </span>
                  <span className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
                    {layerActivity?.total_records ?? tableTotal} Records
                  </span>
                </div>
              </div>

              {/* THREE-PANEL LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* --------------------------------------------------------
                    PANEL 1: SENDER ACCOUNTS (LEFT - 3 COLS)
                -------------------------------------------------------- */}
                <div className="lg:col-span-3 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-3 flex flex-col h-[580px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Sender Accounts
                      </h3>
                    </div>
                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                      {displayedSenders.length}
                    </span>
                  </div>

                  {/* Sender search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search senders..."
                      value={senderFilterQuery}
                      onChange={(e) => setSenderFilterQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {senderFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setSenderFilterQuery("")}
                        className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Senders list */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {displayedSenders.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-400">
                        No senders match filter.
                      </p>
                    ) : (
                      displayedSenders.map((s) => {
                        const isSelected = selectedSender && normAccount(selectedSender) === normAccount(s.account);

                        return (
                          <div
                            key={s.account}
                            onClick={() => handleToggleSender(s.account)}
                            className={`cursor-pointer rounded-xl p-2.5 transition-all text-xs border ${
                              isSelected
                                ? "border-2 border-blue-600 bg-blue-50/90 shadow-2xs ring-2 ring-blue-500/20"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className="font-mono font-bold text-slate-900 select-all break-all pr-1"
                                title={s.account}
                              >
                                {s.account}
                              </span>
                              <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[9px] font-extrabold shrink-0">
                                {s.outgoing_count} out
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-500 truncate" title={s.bank}>
                              {s.bank || "Source Bank"}
                            </p>

                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              <div>
                                <span className="text-slate-400 block text-[9px]">Out Volume</span>
                                <span className="font-bold text-emerald-700">
                                  ₹{formatFinancialValue(s.outgoing_amount)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 block text-[9px]">Disputed</span>
                                <span className="font-bold text-amber-700">
                                  ₹{formatFinancialValue(s.disputed_amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --------------------------------------------------------
                    PANEL 2: MONEY FLOW CONNECTOR (CENTER - 5 COLS)
                -------------------------------------------------------- */}
                <div className="lg:col-span-5 min-w-0 h-[580px]">
                  <NcrpLayerFlowChart
                    layerName={`Layer ${selectedLayer}`}
                    senders={senderAccounts}
                    receivers={receiverAccounts}
                    links={allLinksInLayer}
                    selectedSender={selectedSender}
                    selectedReceiver={selectedReceiver}
                    selectedLink={selectedLink}
                    onSelectSender={handleToggleSender}
                    onSelectReceiver={handleToggleReceiver}
                    onSelectLink={handleSelectLink}
                    metricMode={disputeMetricMode}
                    onMetricToggle={setDisputeMetricMode}
                    isLoading={isLoadingFlow}
                  />
                </div>

                {/* --------------------------------------------------------
                    PANEL 3: INTERACTIVE ACCOUNT DETAILS SIDEBAR (RIGHT - 4 COLS)
                -------------------------------------------------------- */}
                <div className="lg:col-span-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 flex flex-col h-[580px] shadow-2xs">
                  {/* CASE A: TRANSFER CONNECTION SELECTED */}
                  {selectedLink ? (
                    <div className="flex flex-col h-full overflow-hidden space-y-3">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            Transfer Connection
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {selectedLink.layer || `Layer ${selectedLayer}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearFocusSelection}
                          className="text-slate-400 hover:text-slate-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                          title="Close details"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Header: Origin Sender ➔ Beneficiary Receiver */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                              Origin Sender
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="font-mono text-xs font-black text-slate-900 truncate"
                                title={selectedLink.source_acc}
                              >
                                {selectedLink.source_acc}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(selectedLink.source_acc)}
                                className="text-[10px] text-slate-400 hover:text-blue-600 transition"
                                title="Copy account number"
                              >
                                {copiedAcc === selectedLink.source_acc ? "✓" : "📋"}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate" title={selectedLink.source_bank}>
                              {selectedLink.source_bank || "Source Bank"}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleInspectAccount(selectedLink.source_acc)}
                              className="mt-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 underline block"
                            >
                              Inspect Sender Profile ➔
                            </button>
                          </div>
                          <span className="text-slate-300 font-black text-sm pt-2">➔</span>
                          <div className="min-w-0 flex-1 text-right">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                              Beneficiary Receiver
                            </span>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleCopy(selectedLink.target_acc)}
                                className="text-[10px] text-slate-400 hover:text-purple-600 transition"
                                title="Copy account number"
                              >
                                {copiedAcc === selectedLink.target_acc ? "✓" : "📋"}
                              </button>
                              <span
                                className="font-mono text-xs font-black text-slate-900 truncate"
                                title={selectedLink.target_acc}
                              >
                                {selectedLink.target_acc}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate" title={selectedLink.target_bank}>
                              {selectedLink.target_bank || "Destination Bank"}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleInspectAccount(selectedLink.target_acc)}
                              className="mt-1 text-[10px] font-bold text-purple-700 hover:text-purple-900 underline block"
                            >
                              Inspect Receiver Profile ➔
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* KPI Cards */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2 text-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Transfer Amt
                          </span>
                          <span
                            className="font-black text-xs text-emerald-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(selectedLink.value)}`}
                          >
                            ₹{formatFinancialValue(selectedLink.value)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2 text-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 block">
                            Disputed Amt
                          </span>
                          <span
                            className="font-black text-xs text-amber-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(selectedLink.disputed_value)}`}
                          >
                            ₹{formatFinancialValue(selectedLink.disputed_value)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
                            Txn Count
                          </span>
                          <span className="font-black text-xs text-slate-900 mt-0.5 block">
                            {selectedLink.tx_count || 1}
                          </span>
                        </div>
                      </div>

                      {/* Individual Transactions Table */}
                      <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                            Connection Transactions ({selectedLinkTransactions.length})
                          </h4>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/40">
                          {selectedLinkTransactions.length === 0 ? (
                            <p className="text-center py-6 text-xs text-slate-400">
                              No transaction records available.
                            </p>
                          ) : (
                            selectedLinkTransactions.map((tx, idx) => (
                              <div
                                key={tx.id || idx}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-800">
                                    ₹{formatIndianCurrency(tx.amount || tx.transaction_amount)}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {tx.date ? String(tx.date).split("T")[0] : "-"}
                                  </span>
                                </div>
                                {(tx.disputed_amount || tx.disputed_value) > 0 && (
                                  <div className="text-[10px] text-amber-700 font-semibold">
                                    Disputed: ₹{formatIndianCurrency(tx.disputed_amount || tx.disputed_value)}
                                  </div>
                                )}
                                {tx.utr && (
                                  <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <span className="text-slate-400">UTR:</span>
                                    <span className="font-mono font-bold select-all truncate">{tx.utr}</span>
                                  </div>
                                )}
                                {tx.remarks && (
                                  <div className="text-[10px] text-slate-500 italic truncate" title={tx.remarks}>
                                    "{tx.remarks}"
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : selectedAccount ? (
                    /* CASE B: 360-DEGREE CONSOLIDATED ACCOUNT PROFILE */
                    <div className="flex flex-col h-full overflow-hidden space-y-2.5">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            Account Profile
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            Layer {selectedLayer}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearFocusSelection}
                          className="text-slate-400 hover:text-slate-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                          title="Close details"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Account Card */}
                      <div className="rounded-xl bg-gradient-to-r from-purple-50/70 to-indigo-50/50 border border-purple-200/80 p-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="font-mono text-sm font-black text-slate-900 select-all truncate pr-2"
                            title={selectedAccount}
                          >
                            {selectedAccount}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedAccount)}
                            className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 hover:bg-purple-50 transition shrink-0"
                            title="Copy account number"
                          >
                            {copiedAcc === selectedAccount ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate" title={accountProfile?.bank_name}>
                          {accountProfile?.bank_name || "Bank / Financial Institution"}
                        </p>
                      </div>

                      {/* TRACE NEXT LAYER INTERACTIVE ACTION BANNER */}
                      {isLoadingTrace ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center text-xs text-slate-500 animate-pulse">
                          Scanning next layer for fund dissipation...
                        </div>
                      ) : traceInfo?.has_next_activity ? (
                        <div className="rounded-xl border border-purple-300 bg-purple-50 p-2.5 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                              </span>
                              Activity in Layer {traceInfo.next_layer}
                            </span>
                            <span className="font-bold text-xs text-purple-900">
                              ₹{formatFinancialValue(traceInfo.next_total_amount)}
                            </span>
                          </div>
                          <p className="text-[10px] text-purple-700">
                            {traceInfo.next_transfers > 0 && `${traceInfo.next_transfers} transfers `}
                            {traceInfo.next_withdrawals > 0 && `• ${traceInfo.next_withdrawals} withdrawals `}
                            {traceInfo.next_holds > 0 && `• ${traceInfo.next_holds} holds`}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleTraceForward(selectedAccount, traceInfo.next_layer)}
                            className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-1.5 px-3 text-xs font-bold text-white shadow-2xs hover:bg-purple-700 transition"
                          >
                            <span>Trace Next Layer → (Layer {traceInfo.next_layer})</span>
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-[10px] text-slate-600 flex items-center gap-1.5">
                          <span className="text-slate-400">ℹ️</span>
                          <span className="truncate">{traceInfo?.message || "No forward dissipation recorded in subsequent layers."}</span>
                        </div>
                      )}

                      {/* 5 CONSOLIDATED KPI TILES */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-1.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Inflow ({accountProfile?.incoming_count || 0})
                          </span>
                          <span
                            className="font-black text-[11px] text-emerald-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(accountProfile?.inflow_amount || 0)}`}
                          >
                            ₹{formatFinancialValue(accountProfile?.inflow_amount || 0)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-1.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-blue-700 block">
                            Outflow ({accountProfile?.outgoing_count || 0})
                          </span>
                          <span
                            className="font-black text-[11px] text-blue-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(accountProfile?.outflow_amount || 0)}`}
                          >
                            ₹{formatFinancialValue(accountProfile?.outflow_amount || 0)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-1.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-orange-700 block">
                            Withdraw ({accountProfile?.withdrawal_count || 0})
                          </span>
                          <span
                            className="font-black text-[11px] text-orange-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(accountProfile?.withdrawal_amount || 0)}`}
                          >
                            ₹{formatFinancialValue(accountProfile?.withdrawal_amount || 0)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-1.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-700 block">
                            On Hold ({accountProfile?.hold_count || 0})
                          </span>
                          <span
                            className="font-black text-[11px] text-cyan-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(accountProfile?.hold_amount || 0)}`}
                          >
                            ₹{formatFinancialValue(accountProfile?.hold_amount || 0)}
                          </span>
                        </div>
                        <div className="col-span-2 rounded-lg border border-amber-100 bg-amber-50/60 p-1.5 flex items-center justify-between">
                          <div>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 block">
                              Disputed Amount
                            </span>
                            <span
                              className="font-black text-[11px] text-amber-950 mt-0.5 block truncate"
                              title={`₹${formatIndianCurrency(accountProfile?.disputed_amount || 0)}`}
                            >
                              ₹{formatFinancialValue(accountProfile?.disputed_amount || 0)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                            {((accountProfile?.transactions || []).length)} records
                          </span>
                        </div>
                      </div>

                      {/* TAB CONTROLS */}
                      <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setAccountPanelTab("counterparties")}
                          className={`px-2 py-1 rounded-md transition ${
                            accountPanelTab === "counterparties"
                              ? "bg-purple-100 text-purple-900 font-black"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Counterparties ({((accountProfile?.beneficiaries || []).length + (accountProfile?.senders || []).length)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountPanelTab("withdrawals")}
                          className={`px-2 py-1 rounded-md transition ${
                            accountPanelTab === "withdrawals"
                              ? "bg-purple-100 text-purple-900 font-black"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Withdrawals ({(accountProfile?.withdrawals || []).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountPanelTab("holds")}
                          className={`px-2 py-1 rounded-md transition ${
                            accountPanelTab === "holds"
                              ? "bg-purple-100 text-purple-900 font-black"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Holds ({(accountProfile?.holds || []).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountPanelTab("all")}
                          className={`px-2 py-1 rounded-md transition ${
                            accountPanelTab === "all"
                              ? "bg-purple-100 text-purple-900 font-black"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          All ({(accountProfile?.transactions || []).length})
                        </button>
                      </div>

                      {/* TAB CONTENT */}
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/40">
                        {isLoadingProfile ? (
                          <div className="py-8 text-center text-xs text-slate-400">
                            Loading profile details...
                          </div>
                        ) : accountPanelTab === "counterparties" ? (
                          <div className="space-y-2">
                            {/* Beneficiaries (Money Transferred To) */}
                            <div>
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-800 block mb-1">
                                Beneficiaries Received Funds ({accountProfile?.beneficiaries?.length || 0})
                              </span>
                              {accountProfile?.beneficiaries?.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">No outgoing transfers</p>
                              ) : (
                                accountProfile?.beneficiaries?.map((b) => (
                                  <div
                                    key={b.account}
                                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs mb-1 flex items-center justify-between"
                                  >
                                    <div className="min-w-0 flex-1 pr-1">
                                      <div className="font-mono font-bold text-slate-900 truncate" title={b.account}>
                                        {b.account}
                                      </div>
                                      <div className="text-[10px] text-slate-500 truncate" title={b.bank}>
                                        {b.bank || "Beneficiary Bank"}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="font-black text-emerald-700 text-xs">
                                        ₹{formatFinancialValue(b.amount)}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleInspectAccount(b.account)}
                                        className="text-[9px] font-bold text-purple-700 hover:text-purple-900 underline mt-0.5"
                                      >
                                        Inspect ➔
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Senders (Money Received From) */}
                            <div className="pt-2 border-t border-slate-200">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-800 block mb-1">
                                Senders Transferred In ({accountProfile?.senders?.length || 0})
                              </span>
                              {accountProfile?.senders?.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">No incoming transfers</p>
                              ) : (
                                accountProfile?.senders?.map((s) => (
                                  <div
                                    key={s.account}
                                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs mb-1 flex items-center justify-between"
                                  >
                                    <div className="min-w-0 flex-1 pr-1">
                                      <div className="font-mono font-bold text-slate-900 truncate" title={s.account}>
                                        {s.account}
                                      </div>
                                      <div className="text-[10px] text-slate-500 truncate" title={s.bank}>
                                        {s.bank || "Sender Bank"}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="font-black text-blue-700 text-xs">
                                        ₹{formatFinancialValue(s.amount)}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleInspectAccount(s.account)}
                                        className="text-[9px] font-bold text-blue-700 hover:text-blue-900 underline mt-0.5"
                                      >
                                        Inspect ➔
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ) : accountPanelTab === "withdrawals" ? (
                          <div className="space-y-1.5">
                            {accountProfile?.withdrawals?.length === 0 ? (
                              <p className="text-center py-6 text-xs text-slate-400">
                                No cash or POS withdrawals recorded for this account in Layer {selectedLayer}.
                              </p>
                            ) : (
                              accountProfile?.withdrawals?.map((w, idx) => (
                                <div
                                  key={w.id || idx}
                                  className="rounded-lg border border-orange-200 bg-orange-50/40 p-2 text-xs shadow-2xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-orange-900">
                                      {w.sheet_name}
                                    </span>
                                    <span className="font-black text-emerald-800">
                                      ₹{formatIndianCurrency(w.amount)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600">
                                    {w.atm_id && <div>ATM ID: <span className="font-mono font-bold">{w.atm_id}</span> ({w.location})</div>}
                                    {w.merchant && <div>Merchant: <span className="font-bold">{w.merchant}</span> (MID: {w.mid})</div>}
                                    {w.cheque_no && <div>Cheque No: <span className="font-mono font-bold">{w.cheque_no}</span> ({w.branch})</div>}
                                    {w.date && <div className="text-slate-400 text-[9px]">{w.date.split("T")[0]}</div>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ) : accountPanelTab === "holds" ? (
                          <div className="space-y-1.5">
                            {accountProfile?.holds?.length === 0 ? (
                              <p className="text-center py-6 text-xs text-slate-400">
                                No hold actions recorded for this account in Layer {selectedLayer}.
                              </p>
                            ) : (
                              accountProfile?.holds?.map((h, idx) => (
                                <div
                                  key={h.id || idx}
                                  className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-2 text-xs shadow-2xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-cyan-900">Put on Hold</span>
                                    <span className="font-black text-cyan-950">
                                      ₹{formatIndianCurrency(h.amount)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600">
                                    {h.bank && <div>Bank: {h.bank}</div>}
                                    {h.date && <div>Date: {h.date}</div>}
                                    {h.remarks && <div className="italic text-slate-500">"{h.remarks}"</div>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          /* ALL RECORDS TAB */
                          <div className="space-y-1.5">
                            {accountProfile?.transactions?.length === 0 ? (
                              <p className="text-center py-6 text-xs text-slate-400">
                                No records found.
                              </p>
                            ) : (
                              accountProfile?.transactions?.map((t, idx) => (
                                <div
                                  key={t.id || idx}
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-700">
                                      {t.sheet_name}
                                    </span>
                                    <span className="font-black text-emerald-800">
                                      ₹{formatIndianCurrency(t.transaction_amount)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{t.transaction_date ? t.transaction_date.split("T")[0] : "-"}</span>
                                    {t.transaction_id_utr && (
                                      <span className="font-mono truncate max-w-[120px]" title={t.transaction_id_utr}>
                                        {t.transaction_id_utr}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* CASE D: NOTHING SELECTED - LAYER MULTI-WORKSHEET OVERVIEW */
                    <div className="flex flex-col h-full overflow-hidden space-y-3">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            Layer Overview
                          </span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Layer {selectedLayer}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Investigation Focus
                        </span>
                      </div>

                      {/* Overview Header */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                        <h4 className="font-extrabold text-xs text-slate-900">
                          Layer {selectedLayer} Financial Overview
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Consolidated breakdown across all uploaded worksheets in this layer.
                        </p>
                      </div>

                      {/* Layer KPIs */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Transfers Volume
                          </span>
                          <span
                            className="font-black text-xs text-emerald-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(layerActivity?.kpis?.transfer_amount ?? layerTotalAmount)}`}
                          >
                            ₹{formatFinancialValue(layerActivity?.kpis?.transfer_amount ?? layerTotalAmount)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-orange-700 block">
                            Withdrawals
                          </span>
                          <span
                            className="font-black text-xs text-orange-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(layerActivity?.kpis?.withdrawal_amount ?? 0)}`}
                          >
                            ₹{formatFinancialValue(layerActivity?.kpis?.withdrawal_amount ?? 0)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 block">
                            On Hold Amount
                          </span>
                          <span
                            className="font-black text-xs text-cyan-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(layerActivity?.kpis?.hold_amount ?? 0)}`}
                          >
                            ₹{formatFinancialValue(layerActivity?.kpis?.hold_amount ?? 0)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 block">
                            Disputed Amount
                          </span>
                          <span
                            className="font-black text-xs text-amber-950 mt-0.5 block truncate"
                            title={`₹${formatIndianCurrency(layerActivity?.kpis?.disputed_amount ?? layerTotalDisputed)}`}
                          >
                            ₹{formatFinancialValue(layerActivity?.kpis?.disputed_amount ?? layerTotalDisputed)}
                          </span>
                        </div>
                      </div>

                      {/* Worksheets list */}
                      <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Worksheets Active in Layer {selectedLayer}
                        </h5>
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/40">
                          {layerActivity?.categories?.map((c) => (
                            <div
                              key={c.sheet_name}
                              onClick={() => setSelectedCategory(c.category)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition flex items-center justify-between"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="font-bold text-slate-800 truncate">{c.sheet_name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {c.record_count} {c.record_count === 1 ? "record" : "records"} • {c.unique_accounts} accounts
                                </div>
                              </div>
                              <div className="font-black text-emerald-800 text-xs">
                                ₹{formatFinancialValue(c.relevant_amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Guidance note */}
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5 text-center text-[10px] text-slate-500">
                        Click any sender in the left panel, an account node in the center graph, or any table row below to inspect its 360° profile and trace fund dissipation to next layers.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ============================================================
              5. LAYER ACTIVITY BREAKDOWN & WORKSHEET CATEGORY FILTER
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Layer {selectedLayer} Activity Breakdown by Worksheet Category
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    (Click any category to filter transaction details table)
                  </span>
                </div>
                {selectedCategory !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("ALL")}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 transition self-start sm:self-center"
                  >
                    Reset Filter to All Activities
                  </button>
                )}
              </div>

              {/* CATEGORY PILLS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                    selectedCategory === "ALL"
                      ? "bg-[#172554] text-white ring-2 ring-[#172554]/30"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/70 border border-slate-200"
                  }`}
                >
                  <span>All Activities</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    selectedCategory === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
                  }`}>
                    {layerActivity?.total_records || tableTotal}
                  </span>
                </button>

                {layerActivity?.categories?.map((cat) => {
                  const isCatSelected = selectedCategory === cat.category || selectedCategory === cat.sheet_name;
                  let badgeColor = "border-slate-200 bg-slate-50 text-slate-700";
                  if (cat.category === "Money Transfer") badgeColor = isCatSelected ? "bg-emerald-700 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
                  else if (cat.category.includes("ATM")) badgeColor = isCatSelected ? "bg-blue-700 text-white" : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100";
                  else if (cat.category.includes("POS")) badgeColor = isCatSelected ? "bg-indigo-700 text-white" : "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100";
                  else if (cat.category.includes("Cheque")) badgeColor = isCatSelected ? "bg-orange-700 text-white" : "border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100";
                  else if (cat.category.includes("hold")) badgeColor = isCatSelected ? "bg-cyan-700 text-white" : "border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100";
                  else badgeColor = isCatSelected ? "bg-slate-700 text-white" : "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200";

                  return (
                    <button
                      key={cat.sheet_name}
                      type="button"
                      onClick={() => setSelectedCategory(isCatSelected ? "ALL" : cat.category)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs ${badgeColor} ${
                        isCatSelected ? "ring-2 ring-emerald-500/40" : ""
                      }`}
                    >
                      <span>{cat.sheet_name}</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isCatSelected ? "bg-white/20 text-white" : "bg-black/5 text-slate-800 font-extrabold"
                      }`}>
                        {cat.record_count}
                      </span>
                      <span className="text-[10px] font-mono opacity-80">
                        ₹{formatFinancialValue(cat.relevant_amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ============================================================
              6. TRANSACTION DETAILS TABLE FOR SELECTED LAYER
          ============================================================ */}
          {activeFile && String(activeFile.status).toUpperCase() === "COMPLETED" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Layer {selectedLayer} Transaction Details
                  </h3>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {displayedTableTransactions.length} of {tableTotal} records
                  </span>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  <button
                    type="button"
                    onClick={handleExportFilteredToExcel}
                    disabled={isExportingExcel || tableTotal === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs disabled:opacity-50"
                    title="Export currently filtered layer records to Excel spreadsheet"
                  >
                    {isExportingExcel ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export Layer Excel (.xlsx)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* TABLE FILTER CONTROLS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div>
                  <label htmlFor="tbl-search" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Search Account or UTR
                  </label>
                  <input
                    id="tbl-search"
                    type="text"
                    placeholder="Search in Layer..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Bank */}
                <div>
                  <label htmlFor="tbl-bank" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Bank / FI
                  </label>
                  <select
                    id="tbl-bank"
                    value={tableBank}
                    onChange={(e) => setTableBank(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Banks ({availableBanks.length})</option>
                    {availableBanks.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor="tbl-date-from" className="block text-[11px] font-bold text-slate-600 mb-1">
                      From Date
                    </label>
                    <input
                      id="tbl-date-from"
                      type="date"
                      value={tableDateFrom}
                      onChange={(e) => setTableDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="tbl-date-to" className="block text-[11px] font-bold text-slate-600 mb-1">
                      To Date
                    </label>
                    <input
                      id="tbl-date-to"
                      type="date"
                      value={tableDateTo}
                      onChange={(e) => setTableDateTo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Min / Max Amount */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor="tbl-min-amt" className="block text-[11px] font-bold text-slate-600 mb-1">
                      Min Amt (₹)
                    </label>
                    <input
                      id="tbl-min-amt"
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={tableMinAmount}
                      onChange={(e) => setTableMinAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="tbl-max-amt" className="block text-[11px] font-bold text-slate-600 mb-1">
                      Max Amt (₹)
                    </label>
                    <input
                      id="tbl-max-amt"
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={tableMaxAmount}
                      onChange={(e) => setTableMaxAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* TRANSACTIONS TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                    <tr>
                      <th className="px-3 py-3 text-center">#</th>
                      <th className="px-3 py-3">Worksheet</th>
                      <th className="px-3 py-3">Ack No</th>
                      <th className="px-3 py-3">Sender / Source</th>
                      <th className="px-3 py-3">Receiver / Destination</th>
                      <th className="px-3 py-3">Bank / FI</th>
                      <th className="px-3 py-3 text-center">Layer</th>
                      <th className="px-3 py-3">Transaction ID / UTR</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3 text-right">Amount (₹)</th>
                      <th className="px-3 py-3 text-right">Disputed (₹)</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
                    {isLoadingTable ? (
                      <tr>
                        <td colSpan="12" className="py-12 text-center text-xs text-slate-500">
                          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-2" />
                          <p>Loading Layer {selectedLayer} transactions...</p>
                        </td>
                      </tr>
                    ) : displayedTableTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="py-10 text-center text-xs text-slate-400">
                          No transactions found for Layer {selectedLayer} with the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      displayedTableTransactions.map((tx, idx) => {
                        const isExpanded = expandedRowId === tx.id;
                        const raw = tx.raw_data || {};
                        const destAcc = raw["Account No"] || raw["account_no"] || "-";
                        const srcBank =
                          raw["Action Taken By bank"] ||
                          raw["action_taken_by_bank"] ||
                          tx.bank_name ||
                          "-";
                        const rawKeys = Object.keys(raw);
                        const primaryAcc = (destAcc && destAcc !== "-") ? destAcc : tx.account_or_wallet_id;

                        return (
                          <React.Fragment key={tx.id}>
                            <tr className={`transition-colors hover:bg-slate-50 ${isExpanded ? "bg-purple-50/20" : ""}`}>
                              <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                                {(tablePage - 1) * tablePageSize + idx + 1}
                              </td>

                              <td className="px-3 py-2.5">
                                <span className="inline-block max-w-[130px] truncate rounded bg-purple-50 border border-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                                  {tx.sheet_name}
                                </span>
                              </td>

                              <td className="px-3 py-2.5 font-mono text-[11px] text-[#172554] select-all">
                                {tx.acknowledgement_no || "-"}
                              </td>

                              <td className="px-3 py-2.5 max-w-[160px]">
                                {tx.account_or_wallet_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleInspectAccount(tx.account_or_wallet_id)}
                                    className="font-mono text-[11px] font-bold text-blue-900 hover:text-blue-700 hover:underline truncate block text-left"
                                    title={`Click to inspect ${tx.account_or_wallet_id}`}
                                  >
                                    {tx.account_or_wallet_id}
                                  </button>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                                <div className="text-[10px] text-slate-400 truncate" title={srcBank}>
                                  {srcBank}
                                </div>
                              </td>

                              <td className="px-3 py-2.5 max-w-[160px]">
                                {destAcc && destAcc !== "-" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleInspectAccount(destAcc)}
                                    className="font-mono text-[11px] font-bold text-indigo-900 hover:text-indigo-700 hover:underline truncate block text-left"
                                    title={`Click to inspect ${destAcc}`}
                                  >
                                    {destAcc}
                                  </button>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                                <div className="text-[10px] text-slate-400 truncate" title={tx.bank_name}>
                                  {tx.bank_name || "-"}
                                </div>
                              </td>

                              <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate" title={tx.bank_name}>
                                {tx.bank_name || "-"}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
                                  {tx.layer ? `L${tx.layer}` : `L${selectedLayer}`}
                                </span>
                              </td>

                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 select-all max-w-[140px] truncate" title={tx.transaction_id_utr}>
                                {tx.transaction_id_utr || "-"}
                              </td>

                              <td className="px-3 py-2.5 text-slate-600 text-[11px] whitespace-nowrap">
                                {tx.transaction_date ? tx.transaction_date.split("T")[0] : "-"}
                              </td>

                              <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700 text-[11px] whitespace-nowrap">
                                {tx.transaction_amount !== null ? `₹${formatIndianCurrency(tx.transaction_amount)}` : "-"}
                              </td>

                              <td className="px-3 py-2.5 text-right font-bold text-amber-700 text-[11px] whitespace-nowrap">
                                {tx.disputed_amount !== null ? `₹${formatIndianCurrency(tx.disputed_amount)}` : "-"}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {primaryAcc && primaryAcc !== "-" && (
                                    <button
                                      type="button"
                                      onClick={() => handleInspectAccount(primaryAcc)}
                                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 transition"
                                      title="Inspect 360° Account Profile"
                                    >
                                      Profile
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRowId(isExpanded ? null : tx.id)}
                                    className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 transition"
                                  >
                                    {isExpanded ? "Hide" : "Raw"}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* EXPANDED ROW RAW DATA & ACTIVITY HIGHLIGHTS */}
                            {isExpanded && (
                              <tr className="bg-purple-50/20">
                                <td colSpan="12" className="p-3 border-t border-purple-100 space-y-2">
                                  {/* Activity-Specific Detail Banner */}
                                  {(raw["ATM ID"] || raw["Merchant Name"] || raw["Cheque No"] || raw["Put on Hold Amount"] || raw["Put on hold Amount"]) && (
                                    <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-200 text-xs">
                                      {raw["ATM ID"] && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-blue-800">ATM ID:</span>
                                          <span className="font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">{raw["ATM ID"]}</span>
                                          {raw["Place/Location of ATM"] && (
                                            <span className="text-slate-600">({raw["Place/Location of ATM"]})</span>
                                          )}
                                        </div>
                                      )}
                                      {raw["Merchant Name"] && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-indigo-800">Merchant:</span>
                                          <span className="font-bold bg-indigo-50 px-1.5 py-0.5 rounded">{raw["Merchant Name"]}</span>
                                          {(raw["MID"] || raw["TID"]) && (
                                            <span className="text-slate-500 font-mono text-[10px]">(MID: {raw["MID"] || raw["TID"]})</span>
                                          )}
                                        </div>
                                      )}
                                      {raw["Cheque No"] && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-orange-800">Cheque No:</span>
                                          <span className="font-mono font-bold bg-orange-50 px-1.5 py-0.5 rounded">{raw["Cheque No"]}</span>
                                          {raw["Branch Location"] && (
                                            <span className="text-slate-600">({raw["Branch Location"]})</span>
                                          )}
                                        </div>
                                      )}
                                      {(raw["Put on Hold Amount"] || raw["Put on hold Amount"]) && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-cyan-800">Put on Hold Amount:</span>
                                          <span className="font-black text-cyan-950 bg-cyan-50 px-1.5 py-0.5 rounded">
                                            ₹{formatIndianCurrency(raw["Put on Hold Amount"] || raw["Put on hold Amount"])}
                                          </span>
                                          {(raw["Date of Action"] || raw["Put on hold Date"]) && (
                                            <span className="text-slate-500 text-[10px]">({raw["Date of Action"] || raw["Put on hold Date"]})</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Full Raw Data Grid */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-3 rounded-xl border border-purple-100">
                                    {rawKeys.map((k) => (
                                      <div key={k} className="p-1 rounded bg-slate-50">
                                        <span className="font-bold text-slate-500 text-[10px] block truncate">{k}:</span>
                                        <span className="font-mono text-slate-800 break-all">{String(raw[k] ?? "-")}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE PAGINATION */}
              {tableTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Show</span>
                    <select
                      value={tablePageSize}
                      onChange={(e) => {
                        setTablePageSize(Number(e.target.value));
                        setTablePage(1);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span>per page • Total {tableTotal} records</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold px-2 text-slate-700">
                      Page {tablePage} of {Math.max(1, Math.ceil(tableTotal / tablePageSize))}
                    </span>
                    <button
                      type="button"
                      disabled={tablePage >= Math.ceil(tableTotal / tablePageSize)}
                      onClick={() => setTablePage((p) => p + 1)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* EMPTY OR INITIAL STATE PROMPT */}
          {!selectedCaseId && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-sm font-bold text-slate-800">No Case Selected</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Please select an active investigation case above to begin analyzing its NCRP money flow graph.
              </p>
            </div>
          )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
