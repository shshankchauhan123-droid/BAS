import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import * as echarts from "echarts";
import { useAuth } from "../../../context/AuthContext";
import UserNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import {
  getMyActivityLogs,
  getMyActivitySummary,
  recordActivity,
} from "../../../services/api/activityLogs";

// --- REUSABLE SAFE FORMATTERS ---

/**
 * Safely format numbers with commas (e.g., 1,234).
 * Guaranteed never to throw TypeError on null, undefined, NaN, or non-numeric types.
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
};

/**
 * Safely format optional strings/IDs with a standard fallback (e.g. "—").
 */
export const formatOptional = (value, fallback = "—") => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  return String(value);
};

/**
 * Safely format an ISO datetime string into Indian Standard Time (IST).
 */
export const formatIST = (isoStr) => {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    const formatted = d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return formatted.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  } catch {
    return String(isoStr);
  }
};

// --- MODULE COLOR SCHEMES ---
const MODULE_COLORS = {
  AUTH: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
    chart: "#8b5cf6",
  },
  CASE: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    chart: "#3b82f6",
  },
  UPLOAD: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    chart: "#f59e0b",
  },
  REPORT: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
    chart: "#6366f1",
  },
  ADMIN: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    dot: "bg-cyan-500",
    chart: "#06b6d4",
  },
  SUPPORT: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dot: "bg-teal-500",
    chart: "#14b8a6",
  },
  DASHBOARD: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    chart: "#10b981",
  },
  GENERAL: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    dot: "bg-slate-500",
    chart: "#64748b",
  },
};

const MODULE_OPTIONS = [
  { value: "", label: "All Modules" },
  { value: "AUTH", label: "Authentication (AUTH)" },
  { value: "CASE", label: "Case Management (CASE)" },
  { value: "UPLOAD", label: "Upload & Files (UPLOAD)" },
  { value: "REPORT", label: "Reports & Analytics (REPORT)" },
  { value: "ADMIN", label: "Administration (ADMIN)" },
  { value: "SUPPORT", label: "Help & Support (SUPPORT)" },
  { value: "DASHBOARD", label: "Dashboard (DASHBOARD)" },
  { value: "GENERAL", label: "General System (GENERAL)" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
];

const DATE_PRESETS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "7days", label: "Last 7 Days" },
  { id: "30days", label: "Last 30 Days" },
  { id: "custom", label: "Custom Range" },
];

// --- COMPLETE DEFAULT SUMMARY STRUCTURE ---
const DEFAULT_SUMMARY = {
  total_activities: 0,
  successful_actions: 0,
  failed_actions: 0,
  reports_generated: 0,
  cases_created_updated: 0,
  cases_modified: 0,
  login_sessions: 0,
  activity_trend: [],
  daily_trend: [],
  by_module: [],
  module_breakdown: [],
  by_action: [],
  action_breakdown: [],
  by_status: { SUCCESS: 0, FAILED: 0 },
  status_breakdown: { SUCCESS: 0, FAILED: 0 },
};

/**
 * Validates, flattens, and normalizes the summary response object from the API.
 * Prevents missing/null fields from crashing component rendering or charts.
 */
