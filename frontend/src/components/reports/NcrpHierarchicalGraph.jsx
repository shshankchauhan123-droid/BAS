import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "0.00";
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

export default function NcrpHierarchicalGraph({
  nodes = [],
  edges = [],
  selectedRoot = null,
  selectedAccount = null,
  expandedAccounts = [],
  onNodeClick,
  onSelectAccount,
  onExpandAccount,
  searchQuery = "",
  bankFilter = "ALL",
  isLoading = false,
  onTerminalClick,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [revealedAccounts, setRevealedAccounts] = useState({});

  const safeNodes = useMemo(() => (Array.isArray(nodes) ? nodes : []), [nodes]);
  const safeEdges = useMemo(() => (Array.isArray(edges) ? edges : []), [edges]);

  // Layout parameters
  const NODE_WIDTH = 270;
  const NODE_HEIGHT = 120;
  const COL_GAP = 140;
  const ROW_GAP = 40;

  // Group nodes by layer
  const layerGroups = useMemo(() => {
    const groups = {};
    safeNodes.forEach((node) => {
      if (!node) return;
      const l = node.layer_num || 1;
      if (!groups[l]) groups[l] = [];
      groups[l].push(node);
    });
    return groups;
  }, [safeNodes]);

  const layerNumbers = useMemo(() => {
    return Object.keys(layerGroups)
      .map(Number)
      .sort((a, b) => a - b);
  }, [layerGroups]);

  // Compute node positions
  const nodePositions = useMemo(() => {
    const positions = {};
    const colWidth = NODE_WIDTH + COL_GAP;

    layerNumbers.forEach((lNum, colIdx) => {
      const colNodes = layerGroups[lNum] || [];
      const totalColHeight =
        colNodes.length * NODE_HEIGHT +
        (colNodes.length - 1) * ROW_GAP;

      colNodes.forEach((node, rowIdx) => {
        const x = colIdx * colWidth + 50;
        const y = rowIdx * (NODE_HEIGHT + ROW_GAP) + 80;

        positions[node.account] = {
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        };
      });
    });

    return positions;
  }, [layerGroups, layerNumbers]);

  // Group edges by sender-receiver pair
  const edgesByPair = useMemo(() => {
    const map = new Map();

    safeEdges.forEach((e) => {
      if (!e) return;

      const k = `${e.source_acc}->${e.target_acc}`;

      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });

    return map;
  }, [safeEdges]);

  // Total canvas bounds
  const canvasBounds = useMemo(() => {
    let maxX = 800;
    let maxY = 600;

    Object.values(nodePositions).forEach((pos) => {
      if (pos.x + pos.width + 100 > maxX) {
        maxX = pos.x + pos.width + 100;
      }

      if (pos.y + pos.height + 100 > maxY) {
        maxY = pos.y + pos.height + 100;
      }
    });

    return {
      width: maxX,
      height: maxY,
    };
  }, [nodePositions]);

  // Pan / Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest(".interactive-node-element")) return;

    setIsDragging(true);

    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    setZoom((prev) =>
      Math.max(0.3, Math.min(2.5, prev * zoomFactor))
    );
  };

  // Canvas zoom controls
  const handleZoomIn = () =>
    setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))));

  const handleZoomOut = () =>
    setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))));

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  const handleFitToScreen = () => {
    if (!containerRef.current) return;

    const { clientWidth, clientHeight } = containerRef.current;

    const scaleX = (clientWidth - 80) / canvasBounds.width;
    const scaleY = (clientHeight - 80) / canvasBounds.height;

    const newZoom = Math.max(
      0.3,
      Math.min(1.2, Math.min(scaleX, scaleY))
    );

    setZoom(newZoom);
    setPan({ x: 40, y: 40 });
  };

  const toggleRevealAccount = (acc, e) => {
    e.stopPropagation();

    setRevealedAccounts((prev) => ({
      ...prev,
      [acc]: !prev[acc],
    }));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[580px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(#CBD5E1 1px, transparent 1px), radial-gradient(#CBD5E1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-xl shadow-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-purple-700 hover:bg-purple-50 transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-purple-700 hover:bg-purple-50 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
          </svg>
        </button>

        <span className="text-[11px] font-mono font-bold px-2 text-[#64748B]">
          {Math.round(zoom * 100)}%
        </span>

        <div className="w-[1px] h-4 bg-slate-200" />

        <button
          type="button"
          onClick={handleFitToScreen}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-purple-700 hover:bg-purple-50 transition-colors"
          title="Fit to Screen"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-purple-700 hover:bg-purple-50 transition-colors"
          title="Reset View"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
            {/* Layer Column Indicator Headers */}
      {layerNumbers.length > 0 && (
        <div
          className="absolute top-3 left-0 pointer-events-none transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, 12px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <div className="relative">
            {layerNumbers.map((lNum, colIdx) => (
              <div
                key={lNum}
                style={{
                  position: "absolute",
                  left: `${colIdx * (NODE_WIDTH + COL_GAP) + 50}px`,
                  width: `${NODE_WIDTH}px`,
                }}
                className="px-3 py-1.5 rounded-xl border border-purple-200/60 bg-white/95 backdrop-blur-sm text-center shadow-sm"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block truncate">
                  {lNum === 1
                    ? "Layer 1 • Starting Account"
                    : `Layer ${lNum} • Forward Layer`}
                </span>

                <span className="text-[10px] text-[#64748B]">
                  {layerGroups[lNum]?.length || 0} Account(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Graph Prompt State */}
      {safeNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
          <div className="h-14 w-14 rounded-2xl bg-purple-100/80 border border-purple-200 text-purple-700 flex items-center justify-center mb-3 shadow-xs">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>

          <h3 className="text-base font-bold text-[#172554] mb-1">
            Select a Starting Account (Layer 1)
          </h3>

          <p className="text-xs text-[#64748B] max-w-md">
            Please choose one of the Layer 1 source accounts from the panel
            above to begin investigating the outward money flow across all 9
            layers.
          </p>
        </div>
      )}

      {/* Main Interactive Zoomable & Pannable Canvas */}
      <div
        className="absolute top-0 left-0 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: `${canvasBounds.width}px`,
          height: `${canvasBounds.height}px`,
        }}
      >
        {/* SVG Bezier Edges Layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasBounds.width}
          height={canvasBounds.height}
        >
          <defs>
            <marker
              id="arrowhead-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1.5 L 8 5 L 0 8.5 z"
                fill="#94A3B8"
              />
            </marker>

            <marker
              id="arrowhead-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1.5 L 8 5 L 0 8.5 z"
                fill="#7C3AED"
              />
            </marker>
          </defs>

          {safeEdges.map((edge) => {
            const srcPos = nodePositions[edge.source_acc];
            const destPos = nodePositions[edge.target_acc];

            if (!srcPos || !destPos) return null;

            const pairEdges =
              edgesByPair.get(
                `${edge.source_acc}->${edge.target_acc}`
              ) || [edge];

            const totalInPair = pairEdges.length;

            const indexInPair = pairEdges.findIndex(
              (e) => e.id === edge.id
            );

            const curveOffset =
              totalInPair > 1
                ? (indexInPair - (totalInPair - 1) / 2) * 36
                : 0;

            const startX = srcPos.x + srcPos.width;
            const startY = srcPos.y + srcPos.height / 2;

            const endX = destPos.x;
            const endY = destPos.y + destPos.height / 2;

            const dx = endX - startX;

            const cp1X = startX + dx * 0.45;
            const cp1Y = startY + curveOffset * 0.75;

            const cp2X = endX - dx * 0.45;
            const cp2Y = endY + curveOffset * 0.75;

            const pathD = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

            const isActive =
              hoveredNode === edge.source_acc ||
              hoveredNode === edge.target_acc;

            // Midpoint coordinates for amount badge
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2 + curveOffset;

            return (
              <g key={edge.id} className="pointer-events-auto">
                {/* Visible curved transfer line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isActive ? "#7C3AED" : "#94A3B8"}
                  strokeWidth={isActive ? 2.0 : 1.5}
                  markerEnd={
                    isActive
                      ? "url(#arrowhead-active)"
                      : "url(#arrowhead-default)"
                  }
                  className="transition-colors duration-150"
                />

                {/* Permanent Clean Midpoint Amount Label - NO HOVER TOOLTIPS/POPOVERS */}
                <foreignObject
                  x={midX - 60}
                  y={midY - 12}
                  width={120}
                  height={24}
                  className="overflow-visible pointer-events-none"
                >
                  <div className="flex items-center justify-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#CBD5E1] bg-white text-[#172554] shadow-xs select-none whitespace-nowrap">
                      ₹{formatIndianCurrency(edge.amount)}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* HTML ForeignObject / Div Nodes Layer */}
        {safeNodes.map((node) => {
          const pos = nodePositions[node.account];

          if (!pos) return null;

          const isRoot = node.is_source || node.account === selectedRoot;

          const isSelected =
            selectedAccount && node.account === selectedAccount;

          const isExpanded =
            node.is_expanded || expandedAccounts.includes(node.account);

          const isRevealed = !!revealedAccounts[node.account];

          const isHovered = hoveredNode === node.account;

          // Search highlighting
          const matchesSearch =
            searchQuery.trim() &&
            (node.account.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
              node.bank?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
              node.ifsc?.toLowerCase().includes(searchQuery.toLowerCase().trim()));

          return (
            <div
              key={node.id || node.account}
              style={{
                position: "absolute",
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${pos.width}px`,
                height: `${pos.height}px`,
              }}
              onMouseEnter={() => setHoveredNode(node.account)}
              onMouseLeave={() => setHoveredNode(null)}
              className={`interactive-node-element rounded-xl p-3 border flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                matchesSearch
                  ? "ring-2 ring-amber-300 border-amber-400 bg-amber-50/40 shadow-sm"
                  : isSelected
                  ? "ring-2.5 ring-purple-500/80 border-purple-600 bg-purple-50/70 shadow-md"
                  : isHovered
                  ? "border-purple-400 bg-white shadow-md -translate-y-0.5"
                  : isRoot
                  ? "border-purple-300 bg-purple-50/30 shadow-sm"
                  : node.has_hold
                  ? "border-rose-200 bg-rose-50/20 shadow-sm"
                  : "border-[#E2E8F0] bg-white shadow-sm hover:border-purple-300"
              }`}
              onClick={() => {
                if (onNodeClick) {
                  onNodeClick(node.account, node);
                } else if (onSelectAccount) {
                  onSelectAccount(node.account);
                }
              }}
            >
              {/* Top row: Bank name & Layer badge */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-[#172554] truncate max-w-[170px] flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5 text-purple-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>

                  {node.bank || "Bank / FI"}
                </span>

                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md shrink-0 ${
                    isRoot
                      ? "bg-purple-100 text-purple-800"
                      : "bg-slate-100 text-[#64748B]"
                  }`}
                >
                  {node.layer || `Layer ${node.layer_num}`}
                </span>
              </div>

              {/* Middle row: Account Number & Role badge */}
              <div className="my-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#172554] tracking-tight">
                    {isRevealed
                      ? node.account
                      : node.masked_account ||
                        maskAccountNumber(node.account)}
                  </span>

                  <div className="flex items-center gap-0.5">
                    {/* Reveal / Mask Account */}
                    <button
                      type="button"
                      onClick={(e) =>
                        toggleRevealAccount(node.account, e)
                      }
                      className="p-1 rounded-md text-[#94A3B8] hover:text-purple-700 hover:bg-purple-50 transition-colors"
                      title={
                        isRevealed ? "Mask Account" : "Reveal Account"
                      }
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {isRevealed ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        )}
                      </svg>
                    </button>

                    {/* Copy Account Number */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(
                          String(node.account)
                        );
                      }}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-purple-700 hover:bg-purple-50 transition-colors"
                      title="Copy Account Number"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Account Role & Badges */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                      isRoot
                        ? "bg-purple-100 text-purple-700"
                        : node.role?.includes("Sender")
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {node.role || "Account"}
                  </span>

                  {node.has_hold && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700">
                      Hold: ₹{formatIndianCurrency(node.hold_amount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom row: Single-Click Status Bar & Interaction Cue */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[#F1F5F9]">
                <span className="text-[10px] font-bold text-[#172554] flex items-center gap-1 truncate max-w-[150px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${isRoot ? "bg-purple-600" : "bg-emerald-600"}`} />
                  Inflow: ₹{formatIndianCurrency(node.total_in)}
                </span>

                {node.has_outgoing ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-lg border transition-all ${
                      isExpanded
                        ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}
                    title={isExpanded ? "Expanded (Click card to collapse)" : "Click card to expand next layer"}
                  >
                    <span>{isExpanded ? "Expanded" : "Expandable"}</span>
                    <span className="font-mono text-xs leading-none">{isExpanded ? "−" : "+"}</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-lg bg-slate-100 text-[#94A3B8] border border-slate-200"
                    title="Terminal account — No further outgoing transfers recorded"
                  >
                    <span className="h-1 w-1 rounded-full bg-slate-400" />
                    <span>Terminal</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}