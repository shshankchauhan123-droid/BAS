import React, { useEffect, useRef, useState, useMemo } from "react";
import * as echarts from "echarts";
import { formatFinancialValue } from "../../utils/chartFormatter";

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function NcrpSankeyCard({
  title,
  subtitle,
  badgeText,
  badgeColor = "emerald",
  nodes = [],
  links = [],
  metricMode = "transaction", // "transaction" | "disputed"
  showMetricToggle = false,
  onMetricToggle,
  themeColor = "emerald", // "emerald" | "amber"
  onSelectLink,
  onSelectNode,
  selectedLinkKey = null,
  selectedNodeId = null,
  isLoading = false,
}) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer color palette
  const layerPalette = useMemo(() => [
    "#059669", // L0 / Emerald
    "#0284c7", // L1 / Sky
    "#7c3aed", // L2 / Violet
    "#d97706", // L3 / Amber
    "#dc2626", // L4 / Red
    "#ec4899", // L5 / Pink
    "#2563eb", // L6 / Blue
    "#0891b2", // L7 / Cyan
    "#4f46e5", // L8 / Indigo
    "#0d9488", // L9 / Teal
  ], []);

  // Compute total flow value represented in graph
  const totalFlowValue = useMemo(() => {
    return links.reduce((sum, l) => {
      const val = metricMode === "disputed" ? Number(l.disputed_value || 0) : Number(l.value || 0);
      return sum + val;
    }, 0);
  }, [links, metricMode]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }
    const chart = chartInstanceRef.current;

    if (links.length === 0 || nodes.length === 0) {
      chart.clear();
      return;
    }

    // Prepare chart nodes with rich styling and layer-based colors
    const chartNodes = nodes.map((node) => {
      const layerIdx = Math.max(0, Number(node.layer_num || 0)) % layerPalette.length;
      const baseColor = themeColor === "amber" ? "#d97706" : layerPalette[layerIdx];
      const isSelected = selectedNodeId && selectedNodeId === node.id;

      // Extract concise display account
      let displayAcc = node.account || node.name || "Unknown";
      if (displayAcc.length > 24) {
        displayAcc = `${displayAcc.substring(0, 10)}...${displayAcc.substring(displayAcc.length - 8)}`;
      }

      return {
        id: node.id,
        name: node.id, // ECharts connects edges via node name/id
        rawNode: node,
        itemStyle: {
          color: isSelected ? "#ef4444" : baseColor,
          borderColor: isSelected ? "#fca5a5" : "#ffffff",
          borderWidth: isSelected ? 3 : 1.5,
          shadowBlur: isSelected ? 8 : 2,
          shadowColor: isSelected ? "rgba(239, 68, 68, 0.4)" : "rgba(0,0,0,0.1)",
        },
        label: {
          show: true,
          position: "right",
          distance: 6,
          formatter: () => {
            const lPrefix = node.layer_num > 0 ? `L${node.layer_num}: ` : "L0: ";
            const bankShort = node.bank && node.bank !== "Source Bank" && node.bank !== "Destination Bank"
              ? ` (${node.bank.substring(0, 12)})`
              : "";
            return `${lPrefix}${displayAcc}${bankShort}`;
          },
          fontSize: 10,
          fontWeight: isSelected ? "bold" : "600",
          color: isSelected ? "#991b1b" : "#334155",
        },
      };
    });

    // Prepare chart links with width derived from chosen metric
    const chartLinks = links.map((link) => {
      const isDisputedMode = metricMode === "disputed";
      const primaryVal = isDisputedMode ? Number(link.disputed_value || 0) : Number(link.value || 0);
      const isLinkSelected = selectedLinkKey && selectedLinkKey === `${link.source}->${link.target}`;

      // Color coding for disputed vs regular mode
      let edgeColor = "#10b981";
      if (themeColor === "amber" || isDisputedMode) {
        const ratio = link.value > 0 ? (link.disputed_value / link.value) : 1;
        if (ratio >= 0.99) {
          edgeColor = "#f59e0b"; // 100% dispute -> solid amber
        } else if (ratio > 0.01) {
          edgeColor = "#f97316"; // partial dispute -> orange
        } else {
          edgeColor = "#94a3b8"; // 0 dispute -> slate
        }
      } else {
        const layerIdx = Math.max(0, Number(link.layer_num || 1)) % layerPalette.length;
        edgeColor = layerPalette[layerIdx];
      }

      return {
        source: link.source,
        target: link.target,
        // Sankey link width cannot be 0, provide minimal 0.1 for visibility if 0
        value: Math.max(primaryVal, 0.1),
        rawLink: link,
        lineStyle: {
          color: isLinkSelected ? "#dc2626" : edgeColor,
          opacity: isLinkSelected ? 0.85 : 0.42,
          curveness: 0.5,
        },
      };
    });

    const option = {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#cbd5e1",
        borderWidth: 1,
        padding: [10, 14],
        extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 12px; max-width: 380px;",
        formatter: (params) => {
          if (params.dataType === "edge") {
            const raw = params.data.rawLink;
            if (!raw) return "";
            const isFullDispute = raw.value > 0 && Math.abs(raw.value - raw.disputed_value) < 1;
            const disputeRatio = raw.value > 0 ? ((raw.disputed_value / raw.value) * 100).toFixed(1) : 0;

            return `
              <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span>${raw.layer || "Fund Transfer"} • ${raw.sheet || "Money Transfer"}</span>
                <span style="background: ${isFullDispute ? '#fef3c7' : '#e0f2fe'}; color: ${isFullDispute ? '#92400e' : '#0369a1'}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                  ${disputeRatio}% Disputed
                </span>
              </div>
              <div style="font-size: 12px; color: #1e293b; line-height: 1.6; margin-bottom: 8px;">
                <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 2px;">
                  <span style="color: #64748b; font-size: 11px; min-width: 50px;">From:</span>
                  <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${raw.source_acc}</span>
                  <span style="color: #64748b; font-size: 10px;">(${raw.source_bank || 'Source Bank'})</span>
                </div>
                <div style="display: flex; align-items: baseline; gap: 4px;">
                  <span style="color: #64748b; font-size: 11px; min-width: 50px;">To:</span>
                  <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${raw.target_acc}</span>
                  <span style="color: #64748b; font-size: 10px;">(${raw.target_bank || 'Dest Bank'})</span>
                </div>
              </div>
              <div style="background: #f8fafc; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Txn Amount</span>
                  <span style="font-size: 13px; font-weight: 800; color: #059669;">₹${formatIndianCurrency(raw.value)}</span>
                </div>
                <div>
                  <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Disputed Amount</span>
                  <span style="font-size: 13px; font-weight: 800; color: #d97706;">₹${formatIndianCurrency(raw.disputed_value)}</span>
                </div>
              </div>
              ${raw.utr ? `
                <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
                  <span style="color: #94a3b8;">UTR:</span> <span style="font-family: monospace; font-weight: 600;">${raw.utr}</span>
                  ${raw.source_utr && raw.source_utr !== raw.utr ? `<span style="color: #94a3b8; font-size: 10px; display: block;">Src UTR: ${raw.source_utr}</span>` : ""}
                </div>
              ` : ""}
              ${raw.ifsc ? `
                <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">
                  IFSC: <span style="font-family: monospace; font-weight: 600; color: #334155;">${raw.ifsc}</span>
                </div>
              ` : ""}
              ${raw.ref_no ? `
                <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">
                  Ref No: <span style="font-family: monospace; color: #334155;">${raw.ref_no}</span>
                </div>
              ` : ""}
              ${raw.remarks ? `
                <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">
                  Remarks: <span style="color: #334155; font-style: italic;">${raw.remarks}</span>
                </div>
              ` : ""}
              ${raw.ack_no ? `
                <div style="font-size: 10px; color: #64748b;">
                  Ack No: <span style="font-family: monospace;">${raw.ack_no}</span>
                  ${raw.date ? ` • ${raw.date.split("T")[0]}` : ""}
                </div>
              ` : ""}
              ${onSelectLink ? `
              <div style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px; font-size: 10px; color: #6366f1; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                <span>💡 Click link to focus details</span>
              </div>
              ` : ""}
            `;
          } else if (params.dataType === "node") {
            const raw = params.data.rawNode;
            if (!raw) return "";
            return `
              <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
                ${raw.layer || "Account Node"}
              </div>
              <div style="font-size: 13px; font-family: monospace; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                ${raw.account}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                ${raw.bank || "Bank Account"}
              </div>
              <div style="background: #f8fafc; border-radius: 8px; padding: 6px 10px; font-size: 11px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Total Inflow:</span>
                  <span style="font-weight: 700; color: #059669;">₹${formatIndianCurrency(raw.total_in)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Total Outflow:</span>
                  <span style="font-weight: 700; color: #2563eb;">₹${formatIndianCurrency(raw.total_out)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 4px;">
                  <span style="color: #64748b;">Disputed In:</span>
                  <span style="font-weight: 700; color: #d97706;">₹${formatIndianCurrency(raw.disputed_in)}</span>
                </div>
              </div>
              <div style="margin-top: 6px; font-size: 10px; color: #6366f1; font-weight: 700;">
                💡 Click node to search this account in table
              </div>
            `;
          }
          return "";
        },
      },
      series: [
        {
          type: "sankey",
          layout: "none",
          orient: "horizontal",
          emphasis: {
            focus: "adjacency",
          },
          nodeAlign: "justify",
          nodeGap: 14,
          nodeWidth: 16,
          draggable: false,
          left: 20,
          right: 180,
          top: 20,
          bottom: 20,
          data: chartNodes,
          links: chartLinks,
        },
      ],
    };

    chart.setOption(option, true);

    // Click listener
    function handleClick(params) {
      if (params.dataType === "edge" && onSelectLink && params.data.rawLink) {
        onSelectLink(params.data.rawLink);
      } else if (params.dataType === "node" && onSelectNode && params.data.rawNode) {
        onSelectNode(params.data.rawNode);
      }
    }

    chart.off("click");
    chart.on("click", handleClick);

    // Responsive resize listener
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      chart.off("click", handleClick);
      resizeObserver.disconnect();
    };
  }, [
    nodes,
    links,
    metricMode,
    themeColor,
    layerPalette,
    selectedLinkKey,
    selectedNodeId,
    onSelectLink,
    onSelectNode,
  ]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col transition-all ${
        isFullscreen ? "fixed inset-4 z-50 overflow-hidden shadow-2xl" : "min-h-[500px]"
      }`}
    >
      {/* CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                badgeColor === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {badgeText || (themeColor === "amber" ? "Dispute Audit" : "Fund Flow")}
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-[11px] font-bold text-slate-500">
              {links.length} {links.length === 1 ? "Link" : "Links"} • {nodes.length} Accounts
            </span>
          </div>
          <h3 className="mt-1 text-sm font-black text-[#172554] tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {/* Total flow badge */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-right">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {metricMode === "disputed" ? "Total Disputed" : "Total Flow"}
            </span>
            <span
              className={`text-xs font-black ${
                themeColor === "amber" ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              ₹{formatFinancialValue(totalFlowValue)}
            </span>
          </div>

          {/* Metric Toggle Button (Disputed vs Transaction) */}
          {showMetricToggle && onMetricToggle && (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => onMetricToggle("disputed")}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  metricMode === "disputed"
                    ? "bg-amber-500 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Size links by Disputed Amount"
              >
                Disputed
              </button>
              <button
                type="button"
                onClick={() => onMetricToggle("transaction")}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  metricMode === "transaction"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Size links by Transaction Amount"
              >
                Transaction
              </button>
            </div>
          )}

          {/* Fullscreen Expand Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-2xs transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* GRAPH CANVAS OR EMPTY STATE */}
      <div className="relative flex-1 min-h-[380px] w-full mt-2">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <span
              className={`h-8 w-8 animate-spin rounded-full border-2 ${
                themeColor === "amber"
                  ? "border-amber-500/30 border-t-amber-500"
                  : "border-emerald-600/30 border-t-emerald-600"
              }`}
            />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Generating layer-wise flow graph...
            </p>
          </div>
        ) : links.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <h4 className="mt-3 text-xs font-bold text-slate-700">No Money Transfer Flows Found</h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              No inter-account transfer records matched the active filters. Adjust your layer or date criteria.
            </p>
          </div>
        ) : null}

        <div ref={chartRef} className="w-full h-full min-h-[380px]" />
      </div>

      {/* HELPER FOOTER */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Left to right: Sender / Origin Accounts ➔ Destination Mule Accounts
        </span>
        <span className="font-semibold text-slate-500">
          Click any link to highlight transactions
        </span>
      </div>
    </div>
  );
}