function normalizeSummaryResponse(res) {
  if (!res || typeof res !== "object") {
    return { ...DEFAULT_SUMMARY };
  }

  // Backend returns stats either nested inside `res.stats`, `res.data.stats`, or flat on `res`
  const s =
    res.stats && typeof res.stats === "object"
      ? res.stats
      : res.data && typeof res.data === "object" && res.data.stats
      ? res.data.stats
      : res.data && typeof res.data === "object"
      ? res.data
      : res;

  const totalActivities = Number(s?.total_activities ?? 0);
  const successfulActions = Number(s?.successful_actions ?? 0);
  const failedActions = Number(s?.failed_actions ?? 0);
  const reportsGenerated = Number(s?.reports_generated ?? 0);
  const casesCount = Number(s?.cases_created_updated ?? s?.cases_modified ?? 0);
  const loginSessions = Number(s?.login_sessions ?? 0);

  // Daily timeline trend array
  const rawTrend = Array.isArray(res.activity_trend)
    ? res.activity_trend
    : Array.isArray(res.daily_trend)
    ? res.daily_trend
    : Array.isArray(res.data?.activity_trend)
    ? res.data.activity_trend
    : [];

  const activityTrend = rawTrend.map((item) => ({
    date: String(item?.date || ""),
    count: Number(item?.count ?? 0),
    success: Number(item?.success ?? 0),
    failed: Number(item?.failed ?? 0),
  }));

  // Subsystem module breakdown array
  const rawModules = Array.isArray(res.by_module)
    ? res.by_module
    : Array.isArray(res.module_breakdown)
    ? res.module_breakdown
    : Array.isArray(res.data?.by_module)
    ? res.data.by_module
    : [];

  const byModule = rawModules.map((item) => {
    const label = String(item?.name || item?.key || "OTHER");
    return {
      name: label,
      key: label,
      count: Number(item?.count ?? 0),
    };
  });

  // Action breakdown array
  const rawActions = Array.isArray(res.by_action)
    ? res.by_action
    : Array.isArray(res.action_breakdown)
    ? res.action_breakdown
    : Array.isArray(res.data?.by_action)
    ? res.data.by_action
    : [];

  const byAction = rawActions.map((item) => {
    const label = String(item?.name || item?.key || "UNKNOWN");
    return {
      name: label,
      key: label,
      count: Number(item?.count ?? 0),
    };
  });

  // Status breakdown dictionary
  const rawStatus =
    res.by_status && typeof res.by_status === "object"
      ? res.by_status
      : res.status_breakdown && typeof res.status_breakdown === "object"
      ? res.status_breakdown
      : { SUCCESS: successfulActions, FAILED: failedActions };

  const byStatus = {
    SUCCESS: Number(rawStatus?.SUCCESS ?? successfulActions),
    FAILED: Number(rawStatus?.FAILED ?? failedActions),
  };

  return {
    total_activities: Number.isFinite(totalActivities) && totalActivities >= 0 ? totalActivities : 0,
    successful_actions: Number.isFinite(successfulActions) && successfulActions >= 0 ? successfulActions : 0,
    failed_actions: Number.isFinite(failedActions) && failedActions >= 0 ? failedActions : 0,
    reports_generated: Number.isFinite(reportsGenerated) && reportsGenerated >= 0 ? reportsGenerated : 0,
    cases_created_updated: Number.isFinite(casesCount) && casesCount >= 0 ? casesCount : 0,
    cases_modified: Number.isFinite(casesCount) && casesCount >= 0 ? casesCount : 0,
    login_sessions: Number.isFinite(loginSessions) && loginSessions >= 0 ? loginSessions : 0,
    activity_trend: activityTrend,
    daily_trend: activityTrend,
    by_module: byModule,
    module_breakdown: byModule,
    by_action: byAction,
    action_breakdown: byAction,
    by_status: byStatus,
    status_breakdown: byStatus,
  };
}

/**
 * Validates and normalizes the paginated logs list response from the API.
 */
function normalizeLogsResponse(res, currentPageSize = 20) {
  if (!res || typeof res !== "object") {
    return { data: [], total: 0, totalPages: 1 };
  }

  const items = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.logs)
    ? res.logs
    : Array.isArray(res)
    ? res
    : [];

  const totalNum = Number(res.total ?? res.total_count ?? items.length);
  const total = Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : 0;

  const totalPagesNum = Number(
    res.total_pages ??
      res.totalPages ??
      Math.ceil(total / Math.max(1, currentPageSize))
  );
  const totalPages =
    Number.isFinite(totalPagesNum) && totalPagesNum >= 1 ? totalPagesNum : 1;

  return {
    data: items,
    total,
    totalPages,
  };
}

