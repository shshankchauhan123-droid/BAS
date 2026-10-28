import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

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
 * Interactive Layer-Wise Money Flow Chart
 * Bipartite Left-to-Right layout: Senders (Left) -> Receivers (Right)
 *
 * Guarantees:
 * - Permanent canvas DOM element (never unmounted during loading/layer-switches)
 * - Automatic resize handling via ResizeObserver and requestAnimationFrame
 * - Complete, untruncated account numbers visible on both sender and receiver sides
 * - Sufficient 220px margins on left and right so no account label is cut off
 * - Proportional ribbon thickness with metric toggle (Transfer vs. Disputed)
 * - Zoom in, Zoom out, and Reset (Fit to View) controls
 */
export default function NcrpLayerFlowChart({
  layerName = "Layer 1",
  senders = [],
  receivers = [],
  links = [],
  selectedSender = null,
  selectedReceiver = null,
  selectedLink = null,
  onSelectSender,
  onSelectReceiver,
  onSelectLink,
  metricMode = "transaction", // "transaction" | "disputed"
  onMetricToggle,
  isLoading = false,
}) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.0, Number((prev + 0.2).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.6, Number((prev - 0.2).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  // Compute total volume represented in current layer links
  const totalVolume = useMemo(() => {
    return links.reduce((sum, l) => {
      const val = metricMode === "disputed" ? Number(l.disputed_value || 0) : Number(l.value || 0);
      return sum + val;
    }, 0);
  }, [links, metricMode]);

  // Clean account string helper
  const cleanAcc = (val) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/^[-_:\s]+/, "").trim();
  };

  // Dynamic canvas dimensions
  const dynamicHeight = useMemo(() => {
    const maxAccounts = Math.max(senders.length, receivers.length, 1);
    // At least 480px, with 56px per account ensuring labels never overlap vertically
    return Math.max(480, Math.round(maxAccounts * 56 * zoomLevel));
  }, [senders.length, receivers.length, zoomLevel]);

  const dynamicWidth = useMemo(() => {
    // Generous width: at least 760px, scales with zoomLevel
    return Math.max(760, Math.round(760 * zoomLevel));
  }, [zoomLevel]);

  // Handle zoom or fullscreen resize
  useEffect(() => {
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      const timer = setTimeout(() => {
        chartInstanceRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [zoomLevel, isFullscreen, dynamicWidth, dynamicHeight]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Main ECharts configuration and update effect
  useEffect(() => {
    if (!chartRef.current) return;

    // Check if an existing instance is already bound to this DOM node
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current, null, {
        renderer: "canvas",
      });
      chartInstanceRef.current = chart;
    } else {
      chartInstanceRef.current = chart;
    }

    // Set up ResizeObserver to keep canvas sized to container
    const resizeObserver = new ResizeObserver(() => {
      if (chart && !chart.isDisposed()) {
        chart.resize();
      }
    });
    resizeObserver.observe(chartRef.current);

    if (links.length === 0 || (senders.length === 0 && receivers.length === 0)) {
      chart.clear();
      return () => {
        resizeObserver.disconnect();
      };
    }

    // Determine active focus for highlighting
    const hasFocus = Boolean(selectedSender || selectedReceiver || selectedLink);

    // Prepare chart nodes with explicit bipartite depth (0 = sender/left, 1 = receiver/right)
    const chartNodes = [];
    const validNodeNames = new Set();

    senders.forEach((s) => {
      const nodeName = `src_${s.account}`;
      validNodeNames.add(nodeName);

      const isSelected = selectedSender && cleanAcc(selectedSender) === cleanAcc(s.account);
      const isConnected = selectedReceiver && links.some(
        (l) => cleanAcc(l.source_acc) === cleanAcc(s.account) && cleanAcc(l.target_acc) === cleanAcc(selectedReceiver)
      );
      const isLinkSource = selectedLink && cleanAcc(selectedLink.source_acc) === cleanAcc(s.account);

      const isNodeActive = isSelected || isConnected || isLinkSource;
      const opacity = hasFocus ? (isNodeActive ? 1.0 : 0.2) : 1.0;

      chartNodes.push({
        id: nodeName,
        name: nodeName,
        rawAccount: String(s.account),
        rawBank: s.bank || "Source Bank",
        role: "sender",
        depth: 0,
        itemStyle: {
          color: isSelected ? "#ef4444" : "#0284c7",
          borderColor: isSelected ? "#fca5a5" : "#ffffff",
          borderWidth: isSelected ? 3 : 1.5,
          shadowBlur: isSelected ? 8 : 2,
          shadowColor: isSelected ? "rgba(239, 68, 68, 0.4)" : "rgba(0,0,0,0.1)",
          opacity,
        },
        label: {
          show: true,
          position: "left",
          distance: 14,
          align: "right",
          formatter: () => {
            const bank = s.bank && s.bank !== "Source Bank" && s.bank !== "Destination Bank"
              ? `\n{bank|${s.bank.length > 22 ? s.bank.slice(0, 20) + '..' : s.bank}}`
              : "";
            return `{acc|${s.account}}${bank}`;
          },
          rich: {
            acc: {
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: isSelected ? "bold" : "600",
              color: isSelected ? "#dc2626" : hasFocus && !isNodeActive ? "#94a3b8" : "#0f172a",
              lineHeight: 16,
            },
            bank: {
              fontSize: 9,
              color: hasFocus && !isNodeActive ? "#cbd5e1" : "#64748b",
              lineHeight: 13,
            },
          },
        },
      });
    });

    receivers.forEach((r) => {
      const nodeName = `dest_${r.account}`;
      validNodeNames.add(nodeName);

      const isSelected = selectedReceiver && cleanAcc(selectedReceiver) === cleanAcc(r.account);
      const isConnected = selectedSender && links.some(
        (l) => cleanAcc(l.target_acc) === cleanAcc(r.account) && cleanAcc(l.source_acc) === cleanAcc(selectedSender)
      );
      const isLinkTarget = selectedLink && cleanAcc(selectedLink.target_acc) === cleanAcc(r.account);

      const isNodeActive = isSelected || isConnected || isLinkTarget;
      const opacity = hasFocus ? (isNodeActive ? 1.0 : 0.2) : 1.0;

      chartNodes.push({
        id: nodeName,
        name: nodeName,
        rawAccount: String(r.account),
        rawBank: r.bank || "Destination Bank",
        role: "receiver",
        depth: 1,
        itemStyle: {
          color: isSelected ? "#ef4444" : "#7c3aed",
          borderColor: isSelected ? "#fca5a5" : "#ffffff",
          borderWidth: isSelected ? 3 : 1.5,
          shadowBlur: isSelected ? 8 : 2,
          shadowColor: isSelected ? "rgba(239, 68, 68, 0.4)" : "rgba(0,0,0,0.1)",
          opacity,
        },
        label: {
          show: true,
          position: "right",
          distance: 14,
          align: "left",
          formatter: () => {
            const bank = r.bank && r.bank !== "Source Bank" && r.bank !== "Destination Bank"
              ? `\n{bank|${r.bank.length > 22 ? r.bank.slice(0, 20) + '..' : r.bank}}`
              : "";
            return `{acc|${r.account}}${bank}`;
          },
          rich: {
            acc: {
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: isSelected ? "bold" : "600",
              color: isSelected ? "#dc2626" : hasFocus && !isNodeActive ? "#94a3b8" : "#0f172a",
              lineHeight: 16,
            },
            bank: {
              fontSize: 9,
              color: hasFocus && !isNodeActive ? "#cbd5e1" : "#64748b",
              lineHeight: 13,
            },
          },
        },
      });
    });

    // Prepare chart links with width proportional to chosen metric
    const chartLinks = [];
    links.forEach((link) => {
      const srcNode = `src_${link.source_acc}`;
      const tgtNode = `dest_${link.target_acc}`;

      if (!validNodeNames.has(srcNode) || !validNodeNames.has(tgtNode)) {
        return;
      }

      const isDisputedMode = metricMode === "disputed";
      const primaryVal = isDisputedMode ? Number(link.disputed_value || 0) : Number(link.value || 0);

      const isDirectSelected = selectedLink &&
        cleanAcc(selectedLink.source_acc) === cleanAcc(link.source_acc) &&
        cleanAcc(selectedLink.target_acc) === cleanAcc(link.target_acc);

      const isSenderMatch = selectedSender && cleanAcc(selectedSender) === cleanAcc(link.source_acc);
      const isReceiverMatch = selectedReceiver && cleanAcc(selectedReceiver) === cleanAcc(link.target_acc);

      const isLinkActive = isDirectSelected || isSenderMatch || isReceiverMatch;
      const opacity = hasFocus ? (isLinkActive ? 0.9 : 0.08) : 0.45;

      // Color coding: amber if high dispute ratio, emerald otherwise, red if direct selected
      let edgeColor = "#059669";
      if (isDirectSelected) {
        edgeColor = "#dc2626";
      } else if (isDisputedMode || (link.value > 0 && link.disputed_value / link.value >= 0.9)) {
        edgeColor = "#d97706";
      } else if (link.disputed_value > 0) {
        edgeColor = "#f59e0b";
      }

      chartLinks.push({
        source: srcNode,
        target: tgtNode,
        value: Math.max(primaryVal, 0.5),
        rawLink: link,
        lineStyle: {
          color: isDirectSelected ? "#dc2626" : edgeColor,
          opacity,
          curveness: 0.5,
        },
      });
    });

    const maxNodeCount = Math.max(senders.length, receivers.length, 1);
    const calculatedGap = Math.max(16, Math.min(30, Math.floor((dynamicHeight - 80) / maxNodeCount)));

    const option = {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#334155",
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 11 },
        extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 12px;",
        formatter: (params) => {
          if (params.dataType === "edge") {
            const raw = params.data.rawLink;
            if (!raw) return "";
            return `
              <div style="font-family: inherit; line-height: 1.5; min-width: 250px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                  <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #38bdf8;">${raw.layer || layerName} Transfer</span>
                  <span style="font-size: 10px; color: #94a3b8;">${raw.tx_count || 1} ${raw.tx_count === 1 ? 'txn' : 'txns'}</span>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="color: #94a3b8; font-size: 10px;">Sender:</span>
                  <span style="font-weight: 700; color: #f8fafc; font-family: monospace;">${raw.source_acc}</span>
                  <span style="font-size: 10px; color: #cbd5e1;">(${raw.source_bank || "Bank"})</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <span style="color: #94a3b8; font-size: 10px;">Receiver:</span>
                  <span style="font-weight: 700; color: #f8fafc; font-family: monospace;">${raw.target_acc}</span>
                  <span style="font-size: 10px; color: #cbd5e1;">(${raw.target_bank || "Bank"})</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.06); padding: 6px 8px; border-radius: 6px; margin-bottom: 6px;">
                  <div>
                    <div style="font-size: 9px; text-transform: uppercase; color: #94a3b8;">Transfer Amount</div>
                    <div style="font-weight: 800; color: #34d399; font-size: 12px;">₹${formatIndianCurrency(raw.value)}</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; text-transform: uppercase; color: #94a3b8;">Disputed Amount</div>
                    <div style="font-weight: 800; color: #fbbf24; font-size: 12px;">₹${formatIndianCurrency(raw.disputed_value)}</div>
                  </div>
                </div>
                ${raw.utr ? `<div style="font-size: 10px; color: #cbd5e1;"><span style="color: #94a3b8;">UTR:</span> <span style="font-family: monospace;">${raw.utr}</span></div>` : ""}
                ${raw.ack_no ? `<div style="font-size: 10px; color: #cbd5e1;"><span style="color: #94a3b8;">Ack No:</span> <span style="font-family: monospace;">${raw.ack_no}</span></div>` : ""}
                ${raw.date ? `<div style="font-size: 10px; color: #cbd5e1;"><span style="color: #94a3b8;">Date:</span> ${raw.date.split("T")[0]}</div>` : ""}
                ${raw.remarks ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-style: italic;">"${raw.remarks}"</div>` : ""}
              </div>
            `;
          } else {
            const rawNode = params.data;
            const isSender = rawNode.role === "sender";
            return `
              <div style="font-family: inherit; line-height: 1.4; min-width: 180px;">
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: ${isSender ? '#38bdf8' : '#c084fc'}; margin-bottom: 4px;">
                  ${isSender ? "Origin / Sender Account" : "Destination / Receiver Account"}
                </div>
                <div style="font-weight: 700; font-size: 12px; font-family: monospace; color: #f8fafc; margin-bottom: 2px;">
                  ${rawNode.rawAccount}
                </div>
                <div style="font-size: 11px; color: #cbd5e1;">${rawNode.rawBank || "Bank/FI"}</div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Click to filter related transactions</div>
              </div>
            `;
          }
        },
      },
      series: [
        {
          type: "sankey",
          layout: "none",
          orient: "horizontal",
          draggable: false,
          nodeWidth: 16,
          nodeGap: calculatedGap,
          left: 220, // 220px margin accommodates complete, untruncated sender account numbers
          right: 220, // 220px margin accommodates complete, untruncated receiver account numbers
          top: 30,
          bottom: 30,
          emphasis: {
            focus: "adjacency",
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.3)",
            },
            lineStyle: {
              opacity: 0.9,
            },
          },
          levels: [
            {
              depth: 0,
              itemStyle: { color: "#0284c7" },
              lineStyle: { color: "source", opacity: 0.45 },
            },
            {
              depth: 1,
              itemStyle: { color: "#7c3aed" },
              lineStyle: { color: "source", opacity: 0.45 },
            },
          ],
          data: chartNodes,
          links: chartLinks,
        },
      ],
    };

    chart.setOption(option, true);

    // Call resize on next frame after setOption to ensure exact dimensions
    const rafId = requestAnimationFrame(() => {
      if (chart && !chart.isDisposed()) {
        chart.resize();
      }
    });

    // Click handler for links and nodes
    const handleClick = (params) => {
      if (params.dataType === "edge" && params.data.rawLink) {
        if (onSelectLink) onSelectLink(params.data.rawLink);
      } else if (params.dataType === "node") {
        if (params.data.role === "sender" && onSelectSender) {
          onSelectSender(params.data.rawAccount);
        } else if (params.data.role === "receiver" && onSelectReceiver) {
          onSelectReceiver(params.data.rawAccount);
        }
      }
    };

    chart.off("click");
    chart.on("click", handleClick);

    const handleWindowResize = () => {
      if (chart && !chart.isDisposed()) {
        chart.resize();
      }
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      chart.off("click");
    };
  }, [
    senders,
    receivers,
    links,
    selectedSender,
    selectedReceiver,
    selectedLink,
    metricMode,
    layerName,
    dynamicHeight,
    dynamicWidth,
    onSelectSender,
    onSelectReceiver,
    onSelectLink,
  ]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all flex flex-col ${
        isFullscreen ? "fixed inset-4 z-50 overflow-hidden shadow-2xl" : "h-full"
      }`}
    >
      {/* Chart Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black">
            ➔
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {layerName} Money Flow Connections
            </h3>
            <p className="text-[11px] text-slate-500">
              {links.length} active transfer paths • Total: ₹{formatIndianCurrency(totalVolume)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {/* Zoom / Pan Controls */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.6}
              className="rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 transition"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 transition"
              title="Fit to View (Reset Zoom to 100%)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.0}
              className="rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 transition"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Metric Mode Toggle */}
          {onMetricToggle && (
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => onMetricToggle("transaction")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  metricMode === "transaction"
                    ? "bg-white text-emerald-800 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Transfer Amt
              </button>
              <button
                type="button"
                onClick={() => onMetricToggle("disputed")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  metricMode === "disputed"
                    ? "bg-amber-600 text-white shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Disputed Amt
              </button>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            title={isFullscreen ? "Exit Fullscreen" : "Expand Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Flow Column Headers */}
      <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/70 rounded-xl mb-2">
        <span className="flex items-center gap-1.5 text-blue-700 font-extrabold">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          Sender Accounts (Origin)
        </span>
        <span className="text-slate-300">Transfer Flow ➔</span>
        <span className="flex items-center gap-1.5 text-indigo-700 font-extrabold">
          <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
          Receiver Accounts (Beneficiary)
        </span>
      </div>

      {/* Chart Canvas Area with permanent DOM container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-[440px] max-h-[640px] overflow-auto relative rounded-xl bg-slate-50/30 p-2 border border-slate-100"
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/85 backdrop-blur-xs gap-3">
            <span className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-600">
              Generating layer-wise money flow visualization...
            </p>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoading && links.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 bg-white/95">
            <svg className="h-10 w-10 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-bold text-slate-700">No Money Transfers in {layerName}</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              No eligible sender-to-receiver money transfers were detected for this layer.
            </p>
          </div>
        )}

        {/* Canvas Wrapper - ALWAYS in the DOM */}
        <div
          style={{
            width: `${dynamicWidth}px`,
            minWidth: "100%",
            height: `${dynamicHeight}px`,
            position: "relative",
          }}
        >
          <div
            ref={chartRef}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {/* Chart Footer Tip */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>💡 Click any ribbon or node to inspect details on the right</span>
        <span>Complete account numbers visible • Ribbon thickness proportional to volume</span>
      </div>
    </div>
  );
}
