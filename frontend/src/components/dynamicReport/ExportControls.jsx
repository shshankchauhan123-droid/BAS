import React from "react";
import * as XLSX from "xlsx";
import { formatCurrency, formatNumber } from "../../utils/formatters";

export default function ExportControls({
  datasetMeta = {},
  filteredRows = [],
  columns = [],
  reportConfig = {},
  kpis = {},
}) {
  const { fileName = "Report" } = datasetMeta;
  const { xAxis, yAxes, aggregation, granularity, chartType } = reportConfig;

  // Export current filtered rows as CSV
  const handleExportCSV = () => {
    if (!filteredRows || filteredRows.length === 0) return;

    // Remove internal properties (__rowId, __date_...)
    const exportableRows = filteredRows.map((r) => {
      const clean = {};
      columns.forEach((col) => {
        clean[col.name] = r[col.name];
      });
      return clean;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportableRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered_Data");

    const cleanBaseName = fileName.replace(/\.[^/.]+$/, "");
    XLSX.writeFile(workbook, `${cleanBaseName}_filtered_report.csv`, {
      bookType: "csv",
    });
  };

  // Export structured JSON report with metrics and metadata
  const handleExportReportJSON = () => {
    const reportPayload = {
      title: "Bank Analysis System - Dynamic Data Report",
      exportedAt: new Date().toISOString(),
      dataset: {
        fileName,
        totalRows: datasetMeta.rowCount,
        filteredRows: filteredRows.length,
        dateRange: datasetMeta.dateRange,
      },
      configuration: {
        xAxis,
        yAxes,
        aggregation,
        granularity,
        chartType,
      },
      kpis,
      dataSample: filteredRows.slice(0, 100).map((r) => {
        const clean = {};
        columns.forEach((c) => {
          clean[c.name] = r[c.name];
        });
        return clean;
      }),
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}_audit_summary.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Report (triggers print styling)
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleExportCSV}
        disabled={filteredRows.length === 0}
        className="px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide border border-emerald-500/30 bg-[#021814] text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/60 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        title="Export filtered data to CSV"
      >
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Export CSV</span>
      </button>

      <button
        type="button"
        onClick={handleExportReportJSON}
        disabled={filteredRows.length === 0}
        className="px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide border border-teal-500/30 bg-[#021814] text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/60 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        title="Export full JSON report with metadata and KPIs"
      >
        <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>Export Report JSON</span>
      </button>

      <button
        type="button"
        onClick={handlePrint}
        className="px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide border border-slate-700 bg-[#021814] text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
        title="Print formatted executive report"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        <span>Print Report</span>
      </button>
    </div>
  );
}
