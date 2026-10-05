import React, { useMemo, useEffect, useRef } from "react";
import * as echarts from "echarts";
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DynamicModeWiseChart({ data, isLoading }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const options = useMemo(() => {
    if (!data || data.length === 0) return null;

    const modes = data.map((d) => d.mode);
    const txCounts = data.map((d) => d.transaction_count);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(6, 20, 17, 0.95)",
        borderColor: "rgba(16, 185, 129, 0.2)",
        borderWidth: 1,
        textStyle: { color: "#e2e8f0" },
        padding: 12,
        formatter: (params) => {
          const idx = params[0].dataIndex;
          const d = data[idx];
          
          return `
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
              Transaction Mode: ${d.mode}
            </div>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px 16px;">
              <span style="color: #94a3b8">Total Transactions:</span>
              <span style="color: #fff; font-weight: bold; text-align: right">${d.transaction_count.toLocaleString()}</span>
              
              <span style="color: #94a3b8">Debit Count:</span>
              <span style="color: #f87171; font-weight: bold; text-align: right">${d.debit_count.toLocaleString()}</span>
              
              <span style="color: #94a3b8">Credit Count:</span>
              <span style="color: #34d399; font-weight: bold; text-align: right">${d.credit_count.toLocaleString()}</span>
              
              <span style="color: #94a3b8">Total Debit:</span>
              <span style="color: #f87171; font-weight: bold; text-align: right">${formatCurrency(d.debit_amount)}</span>
              
              <span style="color: #94a3b8">Total Credit:</span>
              <span style="color: #34d399; font-weight: bold; text-align: right">${formatCurrency(d.credit_amount)}</span>
            </div>
          `;
        },
      },
      grid: {
        top: 40,
        right: 30,
        bottom: 50,
        left: 60,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        name: "Transaction Mode / Channel",
        nameLocation: "middle",
        nameGap: 35,
        nameTextStyle: {
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: "bold",
        },
        data: modes,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        name: "Total Transactions",
        nameTextStyle: {
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: "bold",
          padding: [0, 0, 10, 0],
        },
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" },
        },
        axisLabel: { color: "#94a3b8" },
      },
      series: [
        {
          name: "Transactions",
          type: "bar",
          data: txCounts,
          barWidth: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#10b981" },
              { offset: 1, color: "rgba(16, 185, 129, 0.2)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: "#34d399",
            },
          },
        },
      ],
    };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    if (options) {
      chartInstance.current.setOption(options, true);
    } else {
      chartInstance.current.clear();
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [options]);

  return (
    <div className="relative w-full rounded-2xl border border-white/[0.06] bg-[#061411] p-1">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#061411]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-emerald-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm font-medium text-emerald-400">Loading Report...</span>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div
        ref={chartRef}
        style={{ width: "100%", height: "450px", opacity: isLoading ? 0.3 : 1 }}
      />
    </div>
  );
}
