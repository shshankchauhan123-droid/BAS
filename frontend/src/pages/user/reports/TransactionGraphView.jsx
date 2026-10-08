import React, { useEffect, useMemo, useState } from "react";

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

import { formatFinancialValue } from "../../../utils/chartFormatter";

function formatCompact(num) {
  return formatFinancialValue(num);
}
function extractCounterparty(narration) {
  if (!narration) return "General Transfer";
  const str = String(narration).trim();
  if (str.includes("UPI/")) {
    const parts = str.split("/");
    if (parts.length >= 3 && parts[2]) return parts[2].trim().slice(0, 32);
    if (parts.length >= 2 && parts[1]) return parts[1].trim().slice(0, 32);
  }
  if (str.includes("IMPS/") || str.includes("NEFT-") || str.includes("RTGS-")) {
    const parts = str.split(/[-/]/);
    if (parts.length >= 3 && parts[2]) return parts[2].trim().slice(0, 32);
  }
  const firstChunk = str.split(/\s{2,}|\n|\//)[0]?.trim().slice(0, 32);
  return firstChunk || "Direct Transfer";
}

export const FILE_PALETTE = [
  { badge: "border-cyan-500/30 bg-cyan-950/40 text-cyan-300", dot: "bg-cyan-400", hex: "#06b6d4" },
  { badge: "border-purple-500/30 bg-purple-950/40 text-purple-300", dot: "bg-purple-400", hex: "#a855f7" },
  { badge: "border-amber-500/30 bg-amber-950/40 text-amber-300", dot: "bg-amber-400", hex: "#f59e0b" },
  { badge: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300", dot: "bg-emerald-400", hex: "#10b981" },
  { badge: "border-pink-500/30 bg-pink-950/40 text-pink-300", dot: "bg-pink-400", hex: "#ec4899" },
  { badge: "border-blue-500/30 bg-blue-950/40 text-blue-300", dot: "bg-blue-400", hex: "#3b82f6" },
  { badge: "border-indigo-500/30 bg-indigo-950/40 text-indigo-300", dot: "bg-indigo-400", hex: "#6366f1" },
  { badge: "border-orange-500/30 bg-orange-950/40 text-orange-300", dot: "bg-orange-400", hex: "#f97316" },
];

export function getFileColor(fileId) {
  const num = Number(fileId) || 0;
  return FILE_PALETTE[Math.abs(num) % FILE_PALETTE.length];
}

function getMetricValue(item, metricType) {
  if (!item) return 0;
  if (metricType === "credit") return item.credit;
  if (metricType === "debit") return item.debit;
  if (metricType === "net") return item.net;
  if (metricType === "balance") return item.balance || 0;
  if (metricType === "count") return item.count;
  if (metricType === "avg_debit") return item.avgDebit || 0;
  if (metricType === "avg_credit") return item.avgCredit || 0;
  if (metricType === "max_debit") return item.maxDebit || 0;
  if (metricType === "max_credit") return item.maxCredit || 0;
  return item.credit + item.debit; // 'both' total volume
}

export default function TransactionGraphView({
  transactions = [],
  summary = null,
  totalCount = null,
  formatDate = (d) => d,
  files = [],
  selectedFileIds = [],
}) {
  // ------------------------------------------------------------
  // Dynamic Schema & Column Discovery from actual transaction data
  // ------------------------------------------------------------
  const dynamicFieldOptions = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { xOptions: [], yOptions: [] };
    }

    const sample = transactions.slice(0, 150);
    const discoveredKeys = new Set();
    sample.forEach((tx) => {
      if (tx && typeof tx === "object") {
        Object.keys(tx).forEach((k) => {
          if (tx[k] !== null && tx[k] !== undefined && String(tx[k]).trim() !== "") {
            discoveredKeys.add(k);
          }
        });
      }
    });

    // 1. Dynamic X-Axis Dimensions:
    const xList = [];

    // Date dimensions
    if (discoveredKeys.has("transaction_date") || discoveredKeys.has("date")) {
      xList.push(
        { id: "date_auto", label: "Date (⚡ Smart Dynamic: Auto Year / Month / Day)", group: "Time Dimensions", icon: "⚡", axisName: "Timeline" },
        { id: "date_year", label: "Date (Year-by-Year: 2008, 2009...)", group: "Time Dimensions", icon: "📆", axisName: "Years" },
        { id: "date_quarter", label: "Date (Quarterly Periods: Q1, Q2...)", group: "Time Dimensions", icon: "📊", axisName: "Quarters" },
        { id: "date_month", label: "Date (Monthly Timeline: Jan, Feb...)", group: "Time Dimensions", icon: "📅", axisName: "Months" },
        { id: "date_week", label: "Date (Weekly 7-Day Slices)", group: "Time Dimensions", icon: "📅", axisName: "Weekly Periods" },
        { id: "date_exact", label: "Date (Exact Daily Dates)", group: "Time Dimensions", icon: "🗓️", axisName: "Transaction Dates" },
        { id: "date_weekday", label: "Date (Day of Week: Mon - Sun)", group: "Time Dimensions", icon: "🗓️", axisName: "Days of Week" }
      );
    }

    // Payment Mode / Channel
    if (discoveredKeys.has("mode")) {
      xList.push({
        id: "mode",
        label: "Payment Mode / Channel (UPI, NEFT, CASH, CHEQUE...)",
        group: "Banking Data",
        icon: "💳",
        axisName: "Transaction Modes & Channels",
      });
    }

    // Account Name / Counterparty
    if (discoveredKeys.has("account_name")) {
      xList.push({
        id: "account_name",
        label: "Account Name / Counterparty (Beneficiaries)",
        group: "Banking Data",
        icon: "👤",
        axisName: "Beneficiaries & Account Names",
      });
    }

    // Account Number
    if (discoveredKeys.has("account_number")) {
      xList.push({
        id: "account_number",
        label: "Account Number (Bank A/C)",
        group: "Banking Data",
        icon: "🏦",
        axisName: "Account Numbers",
      });
    }

    // Narration / Description
    if (discoveredKeys.has("description") || discoveredKeys.has("raw_narration")) {
      xList.push({
        id: "description",
        label: "Narration / Description (Entity Group)",
        group: "Banking Data",
        icon: "📝",
        axisName: "Narration / Parties",
      });
    }

    // Cheque / Reference Number
    if (discoveredKeys.has("cheque_number") || discoveredKeys.has("ref_no")) {
      xList.push({
        id: "cheque_number",
        label: "Cheque / Reference Number",
        group: "Banking Data",
        icon: "🏷️",
        axisName: "Cheque / Reference Numbers",
      });
    }

    // Statement File
    if (discoveredKeys.has("file_id") || files.length > 1) {
      xList.push({
        id: "file_id",
        label: "Statement File (Compare Uploaded Files)",
        group: "Files & Sources",
        icon: "📁",
        axisName: "Statement Files",
      });
    }

    // Category / Tag
    if (discoveredKeys.has("category")) {
      xList.push({
        id: "category",
        label: "Category / Expense Head",
        group: "Categorization",
        icon: "🏷️",
        axisName: "Categories",
      });
    }

    // Extra dynamic columns in file
    const standardKeys = new Set([
      "id", "file_id", "transaction_date", "date", "mode", "account_name",
      "account_number", "description", "raw_narration", "cheque_number",
      "ref_no", "category", "debit", "credit", "balance", "created_at",
      "updated_at", "type", "sub_category", "hash", "row_index"
    ]);

    discoveredKeys.forEach((key) => {
      if (!standardKeys.has(key)) {
        const prettyLabel = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        xList.push({
          id: key,
          label: `${prettyLabel} (File Column: ${key})`,
          group: "Other File Columns",
          icon: "🔹",
          axisName: prettyLabel,
        });
      }
    });

    // 2. Dynamic Y-Axis Metrics:
    const yList = [
      {
        id: "both",
        label: "Both Inflow & Outflow (Cr & Dr Stacked in ₹)",
        group: "Standard Flows",
        icon: "🟢🔴",
        axisName: "Debit & Credit Amount in Indian Rupees (₹)",
      },
      {
        id: "debit",
        label: "Total Debits (Outflow ₹ Sum)",
        group: "Standard Flows",
        icon: "🔴",
        axisName: "Debit Outflow (₹)",
      },
      {
        id: "credit",
        label: "Total Credits (Inflow ₹ Sum)",
        group: "Standard Flows",
        icon: "🟢",
        axisName: "Credit Inflow (₹)",
      },
      {
        id: "net",
        label: "Net Cash Flow (Credits minus Debits in ₹)",
        group: "Financial Balance",
        icon: "⚖️",
        axisName: "Net Flow (₹)",
      },
      {
        id: "balance",
        label: "Account Balance (Closing / Average in ₹)",
        group: "Financial Balance",
        icon: "📈",
        axisName: "Account Balance (₹)",
      },
      {
        id: "count",
        label: "Transaction Count (Number of Transactions)",
        group: "Volume & Frequency",
        icon: "🔢",
        axisName: "Number of Transactions",
      },
      {
        id: "avg_debit",
        label: "Average Debit Value (Mean Outflow ₹)",
        group: "Averages & Peaks",
        icon: "🔴",
        axisName: "Average Debit (₹)",
      },
      {
        id: "avg_credit",
        label: "Average Credit Value (Mean Inflow ₹)",
        group: "Averages & Peaks",
        icon: "🟢",
        axisName: "Average Credit (₹)",
      },
      {
        id: "max_debit",
        label: "Peak Debit (Highest Single Outflow ₹)",
        group: "Averages & Peaks",
        icon: "🔴",
        axisName: "Peak Outflow (₹)",
      },
      {
        id: "max_credit",
        label: "Peak Credit (Highest Single Inflow ₹)",
        group: "Averages & Peaks",
        icon: "🟢",
        axisName: "Peak Inflow (₹)",
      },
    ];

    return { xOptions: xList, yOptions: yList };
  }, [transactions, files]);

  // Controls State
  const [groupBy, setGroupBy] = useState("date_auto");
  const [dateGranularity, setDateGranularity] = useState("auto"); // "auto", "date_year", "date_quarter", "date_month", "date_exact"
  const [drillDown, setDrillDown] = useState(null); // { level: "year" | "month", year: number, month?: number, label: string }
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [metric, setMetric] = useState("both");
  const [chartType, setChartType] = useState("combo"); // "combo" (Bar + Line together!)
  const [scaleMode, setScaleMode] = useState("balanced"); // "balanced" (sqrt distribution) vs "linear" (1:1 strict)

  const isDateGrouping = groupBy === "date_auto" || groupBy.startsWith("date_");

  // Ensure default groupBy exists in discovered options
  useEffect(() => {
    if (dynamicFieldOptions.xOptions.length > 0) {
      const exists = dynamicFieldOptions.xOptions.some((o) => o.id === groupBy);
      if (!exists) {
        setGroupBy(dynamicFieldOptions.xOptions[0].id);
      }
    }
  }, [dynamicFieldOptions.xOptions, groupBy]);

  // Multi-Statement Interactive Filter (default = all selected files active)
  const [activeFileFilter, setActiveFileFilter] = useState(() => new Set((selectedFileIds || []).map(String)));

  useEffect(() => {
    setActiveFileFilter(new Set((selectedFileIds || []).map(String)));
  }, [selectedFileIds]);

  const [hoveredItem, setHoveredItem] = useState(null);

  // Compute overall date span of the statement data to guide automatic smart-scaling
  const dateSpanInfo = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    let validDateCount = 0;
    const uniqueMonths = new Set();
    const uniqueYears = new Set();

    (transactions || []).forEach((tx) => {
      const raw = tx.transaction_date || tx.date || "";
      if (raw) {
        const dObj = new Date(raw);
        const t = dObj.getTime();
        if (!isNaN(t)) {
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
          validDateCount++;
          uniqueYears.add(dObj.getFullYear());
          uniqueMonths.add(`${dObj.getFullYear()}-${dObj.getMonth()}`);
        }
      }
    });

    const spanDays = validDateCount > 0 ? Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)) + 1 : 0;
    const spanYears = uniqueYears.size;
    const spanMonths = uniqueMonths.size;

    return {
      validDateCount,
      spanDays,
      spanYears,
      spanMonths,
      minDateStr: minTime !== Infinity ? new Date(minTime).toISOString().slice(0, 10) : "",
      maxDateStr: maxTime !== -Infinity ? new Date(maxTime).toISOString().slice(0, 10) : "",
    };
  }, [transactions]);

  // Filtered transactions based on active statement files, custom date range, and active drill-down
  const filteredTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    return transactions.filter((tx) => {
      // 1. File Filter
      if (selectedFileIds.length > 1 && activeFileFilter.size > 0) {
        if (!activeFileFilter.has(String(tx.file_id))) return false;
      }

      // 2. Custom Date Range Filter
      const rawDate = tx.transaction_date || tx.date || "";
      const dStr = rawDate.length >= 10 ? rawDate.slice(0, 10) : rawDate.split("T")[0];
      if (startDateFilter && dStr && dStr < startDateFilter) return false;
      if (endDateFilter && dStr && dStr > endDateFilter) return false;

      // 3. Interactive Drill-Down Filter
      if (drillDown && rawDate) {
        const dObj = new Date(rawDate);
        if (!isNaN(dObj.getTime())) {
          if (drillDown.level === "year") {
            if (dObj.getFullYear() !== drillDown.year) return false;
          } else if (drillDown.level === "month") {
            if (dObj.getFullYear() !== drillDown.year || (dObj.getMonth() + 1) !== drillDown.month) return false;
          }
        }
      }

      return true;
    });
  }, [transactions, selectedFileIds, activeFileFilter, startDateFilter, endDateFilter, drillDown]);

  // Dynamically resolve the optimal grouping granularity based on dataset span
  const effectiveGroupBy = useMemo(() => {
    if (!isDateGrouping) return groupBy;

    // 1. If user drilled down:
    if (drillDown) {
      if (drillDown.level === "year") return "date_month";
      if (drillDown.level === "month") return "date_exact";
    }

    // 2. If user specifically selected a fixed step pill:
    if (dateGranularity !== "auto") {
      return dateGranularity;
    }

    // 3. If groupBy was manually picked in dropdown (and not date_auto):
    // If date_month has too many points, auto-manage to larger range as requested
    if (groupBy !== "date_auto") {
      if (groupBy === "date_month" && (dateSpanInfo.spanYears > 2 || dateSpanInfo.spanMonths > 24)) {
        return "date_year";
      }
      if (groupBy === "date_exact" && dateSpanInfo.spanDays > 45) {
        return dateSpanInfo.spanMonths > 24 ? "date_year" : "date_month";
      }
      return groupBy;
    }

    // 4. Default Smart Dynamic Auto-Scale (when groupBy === "date_auto"):
    if (dateSpanInfo.spanYears > 2 || dateSpanInfo.spanMonths > 24) {
      return "date_year"; // Auto-manage into Year-by-Year (bdi range)
    }
    if (dateSpanInfo.spanMonths > 12 || dateSpanInfo.spanYears > 1) {
      return "date_quarter";
    }
    if (dateSpanInfo.spanMonths > 2 || dateSpanInfo.spanDays > 60) {
      return "date_month";
    }
    if (dateSpanInfo.spanDays > 14) {
      return "date_week";
    }
    return "date_exact";
  }, [isDateGrouping, groupBy, drillDown, dateGranularity, dateSpanInfo]);

  const currentXOption = useMemo(() => {
    if (!isDateGrouping) {
      return (
        dynamicFieldOptions.xOptions.find((o) => o.id === groupBy) ||
        dynamicFieldOptions.xOptions[0] || {
          id: groupBy,
          label: "Custom Dimension",
          axisName: "Dimension",
          icon: "📊",
        }
      );
    }

    let effLabel = "Date Timeline";
    let effAxis = "Timeline";
    if (drillDown) {
      if (drillDown.level === "year") {
        effLabel = `Date: Monthly Breakdown for ${drillDown.year}`;
        effAxis = `Months of ${drillDown.year}`;
      } else if (drillDown.level === "month") {
        effLabel = `Date: Daily Breakdown for ${drillDown.label}`;
        effAxis = `Days of ${drillDown.label}`;
      }
    } else {
      if (effectiveGroupBy === "date_year") {
        effLabel = `Date: Yearly Timeline (${dateSpanInfo.spanYears} Years)`;
        effAxis = "Years";
      } else if (effectiveGroupBy === "date_quarter") {
        effLabel = "Date: Quarterly Timeline";
        effAxis = "Quarters";
      } else if (effectiveGroupBy === "date_month") {
        effLabel = "Date: Monthly Timeline";
        effAxis = "Months";
      } else if (effectiveGroupBy === "date_week") {
        effLabel = "Date: Weekly Timeline";
        effAxis = "Weeks";
      } else if (effectiveGroupBy === "date_exact") {
        effLabel = "Date: Daily Timeline";
        effAxis = "Dates";
      }
    }

    return {
      id: groupBy,
      label: effLabel,
      axisName: effAxis,
      icon: "📅",
    };
  }, [isDateGrouping, groupBy, effectiveGroupBy, drillDown, dateSpanInfo, dynamicFieldOptions.xOptions]);

  const currentYOption =
    dynamicFieldOptions.yOptions.find((o) => o.id === metric) ||
    dynamicFieldOptions.yOptions[0] || {
      id: metric,
      label: "Custom Metric",
      axisName: "Metric Value",
      icon: "📈",
    };

  // Real-time financial metrics for the active graph view scope
  const graphFinancialMetrics = useMemo(() => {
    let dr = 0;
    let cr = 0;
    filteredTransactions.forEach((tx) => {
      dr += Number(tx.debit) || 0;
      cr += Number(tx.credit) || 0;
    });
    return {
      totalDebits: dr,
      totalCredits: cr,
      net: cr - dr,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Handle drill-down clicks on bars
  const handleBarClick = (item) => {
    if (!isDateGrouping) return;

    if (effectiveGroupBy === "date_year") {
      const yr = parseInt(item.key, 10);
      if (!isNaN(yr)) {
        setDrillDown({
          level: "year",
          year: yr,
          label: `Year ${yr}`,
        });
      }
    } else if (effectiveGroupBy === "date_month") {
      const parts = String(item.key).split("-");
      if (parts.length === 2) {
        const yr = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(yr) && !isNaN(m)) {
          setDrillDown({
            level: "month",
            year: yr,
            month: m,
            label: `${item.label}`,
          });
        }
      }
    }
  };

  // ------------------------------------------------------------
  // Dynamic Aggregation Engine across 100% of Filtered Transactions
  // ------------------------------------------------------------
  const chartData = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      return [];
    }

    let maxCr = 0;
    let maxDr = 0;

    // Fast O(1) file lookup map
    const fileMap = new Map();
    (files || []).forEach((f) => fileMap.set(String(f.id), f));

    const groups = new Map();

    filteredTransactions.forEach((tx) => {
      const cr = Number(tx.credit) || 0;
      const dr = Number(tx.debit) || 0;
      const bal = tx.balance !== null && tx.balance !== undefined ? Number(tx.balance) : null;
      const rawDate = tx.transaction_date || tx.date || "";
      const d = rawDate ? new Date(rawDate) : null;
      const isValidDate = d && !isNaN(d.getTime());

      if (cr > maxCr) maxCr = cr;
      if (dr > maxDr) maxDr = dr;

      let key = "Other";
      let label = "Other";
      let sortKey = 0;

      if (effectiveGroupBy === "date_year") {
        if (isValidDate) {
          const y = d.getFullYear();
          key = String(y);
          label = String(y);
          sortKey = y;
        } else {
          key = "Unknown Year";
          label = "Unknown Year";
          sortKey = 0;
        }
      } else if (effectiveGroupBy === "date_month") {
        if (isValidDate) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const monthName = d.toLocaleString("default", { month: "short" });
          key = `${y}-${String(m + 1).padStart(2, "0")}`;
          label = `${monthName} ${y}`;
          sortKey = y * 12 + m;
        } else {
          key = "Unknown Month";
          label = "Unknown Month";
          sortKey = 0;
        }
      } else if (effectiveGroupBy === "date_quarter") {
        if (isValidDate) {
          const y = d.getFullYear();
          const q = Math.floor(d.getMonth() / 3) + 1;
          key = `${y}-Q${q}`;
          label = `Q${q} ${y}`;
          sortKey = y * 4 + q;
        } else {
          key = "Unknown Quarter";
          label = "Unknown Quarter";
          sortKey = 0;
        }
      } else if (effectiveGroupBy === "date_week") {
        if (isValidDate) {
          const day = d.getDay();
          const diff = (day + 6) % 7;
          const monday = new Date(d);
          monday.setDate(d.getDate() - diff);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);

          const mStart = monday.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          const mEnd = sunday.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          key = monday.toISOString().slice(0, 10);
          label = `${mStart} - ${mEnd}`;
          sortKey = monday.getTime();
        } else {
          key = "Unknown Week";
          label = "Unknown Week";
          sortKey = 0;
        }
      } else if (effectiveGroupBy === "date_exact") {
        if (isValidDate) {
          key = rawDate.length >= 10 ? rawDate.slice(0, 10) : rawDate.split("T")[0];
          label = formatDate(key);
          sortKey = d.getTime();
        } else {
          key = "Unknown Date";
          label = "Unknown Date";
          sortKey = 0;
        }
      } else if (effectiveGroupBy === "date_weekday") {
        if (isValidDate) {
          const dayIdx = d.getDay();
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          key = String(dayIdx);
          label = days[dayIdx];
          sortKey = (dayIdx + 6) % 7;
        } else {
          key = "7";
          label = "Unknown Day";
          sortKey = 7;
        }
      } else if (effectiveGroupBy === "file_id") {
        const found = fileMap.get(String(tx.file_id));
        const fTitle = (found?.account_number ? String(found.account_number).trim() : null) || found?.original_filename || (tx.file_id ? `Statement #${tx.file_id}` : "Unassigned Statement");
        key = String(tx.file_id || "unassigned");
        label = fTitle;
        sortKey = fTitle;
      } else if (effectiveGroupBy === "mode") {
        const modeName = (tx.mode || "").trim().toUpperCase() || "TRANSFER / OTHER";
        key = modeName;
        label = modeName;
        sortKey = modeName;
      } else if (effectiveGroupBy === "account_name") {
        const ent = (tx.account_name || "").trim() || extractCounterparty(tx.description || tx.raw_narration) || "General Counterparty";
        key = ent;
        label = ent;
        sortKey = ent;
      } else if (effectiveGroupBy === "account_number") {
        const ac = String(tx.account_number || "").trim() || "No A/C Number";
        key = ac;
        label = ac;
        sortKey = ac;
      } else if (effectiveGroupBy === "description") {
        const ent = extractCounterparty(tx.description || tx.raw_narration) || (tx.description || "General Narration").slice(0, 32);
        key = ent;
        label = ent;
        sortKey = ent;
      } else if (effectiveGroupBy === "cheque_number") {
        const chk = String(tx.cheque_number || tx.ref_no || "").trim() || "No Cheque/Ref";
        key = chk;
        label = chk;
        sortKey = chk;
      } else if (effectiveGroupBy === "category") {
        const cat = String(tx.category || "").trim() || "General / Uncategorized";
        key = cat;
        label = cat;
        sortKey = cat;
      } else {
        // Any dynamic column from data
        const val = tx[effectiveGroupBy] !== null && tx[effectiveGroupBy] !== undefined && String(tx[effectiveGroupBy]).trim() !== ""
          ? String(tx[effectiveGroupBy]).trim()
          : "Unspecified";
        key = val;
        label = val;
        sortKey = val;
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          sortKey,
          credit: 0,
          debit: 0,
          count: 0,
          maxDebit: 0,
          maxCredit: 0,
          lastBalance: null,
          balances: [],
          fileBreakdown: {},
        });
      }

      const item = groups.get(key);
      item.credit += cr;
      item.debit += dr;
      item.count += 1;
      if (dr > item.maxDebit) item.maxDebit = dr;
      if (cr > item.maxCredit) item.maxCredit = cr;
      if (bal !== null) {
        item.lastBalance = bal;
        item.balances.push(bal);
      }

      // Track per-file breakdown
      const fid = String(tx.file_id || "unassigned");
      if (!item.fileBreakdown[fid]) {
        const fObj = fileMap.get(fid);
        item.fileBreakdown[fid] = {
          fileId: fid,
          fileName: (fObj?.account_number ? String(fObj.account_number).trim() : null) || fObj?.original_filename || (fid !== "unassigned" ? `Statement #${fid}` : "General"),
          credit: 0,
          debit: 0,
          count: 0,
        };
      }
      item.fileBreakdown[fid].credit += cr;
      item.fileBreakdown[fid].debit += dr;
      item.fileBreakdown[fid].count += 1;
    });

    let items = Array.from(groups.values()).map((item) => {
      const net = item.credit - item.debit;
      const avgBalance =
        item.balances.length > 0
          ? item.balances.reduce((a, b) => a + b, 0) / item.balances.length
          : null;
      const avgDebit = item.count > 0 ? item.debit / item.count : 0;
      const avgCredit = item.count > 0 ? item.credit / item.count : 0;
      const fileBreakdownList = Object.values(item.fileBreakdown).sort(
        (a, b) => (b.credit + b.debit) - (a.credit + a.debit)
      );
      return {
        ...item,
        net,
        balance: item.lastBalance !== null ? item.lastBalance : avgBalance,
        avgDebit,
        avgCredit,
        fileBreakdownList,
      };
    });

    // Always sort naturally / chronologically so full dataset is clear
    items.sort((a, b) => {
      if (typeof a.sortKey === "number" && typeof b.sortKey === "number") {
        return a.sortKey - b.sortKey;
      }
      return String(a.sortKey).localeCompare(String(b.sortKey));
    });

    return items;
  }, [filteredTransactions, effectiveGroupBy, metric, formatDate, files]);

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
          No transactions are currently available to chart. Please ensure statements are uploaded and selected.
        </p>
      </div>
    );
  }

  // Maximum value for scaling (for stacked bar chart, sum credit + debit for true combined height)
  const maxVal = Math.max(
    ...chartData.map((d) => {
      if (metric === "both") {
        return (chartType === "combo" || chartType === "bar") ? d.credit + d.debit : Math.max(d.credit, d.debit);
      }
      if (metric === "credit") return d.credit;
      if (metric === "debit") return d.debit;
      if (metric === "net") return Math.abs(d.net);
      if (metric === "balance") return Math.abs(d.balance || 0);
      if (metric === "count") return d.count;
      return d.credit + d.debit;
    }),
    1
  );

  const minVal =
    metric === "net" || metric === "balance"
      ? Math.min(
          ...chartData.map((d) => (metric === "net" ? d.net : d.balance || 0)),
          0
        )
      : 0;

  const totalVol = chartData.reduce((acc, d) => acc + (d.credit + d.debit), 0) || 1;

  // Donut colors palette
  const donutColors = [
    "#10b981", "#06b6d4", "#6366f1", "#f59e0b", "#f43f5e",
    "#3b82f6", "#ec4899", "#14b8a6", "#84cc16", "#f97316",
    "#a855f7", "#64748b",
  ];

  return (
    <div className="space-y-6">

      {/* ============================================================
          MULTI-STATEMENT INTERACTIVE CONTROLS (when >1 files selected)
      ============================================================ */}
      {selectedFileIds && selectedFileIds.length > 1 && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/25 p-4 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-300 font-bold text-sm border border-cyan-400/30">
                📁
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Multi-Statement Analysis Active</span>
                  <span className="rounded-full bg-cyan-400/20 text-cyan-300 px-2 py-0.5 text-[10px] font-mono font-semibold">
                    {activeFileFilter.size} of {selectedFileIds.length} Statements in Graph
                  </span>
                </p>
                <p className="text-[11px] text-cyan-200/80 mt-0.5">
                  Click any statement badge below to isolate or include it in the graph.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFileFilter(new Set(selectedFileIds.map(String)))}
                className="rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 transition cursor-pointer"
              >
                Select All ({selectedFileIds.length})
              </button>
              {groupBy !== "file" && (
                <button
                  type="button"
                  onClick={() => setGroupBy("file")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/40 px-3 py-1.5 text-xs font-bold text-cyan-300 transition-all cursor-pointer shadow-sm"
                >
                  <span>📁 Compare Statements Side-by-Side</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Statement File Pills Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cyan-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <span>Filter Statements:</span>
            </span>
            {selectedFileIds.map((fid) => {
              const f = files.find((file) => String(file.id) === String(fid));
              if (!f) return null;
              const col = getFileColor(fid);
              const isChecked = activeFileFilter.has(String(fid));
              return (
                <button
                  key={fid}
                  type="button"
                  onClick={() => {
                    setActiveFileFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(String(fid))) {
                        if (next.size > 1) next.delete(String(fid));
                      } else {
                        next.add(String(fid));
                      }
                      return next;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    isChecked
                      ? `${col.badge} shadow-sm ring-1 ring-cyan-400/50 font-bold`
                      : "border-white/10 bg-black/40 text-slate-500 opacity-50 hover:opacity-100"
                  }`}
                  title={`Click to ${isChecked ? "exclude" : "include"} ${f.account_number?.toString().trim() || f.original_filename} (File: ${f.original_filename}) in graph`}
                >
                  <span className={`h-2 w-2 rounded-full ${isChecked ? col.dot : "bg-slate-600"}`} />
                  <span className="truncate max-w-[150px]">{f.account_number?.toString().trim() || f.original_filename}</span>
                  <span className="text-[10px] opacity-75">{isChecked ? "✓" : "off"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          DYNAMIC CHART STUDIO / GRAPH BUILDER TOOLBAR
      ============================================================ */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#020b09] p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h4 className="text-base font-bold text-white tracking-wide">
                  Dynamic Financial Graph Studio
                </h4>
                <span className="rounded-md bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {filteredTransactions.length} of {transactions.length} Txs Plotted
                </span>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  📊 {currentYOption.label} by {currentXOption.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Choose any column or data type from your bank statement for X-Axis and any financial metric for Y-Axis.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar (Clean summary without date presets) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#020b09] border border-white/[0.06] rounded-xl px-4 py-2 text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-[11px] font-sans font-semibold uppercase tracking-wider">
                Total Flow:
              </span>
              <div className="text-emerald-400 font-semibold" title={`Total Inflow: ${formatCurrencyFull(graphFinancialMetrics.totalCredits)}`}>
                <span className="text-[10px] text-slate-400 mr-1">Cr:</span>
                <span>+{formatCurrency(graphFinancialMetrics.totalCredits)}</span>
              </div>
              <div className="text-rose-400 font-semibold" title={`Total Outflow: ${formatCurrencyFull(graphFinancialMetrics.totalDebits)}`}>
                <span className="text-[10px] text-slate-400 mr-1">Dr:</span>
                <span>-{formatCurrency(graphFinancialMetrics.totalDebits)}</span>
              </div>
              <div className={`font-bold ${graphFinancialMetrics.net >= 0 ? "text-cyan-300" : "text-amber-400"}`}>
                <span className="text-[10px] text-slate-400 mr-1">Net:</span>
                <span>{graphFinancialMetrics.net >= 0 ? "+" : ""}{formatCurrency(graphFinancialMetrics.net)}</span>
              </div>
            </div>
            <div className="text-slate-400 text-[11px]">
              <span className="text-cyan-300 font-bold">{chartData.length}</span> categories plotted across <span className="text-white font-bold">{graphFinancialMetrics.count}</span> transactions
            </div>
          </div>

          {/* Interactive Axis Pickers (Full Dataset Always Loaded) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. X-Axis (Dynamic Data Column) */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5 flex items-center justify-between">
                <span>📅 X-Axis (Column / Data Type)</span>
                <span className="text-[10px] text-cyan-400/80 font-normal">Horizontal Dimension</span>
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-[#061411] px-3 py-2 text-xs text-white font-medium focus:border-cyan-400 focus:outline-none cursor-pointer"
              >
                {Object.entries(
                  dynamicFieldOptions.xOptions.reduce((acc, opt) => {
                    acc[opt.group] = acc[opt.group] || [];
                    acc[opt.group].push(opt);
                    return acc;
                  }, {})
                ).map(([grpName, opts]) => (
                  <optgroup key={grpName} label={grpName} className="bg-[#020b09] text-cyan-300 font-bold">
                    {opts.map((opt) => (
                      <option key={opt.id} value={opt.id} className="text-white font-normal bg-[#061411]">
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* 2. Y-Axis (Dynamic Metric / Value) */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5 flex items-center justify-between">
                <span>📈 Y-Axis (Metric / Value)</span>
                <span className="text-[10px] text-emerald-400/80 font-normal">Vertical Metric</span>
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-[#061411] px-3 py-2 text-xs text-white font-medium focus:border-emerald-400 focus:outline-none cursor-pointer"
              >
                {Object.entries(
                  dynamicFieldOptions.yOptions.reduce((acc, opt) => {
                    acc[opt.group] = acc[opt.group] || [];
                    acc[opt.group].push(opt);
                    return acc;
                  }, {})
                ).map(([grpName, opts]) => (
                  <optgroup key={grpName} label={grpName} className="bg-[#020b09] text-emerald-300 font-bold">
                    {opts.map((opt) => (
                      <option key={opt.id} value={opt.id} className="text-white font-normal bg-[#061411]">
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Timeline Granularity & Custom Date Range Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#061411]/90 border border-white/[0.08] rounded-xl p-3 text-xs">
            {/* Custom Date Range Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <span>📅 Date Scope:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">From</span>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setDrillDown(null);
                  }}
                  className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">To</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setDrillDown(null);
                  }}
                  className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                    setDrillDown(null);
                  }}
                  className="text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg hover:bg-rose-500/25 cursor-pointer transition"
                >
                  ✖ Clear Dates
                </button>
              )}
            </div>

            {/* Step Granularity Pills (When date dimension is active) */}
            {isDateGrouping && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Timeline Range Step:
                </span>
                <div className="flex items-center gap-1 bg-black/40 border border-white/[0.08] p-1 rounded-xl">
                  {[
                    { id: "auto", label: `⚡ Auto (${effectiveGroupBy === "date_year" ? "Yearly" : effectiveGroupBy === "date_quarter" ? "Quarterly" : effectiveGroupBy === "date_month" ? "Monthly" : "Daily"})` },
                    { id: "date_year", label: "📆 Yearly" },
                    { id: "date_quarter", label: "📊 Quarterly" },
                    { id: "date_month", label: "📅 Monthly" },
                    { id: "date_exact", label: "🗓️ Daily" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setDateGranularity(s.id);
                        setDrillDown(null);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                        dateGranularity === s.id
                          ? "bg-cyan-400 text-black shadow-md font-bold"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drill-Down Breadcrumb Banner */}
          {drillDown && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-cyan-950/40 border border-cyan-400/30 px-4 py-2.5 rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <span className="animate-pulse">🔍</span> Timeline Drill-Down:
                </span>
                <button
                  type="button"
                  onClick={() => setDrillDown(null)}
                  className="text-slate-300 hover:text-cyan-300 underline font-semibold cursor-pointer"
                >
                  All Years ({dateSpanInfo.spanYears} Yrs)
                </button>
                <span className="text-slate-500 font-mono">&gt;</span>
                {drillDown.level === "month" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrillDown({ level: "year", year: drillDown.year, label: `Year ${drillDown.year}` })}
                      className="text-slate-300 hover:text-cyan-300 underline font-semibold cursor-pointer"
                    >
                      Year {drillDown.year}
                    </button>
                    <span className="text-slate-500 font-mono">&gt;</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-400/30 px-2 py-0.5 rounded">
                      {drillDown.label} (Daily Breakdown)
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-400/30 px-2 py-0.5 rounded">
                    {drillDown.label} (Monthly Breakdown)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {drillDown.level === "month" ? (
                  <button
                    type="button"
                    onClick={() => setDrillDown({ level: "year", year: drillDown.year, label: `Year ${drillDown.year}` })}
                    className="text-[11px] bg-white/10 hover:bg-white/20 text-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition font-semibold"
                  >
                    ⬅ Back to Year {drillDown.year}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDrillDown(null)}
                    className="text-[11px] bg-white/10 hover:bg-white/20 text-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition font-semibold"
                  >
                    ⬅ Back to All Years
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrillDown(null)}
                  className="text-[11px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg cursor-pointer transition font-semibold"
                >
                  ✖ Reset Zoom
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            MAIN ENLARGED CHART CANVAS (Height ~500px for large view)
        ============================================================ */}
        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          {chartData.length === 0 ? (
            <div className="py-24 text-center text-sm text-slate-500">
              No matching data found for the current chart parameters.
            </div>
          ) : chartType === "combo" ? (
            /* ========================================================
               UNIFIED BAR + LINE COMBO CHART (All in One Canvas)
            ======================================================== */
            <div className="space-y-4">
              {/* Chart Top Header & Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    {currentYOption.label} by {currentXOption.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/70 border border-emerald-400/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                    📈 {currentYOption.axisName}
                  </span>
                  <span className="text-slate-400 text-xs font-mono">
                    ({chartData.length} Plotted)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {/* Height Scale Mode Toggle */}
                  <div className="flex items-center gap-1 bg-black/40 border border-white/[0.08] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setScaleMode("balanced")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                        scaleMode === "balanced"
                          ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Balanced Scaling (Square-Root): Prevents lower volume periods from squashing into invisible flat bars"
                    >
                      ⚖️ Balanced Height
                    </button>
                    <button
                      type="button"
                      onClick={() => setScaleMode("linear")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                        scaleMode === "linear"
                          ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Strict Linear 1:1 Scaling"
                    >
                      📏 Linear Height
                    </button>
                  </div>

                  {metric === "both" ? (
                    <div className="flex flex-wrap items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] px-3.5 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Legend:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm" />
                        <span className="text-emerald-300 font-semibold text-xs">Credit Bar</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 bg-emerald-400 rounded-full" />
                        <span className="h-2 w-2 rounded-full bg-emerald-400 border border-black" />
                        <span className="text-emerald-400 font-semibold text-xs">Credit Line</span>
                      </div>
                      <span className="text-slate-600">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-rose-600 to-rose-400 shadow-sm" />
                        <span className="text-rose-300 font-semibold text-xs">Debit Bar</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 bg-rose-400 rounded-full" />
                        <span className="h-2 w-2 rounded-full bg-rose-400 border border-black" />
                        <span className="text-rose-400 font-semibold text-xs">Debit Line</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-xl text-xs">
                        <span className="h-0.5 w-3 bg-cyan-400 rounded-full" />
                        <span className="h-2 w-2 rounded-full bg-cyan-300 border border-black" />
                        <span className="text-cyan-300 font-semibold">
                          {currentYOption.label} Line
                        </span>
                      </div>
                      <div className="font-mono text-cyan-300 font-semibold bg-cyan-950/30 px-3 py-1 rounded-lg border border-cyan-400/20">
                        Peak: {formatCurrency(maxVal)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Chart Frame: Left Y-Axis Rail + Center Large Plot Area */}
              <div className="flex gap-2 sm:gap-4 pt-4">
                {/* DEDICATED Y-AXIS RAIL (Clean, unobstructed ticks with zero overlap) */}
                <div className="flex flex-col justify-between items-end pr-2.5 border-r-2 border-white/[0.12] select-none text-[11px] font-mono text-slate-300 w-16 sm:w-20 flex-shrink-0 relative pb-14">
                  <div className="text-[10px] font-bold text-emerald-400 font-mono tracking-wider">
                    ₹ MAX
                  </div>
                  <div className="font-bold text-white bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px]">
                    {formatCompact(maxVal)}
                  </div>
                  <div className="text-slate-400 font-medium text-[11px]">{formatCompact(maxVal * 0.75)}</div>
                  <div className="text-slate-400 font-medium text-[11px]">{formatCompact(maxVal * 0.50)}</div>
                  <div className="text-slate-400 font-medium text-[11px]">{formatCompact(maxVal * 0.25)}</div>
                  <div className="text-slate-500 font-bold text-[11px]">₹0</div>
                </div>

                {/* LARGE BAR PLOT CANVAS (Height: 480px, Responsive in SAME fixed space) */}
                <div className="relative flex-1 h-[480px]">
                  {/* Horizontal Background Guidelines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-14">
                    <div className="border-b border-white/[0.1] w-full" />
                    <div className="border-b border-dashed border-white/[0.06] w-full" />
                    <div className="border-b border-dashed border-white/[0.06] w-full" />
                    <div className="border-b border-dashed border-white/[0.06] w-full" />
                    <div className="border-b-2 border-white/[0.15] w-full" />
                  </div>

                  {/* Bars Flex Container: Dynamically fits 100% within space, NO horizontal scrollbar! */}
                  <div className="relative z-10 h-full w-full flex items-end overflow-hidden pb-14">
                    {/* Authentic Line Graph Overlay: Point-to-Point Straight Lines with Node Dots */}
                    {chartData.length > 1 && (() => {
                      const getY = (val) => {
                        if (!val || val <= 0) return 424;
                        const ratio = maxVal > 0
                          ? (scaleMode === "balanced" ? Math.sqrt(val) / Math.sqrt(maxVal) : val / maxVal)
                          : 0;
                        const barH = Math.max(ratio * 100, 4);
                        return 424 - (barH / 100) * 424;
                      };

                      if (metric === "both") {
                        let crPath = "";
                        let drPath = "";
                        const crPoints = [];
                        const drPoints = [];

                        chartData.forEach((d, i) => {
                          const x = ((i + 0.5) / chartData.length) * 1000;
                          const yCr = getY(d.credit);
                          const yDr = getY(d.debit);

                          if (i === 0) {
                            crPath += `M ${x.toFixed(1)},${yCr.toFixed(1)}`;
                            drPath += `M ${x.toFixed(1)},${yDr.toFixed(1)}`;
                          } else {
                            crPath += ` L ${x.toFixed(1)},${yCr.toFixed(1)}`;
                            drPath += ` L ${x.toFixed(1)},${yDr.toFixed(1)}`;
                          }
                          crPoints.push({ x, y: yCr, key: d.key, val: d.credit });
                          drPoints.push({ x, y: yDr, key: d.key, val: d.debit });
                        });

                        return (
                          <svg
                            viewBox="0 0 1000 424"
                            preserveAspectRatio="none"
                            className="absolute inset-x-0 top-0 h-[calc(100%-56px)] w-full pointer-events-none z-20 overflow-visible"
                          >
                            {/* 🟢 Credit / Inflow Straight Line */}
                            <path
                              d={crPath}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {crPoints.map((pt, pIdx) => {
                              const isHovered = hoveredItem?.key === pt.key;
                              return (
                                <circle
                                  key={`cr-${pIdx}`}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isHovered ? 5.5 : chartData.length > 25 ? 2.5 : 3.5}
                                  fill="#10b981"
                                  stroke="#020b09"
                                  strokeWidth={isHovered ? 2.5 : 1.5}
                                />
                              );
                            })}

                            {/* 🔴 Debit / Outflow Straight Line */}
                            <path
                              d={drPath}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {drPoints.map((pt, pIdx) => {
                              const isHovered = hoveredItem?.key === pt.key;
                              return (
                                <circle
                                  key={`dr-${pIdx}`}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isHovered ? 5.5 : chartData.length > 25 ? 2.5 : 3.5}
                                  fill="#f43f5e"
                                  stroke="#020b09"
                                  strokeWidth={isHovered ? 2.5 : 1.5}
                                />
                              );
                            })}
                          </svg>
                        );
                      }

                      // Single Metric Selected
                      const lineColor =
                        metric === "credit"
                          ? "#10b981"
                          : metric === "debit"
                          ? "#f43f5e"
                          : metric === "balance"
                          ? "#38bdf8"
                          : "#06b6d4";

                      let singlePath = "";
                      const singlePoints = [];

                      chartData.forEach((d, i) => {
                        const x = ((i + 0.5) / chartData.length) * 1000;
                        const sVal = Math.max(0, getMetricValue(d, metric) || 0);
                        const yS = getY(sVal);

                        if (i === 0) {
                          singlePath += `M ${x.toFixed(1)},${yS.toFixed(1)}`;
                        } else {
                          singlePath += ` L ${x.toFixed(1)},${yS.toFixed(1)}`;
                        }
                        singlePoints.push({ x, y: yS, key: d.key, val: sVal });
                      });

                      return (
                        <svg
                          viewBox="0 0 1000 424"
                          preserveAspectRatio="none"
                          className="absolute inset-x-0 top-0 h-[calc(100%-56px)] w-full pointer-events-none z-20 overflow-visible"
                        >
                          <path
                            d={singlePath}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {singlePoints.map((pt, pIdx) => {
                            const isHovered = hoveredItem?.key === pt.key;
                            return (
                              <circle
                                key={`s-${pIdx}`}
                                cx={pt.x}
                                cy={pt.y}
                                r={isHovered ? 5.5 : chartData.length > 25 ? 2.5 : 3.5}
                                fill={lineColor}
                                stroke="#020b09"
                                strokeWidth={isHovered ? 2.5 : 1.5}
                              />
                            );
                          })}
                        </svg>
                      );
                    })()}
                    {chartData.map((d, idx) => {
                      const totalAmount = d.credit + d.debit;
                      const rawRatio = maxVal > 0 ? totalAmount / maxVal : 0;
                      const displayRatio = scaleMode === "balanced"
                        ? (maxVal > 0 ? Math.sqrt(totalAmount) / Math.sqrt(maxVal) : 0)
                        : rawRatio;
                      const stackedBarH = totalAmount > 0 ? Math.max(displayRatio * 100, 6) : 0;
                      const drPct = totalAmount > 0 ? (d.debit / totalAmount) * 100 : 0;
                      const crPct = totalAmount > 0 ? (d.credit / totalAmount) * 100 : 0;

                      const singleVal = getMetricValue(d, metric);
                      const rawSingleRatio = maxVal > 0 ? singleVal / maxVal : 0;
                      const displaySingleRatio = scaleMode === "balanced"
                        ? (maxVal > 0 ? Math.sqrt(Math.max(0, singleVal)) / Math.sqrt(maxVal) : 0)
                        : rawSingleRatio;
                      const singleH = singleVal > 0 ? Math.max(displaySingleRatio * 100, 6) : 0;
                      const currentBarH = metric === "both" ? stackedBarH : singleH;
                      const valForDisplay = metric === "both" ? totalAmount : singleVal;

                      return (
                        <div
                          key={d.key || idx}
                          className="group relative flex-1 min-w-0 flex flex-col items-center justify-end h-full cursor-pointer px-0.5 sm:px-1"
                          onClick={() => handleBarClick(d)}
                          onMouseEnter={() => setHoveredItem(d)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {/* Value Tag Above Bar (Always visible when <= 8 items, or on hover when > 8 items) */}
                          {valForDisplay > 0 && (
                            <div
                              style={{ bottom: `calc(${currentBarH}% + 8px)` }}
                              className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-150 ${
                                chartData.length <= 8
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 group-hover:-translate-y-1"
                              }`}
                            >
                              <span className="font-mono font-bold text-[10px] text-cyan-200 bg-[#020b09]/95 border border-cyan-400/50 px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                                {formatCompact(valForDisplay)}
                              </span>
                            </div>
                          )}

                          {/* Floating Hover Tooltip */}
                          <div className="absolute bottom-[105%] mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 rounded-2xl bg-[#061411] border border-cyan-400/40 p-3.5 shadow-2xl min-w-[220px]">
                            <div className="font-bold text-white text-xs border-b border-white/10 pb-1.5 mb-2 flex items-center justify-between">
                              <span className="truncate max-w-[170px]" title={d.label}>{d.label}</span>
                              <span className="text-[10px] text-cyan-300 font-mono">#{idx + 1}</span>
                            </div>
                            <div className="space-y-1.5 font-mono text-[11px]">
                              <div className="flex justify-between text-rose-400">
                                <span>▲ Top (Debit):</span>
                                <span className="font-bold">{formatCurrencyFull(d.debit)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-400">
                                <span>▼ Bottom (Credit):</span>
                                <span className="font-bold">{formatCurrencyFull(d.credit)}</span>
                              </div>
                              {metric === "both" && (
                                <div className="flex justify-between text-white font-bold pt-1 border-t border-white/10">
                                  <span>Combined Bar:</span>
                                  <span>{formatCurrencyFull(totalAmount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-cyan-300 pt-1 border-t border-white/10 font-bold">
                                <span>Net Flow:</span>
                                <span>{d.net >= 0 ? `+${formatCurrencyFull(d.net)}` : formatCurrencyFull(d.net)}</span>
                              </div>
                              {d.balance !== null && (
                                <div className="flex justify-between text-slate-300">
                                  <span>Closing Balance:</span>
                                  <span>{formatCurrencyFull(d.balance)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-slate-400 pt-1.5 border-t border-white/10 text-[10px]">
                                <span>Activity:</span>
                                <span>{d.count} transactions</span>
                              </div>

                              {/* Statement File Breakdown inside Tooltip */}
                              {d.fileBreakdownList && d.fileBreakdownList.length > 1 && (
                                <div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
                                  <div className="text-[10px] uppercase font-bold text-cyan-300 flex items-center justify-between">
                                    <span>📁 Statement Breakdown</span>
                                    <span className="text-[9px] text-slate-400 font-normal">({d.fileBreakdownList.length} files)</span>
                                  </div>
                                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                    {d.fileBreakdownList.map((fb) => {
                                      const col = getFileColor(fb.fileId);
                                      return (
                                        <div
                                          key={fb.fileId}
                                          className="flex items-center justify-between text-[10px] bg-white/[0.04] px-2 py-1 rounded border border-white/[0.04]"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${col.dot}`} />
                                            <span className="truncate max-w-[105px] text-slate-200 font-medium" title={fb.fileName}>
                                              {fb.fileName}
                                            </span>
                                          </div>
                                          <div className="font-mono text-right shrink-0">
                                            <span className="text-emerald-400 font-semibold">+{formatCompact(fb.credit)}</span>
                                            <span className="text-slate-600 mx-1">|</span>
                                            <span className="text-rose-400 font-semibold">-{formatCompact(fb.debit)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Drill-down hint when viewing dates */}
                              {isDateGrouping && (effectiveGroupBy === "date_year" || effectiveGroupBy === "date_month") && (
                                <div className="pt-2 mt-2 border-t border-cyan-400/25 flex items-center justify-between text-[10px] text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-1 rounded">
                                  <span>👆 Click bar to view {effectiveGroupBy === "date_year" ? "monthly breakdown" : "daily breakdown"}</span>
                                  <span className="text-xs">🔍</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bars Graphic */}
                          {metric === "both" ? (
                            /* SINGLE STACKED BAR */
                            <div
                              style={{ height: `${stackedBarH}%` }}
                              className={`w-full ${
                                chartData.length <= 8
                                  ? "max-w-[56px]"
                                  : chartData.length <= 16
                                  ? "max-w-[40px]"
                                  : chartData.length <= 25
                                  ? "max-w-[28px]"
                                  : "max-w-[20px]"
                              } flex flex-col justify-end rounded-t-lg overflow-hidden transition-all duration-200 group-hover:brightness-110 shadow-lg shadow-black/40 border border-white/10`}
                            >
                              {/* Top Segment: Debit (Outflow - Red/Rose) */}
                              {d.debit > 0 && (
                                <div
                                  style={{ height: `${drPct}%` }}
                                  className={`w-full bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 ${
                                    d.credit > 0 ? "border-b border-black/40" : ""
                                  }`}
                                  title={`Top Segment - Debit: ${formatCurrencyFull(d.debit)}`}
                                />
                              )}
                              {/* Bottom Segment: Credit (Inflow - Green/Emerald) */}
                              {d.credit > 0 && (
                                <div
                                  style={{ height: `${crPct}%` }}
                                  className="w-full bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400"
                                  title={`Bottom Segment - Credit: ${formatCurrencyFull(d.credit)}`}
                                />
                              )}
                              {totalAmount === 0 && (
                                <div className="w-full h-full bg-slate-700/50" />
                              )}
                            </div>
                          ) : (
                            <div
                              style={{ height: `${singleH}%` }}
                              className={`w-full ${
                                chartData.length <= 8
                                  ? "max-w-[56px]"
                                  : chartData.length <= 16
                                  ? "max-w-[40px]"
                                  : chartData.length <= 25
                                  ? "max-w-[28px]"
                                  : "max-w-[20px]"
                              } rounded-t-lg transition-all duration-200 group-hover:brightness-125 shadow-lg ${
                                metric === "credit"
                                  ? "bg-gradient-to-t from-emerald-600/90 via-emerald-500 to-emerald-400 shadow-emerald-500/10"
                                  : metric === "debit"
                                  ? "bg-gradient-to-t from-rose-600/90 via-rose-500 to-rose-400 shadow-rose-500/10"
                                  : metric === "net"
                                  ? d.net >= 0
                                    ? "bg-gradient-to-t from-emerald-600/90 via-emerald-500 to-emerald-400"
                                    : "bg-gradient-to-t from-rose-600/90 via-rose-500 to-rose-400"
                                  : metric === "balance"
                                  ? "bg-gradient-to-t from-cyan-600/90 via-cyan-500 to-cyan-400 shadow-cyan-500/10"
                                  : "bg-gradient-to-t from-indigo-600/90 via-indigo-500 to-indigo-400 shadow-indigo-500/10"
                              }`}
                            />
                          )}

                          {/* Category Ticks (Smart decimation + rotation for high density) */}
                          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center w-full">
                            {(() => {
                              const isDense = chartData.length > 12;
                              const isVeryDense = chartData.length > 22;
                              const step = isVeryDense ? Math.ceil(chartData.length / 10) : 1;
                              const shouldShowText = idx % step === 0 || idx === chartData.length - 1;

                              return (
                                <div className="flex flex-col items-center">
                                  {/* Subtle tick line */}
                                  <span className={`h-1.5 w-0.5 ${shouldShowText ? "bg-cyan-400/40" : "bg-white/10"}`} />
                                  <span
                                    className={`font-mono transition-all select-none ${
                                      isDense
                                        ? "transform -rotate-45 origin-top-left text-[9px] sm:text-[10px] whitespace-nowrap mt-1"
                                        : "text-[10px] sm:text-[11px] truncate max-w-full text-center mt-1"
                                    } ${
                                      hoveredItem?.key === d.key
                                        ? "text-cyan-300 font-bold opacity-100 scale-105"
                                        : shouldShowText
                                        ? "text-slate-400 group-hover:text-white"
                                        : "opacity-0 group-hover:opacity-100 text-slate-400"
                                    }`}
                                    title={d.label}
                                  >
                                    {isDense
                                      ? d.label.length > 10 ? d.label.slice(0, 9) : d.label
                                      : d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* DEDICATED X-AXIS BOTTOM TITLE BAR */}
              <div className="flex items-center justify-center pt-3 border-t-2 border-white/[0.12] mt-2">
                <div className="inline-flex items-center gap-2.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 px-5 py-2 text-xs font-bold text-cyan-300 shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>📅 X-Axis: {currentXOption.label}</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (Full Dataset: All {chartData.length} Points Plotted)
                  </span>
                </div>
              </div>
            </div>
          ) : chartType === "area" ? (
            /* ========================================================
               ENLARGED LINE & AREA CHART WITH EXPLICIT AXIS TITLES
            ======================================================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-white text-sm">
                  {currentYOption.label} Trajectory ({chartData.length} Nodes)
                </span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  {metric === "both" ? (
                    <>
                      <span className="text-emerald-400 font-bold">🟢 Inflow Curve</span>
                      <span className="text-rose-400 font-bold">🔴 Outflow Curve</span>
                    </>
                  ) : (
                    <span className="text-cyan-300 font-bold">
                      Range: {formatCurrency(minVal)} to {formatCurrency(maxVal)}
                    </span>
                  )}
                </div>
              </div>

              {chartData.length < 2 ? (
                <div className="py-24 text-center text-xs text-slate-500">
                  At least 2 data periods required to plot curve.
                </div>
              ) : (
                <div className="relative">
                  {(() => {
                    const svgW = 1000;
                    const svgH = 460;
                    const padX = 70;
                    const padY = 40;
                    const plotW = svgW - padX * 2;
                    const plotH = svgH - padY * 2;
                    const valSpan = maxVal - minVal || 1;

                    const pointsCr = chartData.map((d, i) => {
                      const x = padX + (i / Math.max(chartData.length - 1, 1)) * plotW;
                      const y = svgH - padY - ((d.credit - 0) / (maxVal || 1)) * plotH;
                      return { x, y, ...d };
                    });

                    const pointsDr = chartData.map((d, i) => {
                      const x = padX + (i / Math.max(chartData.length - 1, 1)) * plotW;
                      const y = svgH - padY - ((d.debit - 0) / (maxVal || 1)) * plotH;
                      return { x, y, ...d };
                    });

                    const pointsSingle = chartData.map((d, i) => {
                      const x = padX + (i / Math.max(chartData.length - 1, 1)) * plotW;
                      const val = getMetricValue(d, metric);
                      const y = svgH - padY - ((val - minVal) / valSpan) * plotH;
                      return { x, y, ...d, plotVal: val };
                    });

                    const makePath = (pts) =>
                      pts.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");

                    const makeArea = (pts) =>
                      `${makePath(pts)} L ${pts[pts.length - 1].x},${svgH - padY} L ${pts[0].x},${svgH - padY} Z`;

                    return (
                      <div className="space-y-3">
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[460px] sm:h-[500px] overflow-visible">
                          <defs>
                            <linearGradient id="areaGradCr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="areaGradDr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="areaGradCyan" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Y-Axis Label inside SVG on left */}
                          <text
                            x={-svgH / 2}
                            y={22}
                            transform="rotate(-90)"
                            fill="#10b981"
                            fontSize="11"
                            fontWeight="bold"
                            textAnchor="middle"
                            letterSpacing="0.08em"
                          >
                            📈 Y-AXIS: {currentYOption.axisName.toUpperCase()}
                          </text>

                          {/* Guidelines with Y-ticks */}
                          <line x1={padX} y1={padY} x2={svgW - padX} y2={padY} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                          <text x={padX - 8} y={padY + 4} fill="#94a3b8" fontSize="10" fontName="monospace" textAnchor="end">
                            {formatCompact(maxVal)}
                          </text>

                          <line x1={padX} y1={padY + plotH * 0.33} x2={svgW - padX} y2={padY + plotH * 0.33} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                          <text x={padX - 8} y={padY + plotH * 0.33 + 4} fill="#94a3b8" fontSize="10" fontName="monospace" textAnchor="end">
                            {formatCompact(maxVal * 0.66)}
                          </text>

                          <line x1={padX} y1={padY + plotH * 0.66} x2={svgW - padX} y2={padY + plotH * 0.66} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                          <text x={padX - 8} y={padY + plotH * 0.66 + 4} fill="#94a3b8" fontSize="10" fontName="monospace" textAnchor="end">
                            {formatCompact(maxVal * 0.33)}
                          </text>

                          <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                          <text x={padX - 8} y={svgH - padY + 4} fill="#64748b" fontSize="10" fontName="monospace" textAnchor="end">
                            ₹0
                          </text>

                          {metric === "both" ? (
                            <>
                              {chartType === "area" && (
                                <>
                                  <path d={makeArea(pointsCr)} fill="url(#areaGradCr)" />
                                  <path d={makeArea(pointsDr)} fill="url(#areaGradDr)" />
                                </>
                              )}
                              <path d={makePath(pointsCr)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              <path d={makePath(pointsDr)} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                              {pointsCr.map((pt, i) => (
                                <circle
                                  key={`cr-${i}`}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="4"
                                  className="fill-emerald-400 hover:r-6 cursor-pointer stroke-slate-900 stroke-2 transition-all"
                                  onMouseEnter={() => setHoveredItem(pt)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                />
                              ))}
                              {pointsDr.map((pt, i) => (
                                <circle
                                  key={`dr-${i}`}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="4"
                                  className="fill-rose-400 hover:r-6 cursor-pointer stroke-slate-900 stroke-2 transition-all"
                                  onMouseEnter={() => setHoveredItem(pt)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                />
                              ))}
                            </>
                          ) : (
                            <>
                              {chartType === "area" && (
                                <path d={makeArea(pointsSingle)} fill="url(#areaGradCyan)" />
                              )}
                              <path
                                d={makePath(pointsSingle)}
                                fill="none"
                                stroke="#06b6d4"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {pointsSingle.map((pt, i) => (
                                <circle
                                  key={i}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="4.5"
                                  className="fill-cyan-400 hover:fill-white hover:r-7 cursor-pointer stroke-slate-900 stroke-2 transition-all"
                                  onMouseEnter={() => setHoveredItem(pt)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                />
                              ))}
                            </>
                          )}
                        </svg>

                        {/* Dedicated X-Axis Bottom Title Bar */}
                        <div className="flex items-center justify-center pt-2 border-t-2 border-white/[0.12]">
                          <div className="inline-flex items-center gap-2.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 px-5 py-2 text-xs font-bold text-cyan-300 shadow-lg">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span>📅 X-Axis: {currentXOption.label}</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({chartData.length} Points)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               ENLARGED DONUT / SHARE BREAKDOWN WITH EXPLICIT TITLES
            ======================================================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-white text-sm">
                  Proportional Breakdown Share by {currentXOption.label}
                </span>
                <span className="font-mono text-cyan-300 font-semibold bg-cyan-950/30 px-3 py-1 rounded-lg border border-cyan-400/20">
                  Total Volume: {formatCurrency(totalVol)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4 min-h-[440px]">
                {/* Large SVG Donut Ring */}
                <div className="relative flex items-center justify-center h-80">
                  {(() => {
                    const size = 300;
                    const strokeWidth = 44;
                    const radius = (size - strokeWidth) / 2;
                    const circumference = 2 * Math.PI * radius;
                    let accumulatedOffset = 0;

                    return (
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                        {chartData.map((d, i) => {
                          const val = Math.max(getMetricValue(d, metric), 0);
                          const pct = val / totalVol || 0;
                          const strokeDasharray = `${pct * circumference} ${circumference}`;
                          const strokeDashoffset = -accumulatedOffset;
                          accumulatedOffset += pct * circumference;
                          const color = donutColors[i % donutColors.length];

                          return (
                            <circle
                              key={d.key || i}
                              cx={size / 2}
                              cy={size / 2}
                              r={radius}
                              fill="transparent"
                              stroke={color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                              onMouseEnter={() => setHoveredItem(d)}
                              onMouseLeave={() => setHoveredItem(null)}
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}

                  {/* Donut Center Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                      {hoveredItem ? hoveredItem.label : "Total Volume"}
                    </span>
                    <span className="text-lg font-extrabold text-white font-mono mt-1">
                      {hoveredItem
                        ? formatCurrency(getMetricValue(hoveredItem, metric))
                        : formatCurrency(totalVol)}
                    </span>
                    {hoveredItem && (
                      <span className="text-xs text-cyan-300 font-mono mt-0.5 font-bold">
                        {((getMetricValue(hoveredItem, metric) / totalVol) * 100).toFixed(1)}% Share
                      </span>
                    )}
                  </div>
                </div>

                {/* Donut Legend Table */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {chartData.map((d, i) => {
                    const val = getMetricValue(d, metric);
                    const pct = ((val / totalVol) * 100).toFixed(1);
                    const color = donutColors[i % donutColors.length];

                    return (
                      <div
                        key={d.key || i}
                        onMouseEnter={() => setHoveredItem(d)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                          hoveredItem?.key === d.key
                            ? "bg-white/[0.08] border border-cyan-400/40 shadow-md"
                            : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            style={{ backgroundColor: color }}
                            className="h-3.5 w-3.5 rounded-full flex-shrink-0"
                          />
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {d.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-right flex-shrink-0">
                          <span className="text-[11px] text-slate-400">{pct}%</span>
                          <span className="text-xs font-bold text-white">
                            {formatCurrency(val)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dedicated Dimension Badge at Bottom */}
              <div className="flex items-center justify-center pt-3 border-t-2 border-white/[0.12]">
                <div className="inline-flex items-center gap-2.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 px-5 py-2 text-xs font-bold text-cyan-300 shadow-lg">
                  <span>🍩 Breakdown Dimension: {currentXOption.label}</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({chartData.length} Segments)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              BOTTOM HOVER DETAIL INSPECTION BANNER
          ============================================================ */}
          <div className="mt-5 pt-4 border-t border-white/[0.08]">
            {hoveredItem ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-cyan-950/30 border border-cyan-400/30 rounded-2xl px-5 py-3 text-xs gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-bold text-white text-sm">{hoveredItem.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
                  <span className="text-emerald-400 font-bold">
                    Inflow: +{formatCurrencyFull(hoveredItem.credit)}
                  </span>
                  <span className="text-rose-400 font-bold">
                    Outflow: -{formatCurrencyFull(hoveredItem.debit)}
                  </span>
                  <span className={`font-bold ${hoveredItem.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    Net: {hoveredItem.net >= 0 ? `+${formatCurrencyFull(hoveredItem.net)}` : formatCurrencyFull(hoveredItem.net)}
                  </span>
                  {hoveredItem.balance !== null && (
                    <span className="text-cyan-200">
                      Balance: {formatCurrencyFull(hoveredItem.balance)}
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px]">
                    ({hoveredItem.count} txs)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-1">
                💡 Tip: Hover over any bar, curve node, or donut slice to inspect full details for that exact category.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
