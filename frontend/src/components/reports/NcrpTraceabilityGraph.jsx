import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

export default function NcrpTraceabilityGraph({
  nodes = [],
  edges = [],
  selectedAccount = null,
  onNodeClick,
  onEdgeClick,
  maskAccounts = true,
  fitTrigger = null,
  isFullscreen = false,
  onToggleFullscreen,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  // In-graph account search state
  const [inGraphSearch, setInGraphSearch] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  const safeNodes = useMemo(() => (Array.isArray(nodes) ? nodes : []), [nodes]);
  const safeEdges = useMemo(() => (Array.isArray(edges) ? edges : []), [edges]);

  // Layout geometry parameters
  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 114;
  const COL_GAP = 120;
  const ROW_GAP = 28;
  const PADDING_LEFT = 50;
  const PADDING_TOP = 75;

  // Group nodes by Layer
  const layerColumns = useMemo(() => {
    const cols = {};
    safeNodes.forEach((node) => {
      const l = Number(node.layer) || 1;
      if (!cols[l]) cols[l] = [];
      cols[l].push(node);
    });
    return cols;
  }, [safeNodes]);

  const layerIndices = useMemo(() => {
    return Object.keys(layerColumns)
      .map(Number)
      .sort((a, b) => a - b);
  }, [layerColumns]);

  // Compute (x, y) coordinates for each node
  const nodePositions = useMemo(() => {
    const pos = {};
    layerIndices.forEach((layerNum, colIdx) => {
      const colNodes = layerColumns[layerNum] || [];
      const x = PADDING_LEFT + colIdx * (NODE_WIDTH + COL_GAP);
      colNodes.forEach((node, rowIdx) => {
        const y = PADDING_TOP + rowIdx * (NODE_HEIGHT + ROW_GAP);
        const nodeId = node.id || node.account;
        pos[nodeId] = { x, y, width: NODE_WIDTH, height: NODE_HEIGHT };
      });
    });
    return pos;
  }, [layerColumns, layerIndices]);

  // Bounding box of the entire graph layout
  const graphBounds = useMemo(() => {
    if (safeNodes.length === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 500, width: 800, height: 500 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    Object.values(nodePositions).forEach(({ x, y }) => {
      minX = Math.min(minX, x - 24);
      maxX = Math.max(maxX, x + NODE_WIDTH + 24);
      minY = Math.min(minY, y - 55); // Include column header strip
      maxY = Math.max(maxY, y + NODE_HEIGHT + 30);
    });

    if (minX === Infinity) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 500, width: 800, height: 500 };
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodePositions, safeNodes.length]);

  // Fit View function: accurately scales and centers the graph in container
  const fitView = useCallback(() => {
    if (!containerRef.current || safeNodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.width <= 0 || rect.height <= 0) return;

    const { minX, maxX, minY, maxY } = graphBounds;
    const paddingX = 48;
    const paddingY = 40;

    const contentWidth = Math.max(maxX - minX + paddingX * 2, 200);
    const contentHeight = Math.max(maxY - minY + paddingY * 2, 200);

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;

    // Use minimum scale to fit both width and height cleanly
    // Allow zooming down to 0.08 so even 15-layer graphs fit without clipping Layer 1
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.08), 1.15);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newPan = {
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    };

    setZoom(newZoom);
    setPan(newPan);
  }, [graphBounds, safeNodes.length]);

  // Recalculate fit on data change or fitTrigger
  useEffect(() => {
    const t = setTimeout(() => {
      fitView();
    }, 40);
    return () => clearTimeout(t);
  }, [fitTrigger, safeNodes.length, fitView, isFullscreen]);

  // ResizeObserver: auto-fit on window resize or fullscreen toggle without re-fitting during user pan/zoom
  useEffect(() => {
    if (!containerRef.current) return;
    let timeoutId;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            fitView();
          }, 60);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => {
      clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [fitView]);

  // Smooth Zooming around center or specified pointer
  const handleZoom = useCallback(
    (factor, originPoint = null) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pX = originPoint ? originPoint.x : rect.width / 2;
      const pY = originPoint ? originPoint.y : rect.height / 2;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * factor, 0.08), 3.0);
        if (nextZoom === prevZoom) return prevZoom;
        setPan((prevPan) => {
          const ratio = nextZoom / prevZoom;
          return {
            x: pX - (pX - prevPan.x) * ratio,
            y: pY - (pY - prevPan.y) * ratio,
          };
        });
        return nextZoom;
      });
    },
    []
  );

  // In-graph search handler: auto-centers on matched node with readable zoom
  const handleInGraphSearch = (val) => {
    setInGraphSearch(val);
    if (!val.trim()) {
      setHighlightedNodeId(null);
      return;
    }
    const q = val.trim().toLowerCase();
    const match = safeNodes.find((n) => {
      const acc = n.account || n.id || "";
      const bnk = n.bank || "";
      const hld = n.holder_name || "";
      return (
        acc.toLowerCase().includes(q) ||
        bnk.toLowerCase().includes(q) ||
        hld.toLowerCase().includes(q)
      );
    });

    if (match) {
      const nodeId = match.id || match.account;
      setHighlightedNodeId(nodeId);
      const pos = nodePositions[nodeId];
      if (pos && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Zoom in to comfortable reading zoom if zoomed way out
        const targetZoom = Math.max(zoom, 0.65);
        setZoom(targetZoom);
        setPan({
          x: rect.width / 2 - (pos.x + NODE_WIDTH / 2) * targetZoom,
          y: rect.height / 2 - (pos.y + NODE_HEIGHT / 2) * targetZoom,
        });
      }
    } else {
      setHighlightedNodeId(null);
    }
  };

  // Drag handlers
  const handleMouseDown = (e) => {
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest(".interactive-node") ||
      e.target.closest(".interactive-edge")
    )
      return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom around mouse pointer
  const handleWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const origin = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    handleZoom(factor, origin);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen ? "h-full flex-1" : "h-[640px] lg:h-[700px]"
      } min-w-0 min-h-0 bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl overflow-hidden select-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Top Left Toolbar: In-Graph Search & Node Count */}
      <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={inGraphSearch}
            onChange={(e) => handleInGraphSearch(e.target.value)}
            placeholder="Search account in graph..."
            className="w-52 sm:w-64 h-8 pl-8 pr-7 bg-white/95 backdrop-blur-md border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172554] shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {inGraphSearch && (
            <button
              type="button"
              onClick={() => handleInGraphSearch("")}
              className="absolute right-2 top-2 text-xs text-[#94A3B8] hover:text-[#334155]"
            >
              ✕
            </button>
          )}
        </div>

        <div className="hidden sm:flex bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-[10px] font-mono text-[#64748B] shadow-sm">
          {safeNodes.length} nodes • {safeEdges.length} transfers
        </div>
      </div>

      {/* Top Right Controls Toolbar: Zoom, Fit, Reset, Fullscreen */}
      <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-[#CBD5E1] shadow-md">
        <button
          type="button"
          onClick={() => handleZoom(1.25)}
          title="Zoom In"
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-[#334155] font-bold text-base transition-colors"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom(0.8)}
          title="Zoom Out"
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-[#334155] font-bold text-base transition-colors"
        >
          –
        </button>
        <span className="text-[11px] font-mono font-bold px-1.5 text-[#64748B] min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <div className="h-5 w-[1px] bg-[#E2E8F0] mx-0.5" />
        <button
          type="button"
          onClick={fitView}
          title="Fit entire graph to screen"
          className="px-2.5 h-8 flex items-center gap-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-[#334155] transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          Fit
        </button>
        <button
          type="button"
          onClick={fitView}
          title="Reset to Initial View"
          className="px-2.5 h-8 flex items-center rounded-lg hover:bg-slate-100 text-xs font-semibold text-[#64748B] transition-colors"
        >
          Reset
        </button>

        {onToggleFullscreen && (
          <>
            <div className="h-5 w-[1px] bg-[#E2E8F0] mx-0.5" />
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
              className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-[#334155] transition-colors"
            >
              <svg className="w-4 h-4 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={
                    isFullscreen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  }
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-3.5 left-3.5 z-20 hidden md:flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#CBD5E1] shadow-md text-[11px] text-[#475569]">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-blue-600 rounded" />
          <span className="font-semibold text-blue-900">Confirmed (Solid)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-b-2 border-dashed border-amber-500" />
          <span className="font-semibold text-amber-900">Possible (Dashed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-b-2 border-dotted border-rose-500" />
          <span className="font-semibold text-rose-900">Unverified (Dotted)</span>
        </div>
        <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span className="font-semibold text-slate-800">Starting Account</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
          <span className="font-semibold text-slate-800">Terminal Endpoint</span>
        </div>
      </div>

      {/* SVG Canvas: occupies 100% of container, transform applied to inner <g> */}
      <svg
        className="w-full h-full min-w-0 min-h-0 block"
        style={{ overflow: "hidden" }}
      >
        <defs>
          {/* Arrow markers */}
          <marker
            id="arrow-confirmed"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B82F6" />
          </marker>
          <marker
            id="arrow-possible"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
          </marker>
          <marker
            id="arrow-unverified"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
          </marker>
        </defs>

        {/* Transformed Content Group: All nodes, edges, and columns scale & translate here */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Layer Background Columns & Headers */}
          {layerIndices.map((layerNum, colIdx) => {
            const colX = PADDING_LEFT + colIdx * (NODE_WIDTH + COL_GAP);
            const colNodes = layerColumns[layerNum] || [];
            const colHeight = Math.max(
              620,
              colNodes.length * (NODE_HEIGHT + ROW_GAP) + PADDING_TOP + 40
            );

            return (
              <g key={`layer-col-${layerNum}`}>
                {/* Column background strip */}
                <rect
                  x={colX - 16}
                  y={16}
                  width={NODE_WIDTH + 32}
                  height={colHeight}
                  fill="#F1F5F9"
                  fillOpacity="0.5"
                  rx="18"
                />

                {/* Column Header Card */}
                <g transform={`translate(${colX - 8}, 22)`}>
                  <rect
                    width={NODE_WIDTH + 16}
                    height="38"
                    rx="12"
                    fill="#FFFFFF"
                    stroke="#CBD5E1"
                    strokeWidth="1.2"
                    filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.05))"
                  />
                  <text
                    x={(NODE_WIDTH + 16) / 2}
                    y="18"
                    textAnchor="middle"
                    className="text-[11px] font-black fill-[#1E293B] uppercase tracking-wider"
                  >
                    {layerNum === 1 ? "Layer 1 • Source" : `Layer ${layerNum}`}
                  </text>
                  <text
                    x={(NODE_WIDTH + 16) / 2}
                    y="30"
                    textAnchor="middle"
                    className="text-[9.5px] font-semibold fill-[#64748B]"
                  >
                    {colNodes.length} Account{colNodes.length !== 1 ? "s" : ""}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. Directed Edges Layer (Rendered BEFORE nodes so edges stay BEHIND node cards) */}
          <g className="edges-layer">
            {safeEdges.map((edge) => {
              const srcId = edge.source;
              const dstId = edge.target;
              const srcPos = nodePositions[srcId];
              const dstPos = nodePositions[dstId];
              if (!srcPos || !dstPos) return null;

              const isForward = srcPos.x < dstPos.x;
              let pathD = "";
              let startX = 0;
              let startY = 0;
              let endX = 0;
              let endY = 0;

              if (isForward) {
                // Forward transfer from Layer N to Layer N+k
                startX = srcPos.x + NODE_WIDTH;
                startY = srcPos.y + NODE_HEIGHT / 2;
                endX = dstPos.x;
                endY = dstPos.y + NODE_HEIGHT / 2;
                const dx = Math.max(36, (endX - startX) * 0.48);
                pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
              } else {
                // Backward / Cycle transfer (route above or below)
                const isAbove = srcPos.y > dstPos.y;
                startX = srcPos.x + NODE_WIDTH / 2;
                startY = isAbove ? srcPos.y : srcPos.y + NODE_HEIGHT;
                endX = dstPos.x + NODE_WIDTH / 2;
                endY = isAbove ? dstPos.y : dstPos.y + NODE_HEIGHT;
                const arcOffset = isAbove ? -50 : 50;
                pathD = `M ${startX} ${startY} C ${startX} ${startY + arcOffset}, ${endX} ${endY + arcOffset}, ${endX} ${endY}`;
              }

              const isConfirmed = edge.status === "CONFIRMED";
              const isPossible = edge.status === "POSSIBLE";
              const strokeColor = isConfirmed ? "#3B82F6" : isPossible ? "#F59E0B" : "#EF4444";
              const markerId = isConfirmed
                ? "url(#arrow-confirmed)"
                : isPossible
                ? "url(#arrow-possible)"
                : "url(#arrow-unverified)";
              const strokeDash = isConfirmed ? "none" : isPossible ? "6,4" : "3,3";
              const isHovered = hoveredEdge?.id === edge.id;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g
                  key={edge.id || `${srcId}-${dstId}-${edge.amount}`}
                  className="interactive-edge cursor-pointer"
                  onClick={() => onEdgeClick && onEdgeClick(edge)}
                  onMouseEnter={() => setHoveredEdge(edge)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {/* Thick transparent hit-area for effortless clicking */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth="20" />

                  {/* Transfer curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 3.5 : 2}
                    strokeDasharray={strokeDash}
                    markerEnd={markerId}
                    className="transition-all duration-150"
                  />

                  {/* Amount Pill along midpoint */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-48"
                      y="-11"
                      width="96"
                      height="22"
                      rx="11"
                      fill="#FFFFFF"
                      stroke={strokeColor}
                      strokeWidth="1.3"
                      filter="drop-shadow(0 1px 3px rgb(0 0 0 / 0.12))"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      className="text-[9.5px] font-black fill-[#0F172A]"
                    >
                      ₹{formatIndianCurrency(edge.amount)}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* 3. Account Nodes Layer */}
          <g className="nodes-layer">
            {safeNodes.map((node) => {
              const nodeId = node.id || node.account;
              const pos = nodePositions[nodeId];
              if (!pos) return null;

              const isSelected = selectedAccount === nodeId;
              const isHovered = hoveredNode?.id === nodeId || hoveredNode?.account === nodeId;
              const isMatched = highlightedNodeId === nodeId;
              const isTerminal = node.is_terminal || node.role === "Terminal Account";
              const isStarting =
                node.role === "Starting Account" ||
                node.role === "STARTING_SUSPECT" ||
                (!node.total_incoming && node.total_outgoing > 0);
              const isTraceGap = node.role === "Trace Gap";
              const isUnverified = node.role === "Unverified Account";

              // Role styling
              let roleLabel = "Intermediary Account";
              let roleBadgeClass = "bg-blue-100 text-blue-800 border-blue-200";
              let borderStroke = "#CBD5E1";
              let strokeWidth = 1.4;
              let bgColor = "#FFFFFF";

              if (isStarting) {
                roleLabel = "Starting Account";
                roleBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
                borderStroke = "#059669";
                bgColor = "#F0FDF4";
              } else if (isTerminal) {
                roleLabel = "Terminal Account";
                roleBadgeClass = "bg-rose-100 text-rose-800 border-rose-300";
                borderStroke = "#E11D48";
                strokeWidth = 2.2;
                bgColor = "#FFF1F2";
              } else if (isTraceGap) {
                roleLabel = "Trace Gap";
                roleBadgeClass = "bg-amber-100 text-amber-800 border-amber-300";
                borderStroke = "#D97706";
                bgColor = "#FFFBEB";
              } else if (isUnverified) {
                roleLabel = "Unverified Account";
                roleBadgeClass = "bg-purple-100 text-purple-800 border-purple-300";
                borderStroke = "#7C3AED";
                bgColor = "#FAF5FF";
              }

              if (isSelected) {
                borderStroke = "#2563EB";
                strokeWidth = 3;
                bgColor = "#EFF6FF";
              }

              if (isMatched) {
                borderStroke = "#4F46E5";
                strokeWidth = 3.5;
              }

              return (
                <g
                  key={nodeId}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="interactive-node cursor-pointer group"
                  onClick={() => onNodeClick && onNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Node Card Box */}
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="14"
                    fill={bgColor}
                    stroke={borderStroke}
                    strokeWidth={strokeWidth}
                    filter={
                      isSelected || isHovered || isMatched
                        ? "drop-shadow(0 8px 16px rgb(0 0 0 / 0.15))"
                        : "drop-shadow(0 2px 4px rgb(0 0 0 / 0.05))"
                    }
                    className="transition-all duration-150"
                  />

                  {/* Header: Bank Name + Role Badge */}
                  <foreignObject x="10" y="8" width={NODE_WIDTH - 20} height="28">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[11px] font-black text-[#1E293B] truncate max-w-[125px]"
                        title={node.bank}
                      >
                        {node.bank || "Unknown Bank"}
                      </span>
                      <span
                        className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border ${roleBadgeClass} truncate max-w-[105px]`}
                        title={roleLabel}
                      >
                        {roleLabel}
                      </span>
                    </div>
                  </foreignObject>

                  {/* Account Number */}
                  <foreignObject x="10" y="36" width={NODE_WIDTH - 20} height="22">
                    <div className="font-mono text-xs font-bold text-[#0F172A] tracking-tight">
                      {maskAccounts ? maskAccountNumber(node.account || nodeId) : node.account || nodeId}
                    </div>
                  </foreignObject>

                  {/* Financial Metrics: Incoming vs Outgoing */}
                  <foreignObject x="10" y="58" width={NODE_WIDTH - 20} height="36">
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#E2E8F0] text-[10px]">
                      <div>
                        <span className="text-[#64748B] block text-[8.5px] uppercase font-semibold">
                          INCOMING
                        </span>
                        <span className="font-bold text-emerald-700 block truncate">
                          ₹{formatIndianCurrency(node.total_incoming)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[8.5px] uppercase font-semibold">
                          OUTGOING
                        </span>
                        <span className="font-bold text-rose-700 block truncate">
                          ₹{formatIndianCurrency(node.total_outgoing)}
                        </span>
                      </div>
                    </div>
                  </foreignObject>

                  {/* Terminal or Lien status tag */}
                  {isTerminal && (
                    <foreignObject x="10" y={NODE_HEIGHT - 20} width={NODE_WIDTH - 20} height="16">
                      <div className="text-[8.5px] font-bold text-rose-600 truncate flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        {node.held_amount > 0 ? (
                          <span className="truncate">Lien: ₹{formatIndianCurrency(node.held_amount)}</span>
                        ) : (
                          <span className="truncate">Unresolved: ₹{formatIndianCurrency(node.unresolved_amount)}</span>
                        )}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