export default function ActivityLogsPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const homePath =
    userRole === "superadmin" || userRole === "admin"
      ? "/superadmin"
      : userRole === "client_admin"
      ? "/client-admin"
      : "/dashboard";

  // Filter states
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data states
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle Preset Changes
  const applyDatePreset = (presetId) => {
    setDatePreset(presetId);
    setPage(1);

    const now = new Date();
    if (presetId === "all") {
      setStartDate("");
      setEndDate("");
    } else if (presetId === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      setStartDate(startOfDay.toISOString());
      setEndDate(now.toISOString());
    } else if (presetId === "7days") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfPast7 = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0);
      setStartDate(startOfPast7.toISOString());
      setEndDate(now.toISOString());
    } else if (presetId === "30days") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startOfPast30 = new Date(past30.getFullYear(), past30.getMonth(), past30.getDate(), 0, 0, 0);
      setStartDate(startOfPast30.toISOString());
      setEndDate(now.toISOString());
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setSelectedModule("");
    setSelectedStatus("");
    setSearchTerm("");
    setDebouncedSearch("");
    setPage(1);
  };

  // Record telemetry on page view
  useEffect(() => {
    recordActivity({
      action: "PAGE_VIEW",
      module: "DASHBOARD",
      description: "Navigated to personal Activity Logs & Audit History",
      entity_type: "activity_logs",
    });
  }, []);

  // Fetch summary and logs
  const fetchData = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const params = {
          search: debouncedSearch ? debouncedSearch.trim() : undefined,
          module: selectedModule || undefined,
          status: selectedStatus || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
          page_size: pageSize,
        };

        const [summaryRes, logsRes] = await Promise.all([
          getMyActivitySummary({
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          }).catch((err) => {
            console.error("Failed to load activity summary:", err);
            return null;
          }),
          getMyActivityLogs(params).catch((err) => {
            console.error("Failed to load activity logs:", err);
            return null;
          }),
        ]);

        const normalizedSummary = normalizeSummaryResponse(summaryRes);
        setSummary(normalizedSummary);

        const normalizedLogs = normalizeLogsResponse(logsRes, pageSize);
        setLogs(normalizedLogs.data);
        setTotalCount(normalizedLogs.total);
        setTotalPages(normalizedLogs.totalPages);
      } catch (err) {
        console.error("Failed to load activity log data:", err);
        setError("Unable to load activity logs. Please verify connection and retry.");
        setSummary(DEFAULT_SUMMARY);
        setLogs([]);
        setTotalCount(0);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, selectedModule, selectedStatus, startDate, endDate, page, pageSize]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- ECHARTS INSTANCES & RENDERING ---
  const trendChartRef = useRef(null);
  const moduleChartRef = useRef(null);
  const actionChartRef = useRef(null);
  const statusChartRef = useRef(null);

  // 1. Trend Chart
  useEffect(() => {
    if (!trendChartRef.current) return;
    const chart = echarts.init(trendChartRef.current);

    const trendData = summary.activity_trend || [];
    const dates = trendData.map((d) => d?.date || "");
    const counts = trendData.map((d) => Number(d?.count ?? 0));

    const option = {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(16, 185, 129, 0.3)",
        borderWidth: 1,
        padding: 10,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const item = params[0];
          return `
            <div style="font-weight: 700; color: #10b981; margin-bottom: 2px;">${item.name || "Date"}</div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px;">
              <span style="color: #94a3b8;">Activities:</span>
              <span style="font-weight: 700; color: #fff;">${formatNumber(item.value)}</span>
            </div>
          `;
        },
      },
      grid: {
        top: 25,
        right: 16,
        bottom: 30,
        left: 42,
      },
      xAxis: {
        type: "category",
        data: dates.length > 0 ? dates : ["No Data"],
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (val) => {
            if (!val || val === "No Data") return val;
            const parts = String(val).split("-");
            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
          },
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      series: [
        {
          name: "Activities",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: "#10b981" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(16, 185, 129, 0.35)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.00)" },
            ]),
          },
          data: counts.length > 0 ? counts : [0],
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [summary.activity_trend]);

  // 2. Module Chart
  useEffect(() => {
    if (!moduleChartRef.current) return;
    const chart = echarts.init(moduleChartRef.current);

    const moduleData = (summary.by_module || []).slice(0, 6);
    const names = moduleData.map((d) => d?.name || "Other");
    const counts = moduleData.map((d) => Number(d?.count ?? 0));

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(59, 130, 246, 0.3)",
        borderWidth: 1,
        padding: 10,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const item = params[0];
          return `
            <div style="font-weight: 700; color: #3b82f6; margin-bottom: 2px;">${item.name}</div>
            <div style="font-size: 11px;">Operations: <b>${formatNumber(item.value)}</b></div>
          `;
        },
      },
      grid: {
        top: 15,
        right: 25,
        bottom: 25,
        left: 80,
      },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      yAxis: {
        type: "category",
        data: names.length > 0 ? names : ["None"],
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#475569",
          fontSize: 10,
          fontWeight: 600,
        },
      },
      series: [
        {
          name: "Operations",
          type: "bar",
          barWidth: 14,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params) => {
              const modKey = params.name;
              return MODULE_COLORS[modKey]?.chart || "#3b82f6";
            },
          },
          data: counts.length > 0 ? counts : [0],
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [summary.by_module]);

  // 3. Action Breakdown Chart
  useEffect(() => {
    if (!actionChartRef.current) return;
    const chart = echarts.init(actionChartRef.current);

    const actionData = (summary.by_action || []).slice(0, 5).map((d) => ({
      name: String(d?.name || "Unknown").replace(/_/g, " "),
      value: Number(d?.count ?? 0),
    }));

    const option = {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(99, 102, 241, 0.3)",
        borderWidth: 1,
        padding: 10,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params) => {
          if (!params) return "";
          return `${params.name}: <b>${formatNumber(params.value)}</b> (${params.percent || 0}%)`;
        },
      },
      legend: {
        orient: "horizontal",
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#64748b", fontSize: 10 },
      },
      series: [
        {
          name: "Action Types",
          type: "pie",
          radius: ["42%", "70%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              formatter: "{b}\n{c}",
            },
          },
          data:
            actionData.length > 0 && actionData.some((d) => d.value > 0)
              ? actionData
              : [{ name: "No Operations", value: 0 }],
        },
      ],
      color: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#64748b"],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [summary.by_action]);

  // 4. Success vs Failure Chart
  useEffect(() => {
    if (!statusChartRef.current) return;
    const chart = echarts.init(statusChartRef.current);

    const successCount = Number(summary.successful_actions ?? 0);
    const failedCount = Number(summary.failed_actions ?? 0);
    const total = successCount + failedCount;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : "100.0";

    const option = {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(16, 185, 129, 0.3)",
        borderWidth: 1,
        padding: 10,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params) => {
          if (!params) return "";
          return `${params.name}: <b>${formatNumber(params.value)}</b> (${params.percent || 0}%)`;
        },
      },
      legend: {
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#64748b", fontSize: 10 },
      },
      series: [
        {
          name: "Status",
          type: "pie",
          radius: ["55%", "78%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: "center",
            formatter: () => `{rate|${successRate}%}\n{sub|Success Rate}`,
            rich: {
              rate: {
                fontSize: 18,
                fontWeight: "900",
                color: "#0f172a",
                lineHeight: 24,
              },
              sub: {
                fontSize: 10,
                color: "#64748b",
                fontWeight: "600",
              },
            },
          },
          itemStyle: {
            borderRadius: 6,
            borderColor: "#fff",
            borderWidth: 2,
          },
          data: [
            { name: "Success", value: successCount, itemStyle: { color: "#10b981" } },
            { name: "Failed", value: failedCount, itemStyle: { color: "#f43f5e" } },
          ],
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [summary.successful_actions, summary.failed_actions]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <UserNavbar />

      <main className="relative flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link
              to={homePath}
              className="transition hover:text-emerald-700"
            >
              Dashboard
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-emerald-800 font-bold">Activity Logs</span>
          </nav>

          {/* Page Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15 15" />
                  </svg>
                </span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-blue-950">
                    Activity Logs
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                    Review the actions performed by your account across BAS.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={isRefreshing || isLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
              >
                <svg
                  className={`h-4 w-4 text-slate-500 ${isRefreshing ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* KPI Statistics (6 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Total Activities */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {formatNumber(summary.total_activities)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Total logged actions</p>
            </div>

            {/* 2. Successful Actions */}
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Success
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-800">
                {formatNumber(summary.successful_actions)}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-600">Operations completed</p>
            </div>

            {/* 3. Failed Actions */}
            <div className="rounded-2xl border border-rose-100 bg-gradient-to-b from-rose-50/40 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Failed
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-rose-800">
                {formatNumber(summary.failed_actions)}
              </p>
              <p className="mt-0.5 text-[10px] text-rose-500">Action rejections/errors</p>
            </div>

            {/* 4. Reports Generated / Exported */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Reports
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-indigo-900">
                {formatNumber(summary.reports_generated)}
              </p>
              <p className="mt-0.5 text-[10px] text-indigo-600">Generated / exported</p>
            </div>

            {/* 5. Cases Created / Updated */}
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Cases
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {formatNumber(summary.cases_created_updated)}
              </p>
              <p className="mt-0.5 text-[10px] text-blue-600">Created or modified</p>
            </div>

            {/* 6. Login Sessions */}
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-b from-purple-50/40 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                  Sessions
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-purple-950">
                {formatNumber(summary.login_sessions)}
              </p>
              <p className="mt-0.5 text-[10px] text-purple-600">Authenticated logins</p>
            </div>
          </div>

          {/* 4 Analytics Graphs in 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Chart 1: Activity Trend */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-950">Activity Trend Over Time</h3>
                  <p className="text-[11px] text-slate-500">Daily frequency of operations</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Timeline
                </span>
              </div>
              <div ref={trendChartRef} className="mt-2 h-[220px] w-full" />
            </div>

            {/* Chart 2: Activity by Module */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-950">Activity by Module</h3>
                  <p className="text-[11px] text-slate-500">Distribution across system subsystems</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                  Subsystems
                </span>
              </div>
              <div ref={moduleChartRef} className="mt-2 h-[220px] w-full" />
            </div>

            {/* Chart 3: Action Distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-950">Top Action Distribution</h3>
                  <p className="text-[11px] text-slate-500">Breakdown of most performed tasks</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                  Actions
                </span>
              </div>
              <div ref={actionChartRef} className="mt-2 h-[220px] w-full" />
            </div>

            {/* Chart 4: Success vs. Failure */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-950">Execution Reliability</h3>
                  <p className="text-[11px] text-slate-500">Successful completions vs errors</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                  Reliability
                </span>
              </div>
              <div ref={statusChartRef} className="mt-2 h-[220px] w-full" />
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            {/* Date Range Preset Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Date Range:
                </span>
                {DATE_PRESETS.map((preset) => {
                  const isActive = datePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDatePreset(preset.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {(selectedModule || selectedStatus || searchTerm || datePreset !== "all") && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Custom Date Pickers (visible if custom selected) */}
            {datePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">From:</span>
                  <input
                    type="date"
                    value={startDate ? startDate.substring(0, 10) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val ? new Date(`${val}T00:00:00`).toISOString() : "");
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">To:</span>
                  <input
                    type="date"
                    value={endDate ? endDate.substring(0, 10) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEndDate(val ? new Date(`${val}T23:59:59`).toISOString() : "");
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Filters Row: Search + Module + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Search Bar */}
              <div className="sm:col-span-6 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search description, action, or entity..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <svg
                  className="absolute left-3.5 top-3 h-4 w-4 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Module Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {MODULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Activity Log Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {error && (
              <div className="border-b border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="underline font-bold hover:text-rose-900"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                      Date &amp; Time (IST)
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                      Module
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-3.5 min-w-[240px]">
                      Description
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                      Related Entity
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap text-center">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {isLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="h-6 w-6 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span className="font-semibold text-xs">Loading activity logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="9" />
                            <polyline points="12 7 12 12 15 15" />
                          </svg>
                          <p className="text-sm font-bold text-slate-600">No activity logs found</p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            No recorded operations match your current filter criteria or date range.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const modStyle = MODULE_COLORS[log.module] || MODULE_COLORS.GENERAL;
                      const isSuccess = String(log.status || "SUCCESS").toUpperCase() === "SUCCESS";

                      return (
                        <tr
                          key={log.id}
                          className="transition hover:bg-slate-50/80 cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          {/* Timestamp */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {formatIST(log.created_at)}
                          </td>

                          {/* Module Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${modStyle.bg} ${modStyle.text} ${modStyle.border}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${modStyle.dot}`} />
                              {log.module || "GENERAL"}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-bold text-blue-950">
                            {formatOptional(log.action, "UNKNOWN")}
                          </td>

                          {/* Description */}
                          <td className="px-4 py-3 text-slate-700 max-w-md truncate" title={log.description}>
                            {formatOptional(log.description, "—")}
                          </td>

                          {/* Related Entity */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {log.entity_type ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                                {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                SUCCESS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                FAILED
                              </span>
                            )}
                          </td>

                          {/* Inspect Details Button */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  <b className="text-slate-800">
                    {formatNumber(totalCount > 0 ? (page - 1) * pageSize + 1 : 0)}
                  </b>{" "}
                  to{" "}
                  <b className="text-slate-800">
                    {formatNumber(Math.min(page * pageSize, totalCount))}
                  </b>{" "}
                  of <b className="text-slate-800">{formatNumber(totalCount)}</b> entries
                </span>
                <span className="mx-2 text-slate-300">|</span>
                <label className="flex items-center gap-1">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  title="First page"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  Page {formatNumber(page)} of {formatNumber(totalPages)}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  title="Last page"
                >
                  &raquo;
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* DETAIL INSPECTION MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15 15" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-blue-950">
                    Activity Log Details #{formatOptional(selectedLog.id, "—")}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Recorded at {formatIST(selectedLog.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-4 text-xs">
              {/* Primary Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Action
                  </span>
                  <p className="font-mono font-bold text-blue-950 mt-0.5">
                    {formatOptional(selectedLog.action, "—")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Module
                  </span>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {formatOptional(selectedLog.module, "GENERAL")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </span>
                  <p className="mt-0.5">
                    {String(selectedLog.status).toUpperCase() === "SUCCESS" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        SUCCESS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        FAILED
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    User
                  </span>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {selectedLog.user_name || user?.username || "You"} (ID: {formatOptional(selectedLog.user_id, "—")})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    User Role
                  </span>
                  <p className="font-semibold text-slate-700 mt-0.5 uppercase">
                    {formatOptional(selectedLog.user_role || userRole, "—")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    IP Address
                  </span>
                  <p className="font-mono text-slate-700 mt-0.5">
                    {formatOptional(selectedLog.ip_address, "127.0.0.1")}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Event Narrative
                </span>
                <p className="mt-1 rounded-xl border border-slate-200 bg-white p-3 font-medium text-slate-800 leading-relaxed">
                  {formatOptional(selectedLog.description, "No narrative available")}
                </p>
              </div>

              {/* Entity info */}
              {(selectedLog.entity_type || selectedLog.entity_id) && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Record
                  </span>
                  <p className="mt-1 rounded-xl border border-slate-200 bg-white p-3 font-mono text-slate-700">
                    Type: <b className="text-blue-950">{formatOptional(selectedLog.entity_type, "—")}</b>
                    {selectedLog.entity_id && (
                      <span className="ml-3">
                        ID: <b className="text-blue-950">{selectedLog.entity_id}</b>
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Client Device / Browser User-Agent
                  </span>
                  <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 break-all leading-normal">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}

              {/* Raw JSON Details if present */}
              {selectedLog.details && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Raw Telemetry Payload
                  </span>
                  <pre className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-emerald-400">
                    {typeof selectedLog.details === "object"
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : String(selectedLog.details)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  );
}
