import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { formatCurrency, formatNumber } from "../../utils/formatters";

// Premium fintech color palette
const SERIES_PALETTE = [
  { primary: "#10b981", gradientTop: "rgba(16, 185, 129, 0.32)", gradientBottom: "rgba(16, 185, 129, 0.02)" }, // Emerald
  { primary: "#06b6d4", gradientTop: "rgba(6, 182, 212, 0.28)", gradientBottom: "rgba(6, 182, 212, 0.02)" },   // Cyan
  { primary: "#f43f5e", gradientTop: "rgba(244, 63, 94, 0.28)", gradientBottom: "rgba(244, 63, 94, 0.02)" },   // Rose
  { primary: "#f59e0b", gradientTop: "rgba(245, 158, 11, 0.28)", gradientBottom: "rgba(245, 158, 11, 0.02)" }, // Amber
  { primary: "#a855f7", gradientTop: "rgba(168, 85, 247, 0.28)", gradientBottom: "rgba(168, 85, 247, 0.02)" }, // Purple
  { primary: "#3b82f6", gradientTop: "rgba(59, 130, 246, 0.28)", gradientBottom: "rgba(59, 130, 246, 0.02)" }, // Blue
];

export default function TimelineChart({
  chartData = { categories: [], seriesData: {} },
  xAxisTitle = "Date",
  yAxesTitles = [],
  chartType = "area", // 'area' | 'line' | 'bar' | 'scatter'
  isLoading = false,
  error = null,
}) {
  const containerRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { categories = [], seriesData = {} } = chartData;
  const seriesKeys = Object.keys(seriesData);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(containerRef.current, null, {
        renderer: "canvas",
      });
    }

    const chart = chartInstanceRef.current;

    if (seriesKeys.length === 0 || categories.length === 0) {
      chart.clear();
      return;
    }

    // Determine series configurations
    const seriesList = seriesKeys.map((key, idx) => {
      const palette = SERIES_PALETTE[idx % SERIES_PALETTE.length];
      const dataVals = seriesData[key] || [];

      // Detect if this is a debit (make rose) or credit (make emerald)
      let colorPrimary = palette.primary;
      let gradTop = palette.gradientTop;
      let gradBottom = palette.gradientBottom;

      if (/debit|dr|expense|withdrawal/i.test(key)) {
        colorPrimary = "#f43f5e";
        gradTop = "rgba(244, 63, 94, 0.35)";
        gradBottom = "rgba(244, 63, 94, 0.02)";
      } else if (/credit|cr|deposit|income/i.test(key)) {
        colorPrimary = "#10b981";
        gradTop = "rgba(16, 185, 129, 0.35)";
        gradBottom = "rgba(16, 185, 129, 0.02)";
      } else if (/balance|bal/i.test(key)) {
        colorPrimary = "#06b6d4";
        gradTop = "rgba(6, 182, 212, 0.30)";
        gradBottom = "rgba(6, 182, 212, 0.02)";
      }

      const baseSeries = {
        name: key,
        data: dataVals,
        itemStyle: { color: colorPrimary },
        emphasis: {
          focus: "series",
        },
      };

      if (chartType === "bar") {
        return {
          ...baseSeries,
          type: "bar",
          barMaxWidth: 38,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colorPrimary },
              { offset: 1, color: gradBottom },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        };
      }

      if (chartType === "scatter") {
        return {
          ...baseSeries,
          type: "scatter",
          symbolSize: 8,
          itemStyle: {
            color: colorPrimary,
            shadowBlur: 8,
            shadowColor: colorPrimary,
          },
        };
      }

      // Line / Area
      return {
        ...baseSeries,
        type: "line",
        smooth: 0.35,
        symbol: categories.length > 50 ? "none" : "circle",
        symbolSize: 6,
        showSymbol: categories.length <= 40,
        lineStyle: {
          width: 2.5,
          color: colorPrimary,
          shadowColor: colorPrimary,
          shadowBlur: 8,
        },
        areaStyle:
          chartType === "area"
            ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: gradTop },
                  { offset: 1, color: gradBottom },
                ]),
              }
            : undefined,
      };
    });

    const option = {
      backgroundColor: "transparent",
      animationDuration: 600,
      animationEasing: "cubicOut",
      grid: {
        top: 60,
        left: 55,
        right: 35,
        bottom: 80,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: { color: "rgba(16, 185, 129, 0.4)" },
          lineStyle: { color: "rgba(16, 185, 129, 0.5)", width: 1, type: "dashed" },
        },
        backgroundColor: "#031713",
        borderColor: "rgba(16, 185, 129, 0.4)",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const header = `<div style="font-weight: 700; color: #34d399; margin-bottom: 6px; font-family: monospace;">${params[0].axisValueLabel}</div>`;
          const rows = params
            .map((p) => {
              const marker = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};box-shadow: 0 0 6px ${p.color};"></span>`;
              const formattedVal =
                typeof p.value === "number" ? formatCurrency(p.value) : p.value;
              return `<div style="display:flex; justify-content:space-between; gap:16px; margin: 3px 0;">
                <span style="color:#94a3b8;">${marker}${p.seriesName}:</span>
                <span style="font-weight:600; font-family: monospace; color:#f8fafc;">${formattedVal}</span>
              </div>`;
            })
            .join("");
          return header + rows;
        },
      },
      legend: {
        data: seriesKeys,
        top: 10,
        right: 20,
        textStyle: { color: "#94a3b8", fontSize: 11 },
        icon: "circle",
        itemGap: 16,
      },
      xAxis: {
        type: "category",
        data: categories,
        boundaryGap: chartType === "bar",
        axisLine: { lineStyle: { color: "rgba(16, 185, 129, 0.2)" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          rotate: categories.length > 25 ? 30 : 0,
          margin: 12,
        },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (val) => {
            if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
            if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
            if (Math.abs(val) >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
            return `₹${val}`;
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(16, 185, 129, 0.07)",
            type: "dashed",
          },
        },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          show: categories.length > 12,
          start: 0,
          end: 100,
          bottom: 12,
          height: 24,
          borderColor: "rgba(16, 185, 129, 0.2)",
          backgroundColor: "#01120e",
          fillerColor: "rgba(16, 185, 129, 0.15)",
          handleStyle: {
            color: "#10b981",
            borderColor: "#34d399",
          },
          textStyle: { color: "#64748b", fontSize: 9 },
        },
      ],
      series: seriesList,
    };

    chart.setOption(option, true);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [chartData, chartType]);

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#031512]/95 to-[#020e0c]/98 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
      {/* Chart Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-emerald-500/10 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">
            Interactive Timeline & Data Series Chart
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>X: <b className="text-slate-200">{xAxisTitle}</b></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>Y: <b className="text-slate-200">{yAxesTitles.join(", ") || "None"}</b></span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
            Scroll to zoom • Drag to pan
          </span>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020e0c]/80 backdrop-blur-sm rounded-2xl">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-400 border-t-transparent" />
          <span className="text-xs text-emerald-300 font-mono mt-2">Computing Series & Aggregations...</span>
        </div>
      )}

      {/* Empty State */}
      {seriesKeys.length === 0 && !isLoading && (
        <div className="h-[420px] flex flex-col items-center justify-center text-center p-6">
          <div className="h-14 w-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center text-emerald-400 text-2xl mb-3">
            📊
          </div>
          <h4 className="text-base font-bold text-white">No Metric Series Selected</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Please select at least one numeric Y-axis column in the Report Builder above to generate the visualization.
          </p>
        </div>
      )}

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-[440px] sm:h-[480px] transition-opacity duration-300 ${
          seriesKeys.length === 0 ? "hidden" : "block"
        }`}
      />
    </div>
  );
}
