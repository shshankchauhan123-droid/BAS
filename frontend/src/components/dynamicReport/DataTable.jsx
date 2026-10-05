import React, { useMemo, useState } from "react";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";

export default function DataTable({
  rows = [],
  columns = [],
  datasetMeta = {},
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' | 'desc'
  const [visibleColumns, setVisibleColumns] = useState(() =>
    columns.map((c) => c.name)
  );
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  // Update visible columns if dataset changes
  React.useEffect(() => {
    setVisibleColumns(columns.map((c) => c.name));
    setCurrentPage(1);
  }, [datasetMeta.id]);

  // Handle header click sort
  const handleSort = (colName) => {
    if (sortField === colName) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(colName);
      setSortDirection("asc");
    }
  };

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortField) return rows;

    const colMeta = columns.find((c) => c.name === sortField);
    const isNum = colMeta?.isNumeric;
    const isDate = colMeta?.isDate;

    return [...rows].sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      if (va === null || va === undefined || va === "") return 1;
      if (vb === null || vb === undefined || vb === "") return -1;

      if (isNum) {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return sortDirection === "asc" ? va - vb : vb - va;
      }

      if (isDate) {
        const da = a[`__date_${sortField}`] || new Date(va);
        const db = b[`__date_${sortField}`] || new Date(vb);
        return sortDirection === "asc" ? da - db : db - da;
      }

      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sortDirection === "asc") {
        return sa.localeCompare(sb);
      }
      return sb.localeCompare(sa);
    });
  }, [rows, sortField, sortDirection, columns]);

  // Pagination slicing
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Toggle single column visibility
  const toggleColumn = (colName) => {
    if (visibleColumns.includes(colName)) {
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter((c) => c !== colName));
      }
    } else {
      setVisibleColumns([...visibleColumns, colName]);
    }
  };

  // Filter columns list
  const activeColDefs = columns.filter((c) => visibleColumns.includes(c.name));

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#031512]/95 to-[#020e0c]/98 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-3 border-b border-emerald-500/10 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">
            Synchronized Transactions / Data Table
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
            {rows.length.toLocaleString()} matching records
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-[#021411] text-emerald-300 text-xs font-semibold hover:bg-emerald-500/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>Columns ({activeColDefs.length}/{columns.length})</span>
            </button>

            {columnDrawerOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-emerald-500/30 bg-[#021310] p-3 shadow-2xl z-30 space-y-1.5 max-h-72 overflow-y-auto">
                <div className="text-[10px] uppercase font-bold text-slate-400 pb-1 border-b border-emerald-500/10">
                  Toggle Columns
                </div>
                {columns.map((c) => (
                  <label
                    key={c.name}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(c.name)}
                      onChange={() => toggleColumn(c.name)}
                      className="rounded accent-emerald-500 cursor-pointer"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Rows Per Page */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#021411] border border-emerald-500/30 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none cursor-pointer font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table with Sticky Header & Horizontal Scroll */}
      <div className="w-full overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#010e0b] max-h-[520px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-[#031814] shadow-md">
            <tr className="border-b border-emerald-500/25 text-slate-300">
              <th className="py-3 px-3 text-[11px] font-bold text-slate-400 w-12 text-center">
                #
              </th>
              {activeColDefs.map((col) => {
                const isSorted = sortField === col.name;
                return (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="py-3 px-3 font-semibold text-slate-300 cursor-pointer hover:bg-emerald-500/10 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-emerald-500/10 text-slate-300">
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColDefs.length + 1}
                  className="py-12 text-center text-slate-400"
                >
                  No matching records found in this date/filter range.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={row.__rowId || idx}
                    className="hover:bg-emerald-500/[0.04] transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {globalIndex}
                    </td>
                    {activeColDefs.map((col) => {
                      const val = row[col.name];

                      // Custom styling for debit / credit / balance
                      let formattedNode = String(val !== null && val !== undefined ? val : "-");

                      if (col.type === "currency" || col.type === "number") {
                        if (/debit|dr|withdrawal|expense/i.test(col.name)) {
                          formattedNode = (
                            <span className="font-mono text-rose-300 font-semibold">
                              {val ? formatCurrency(val) : "-"}
                            </span>
                          );
                        } else if (/credit|cr|deposit|income/i.test(col.name)) {
                          formattedNode = (
                            <span className="font-mono text-emerald-400 font-semibold">
                              {val ? formatCurrency(val) : "-"}
                            </span>
                          );
                        } else if (/balance|bal/i.test(col.name)) {
                          formattedNode = (
                            <span className="font-mono text-teal-300 font-semibold">
                              {val ? formatCurrency(val) : "-"}
                            </span>
                          );
                        } else {
                          formattedNode = (
                            <span className="font-mono text-slate-200">
                              {val !== null && val !== undefined ? formatNumber(val) : "-"}
                            </span>
                          );
                        }
                      } else if (col.type === "date") {
                        formattedNode = (
                          <span className="font-mono text-slate-300">
                            {val ? formatDate(val) : "-"}
                          </span>
                        );
                      }

                      return (
                        <td
                          key={col.name}
                          className="py-2.5 px-3 whitespace-nowrap text-xs max-w-xs truncate"
                          title={val !== null && val !== undefined ? String(val) : ""}
                        >
                          {formattedNode}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-3 border-t border-emerald-500/10 gap-3 text-xs text-slate-400">
        <div>
          Showing{" "}
          <b className="text-slate-200 font-mono">
            {rows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </b>{" "}
          to{" "}
          <b className="text-slate-200 font-mono">
            {Math.min(currentPage * pageSize, rows.length)}
          </b>{" "}
          of <b className="text-emerald-400 font-mono">{rows.length.toLocaleString()}</b> entries
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-[#021310] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/20 cursor-pointer"
          >
            « First
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-[#021310] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/20 cursor-pointer"
          >
            ‹ Prev
          </button>

          <span className="px-3 py-1 font-mono text-emerald-300 font-bold bg-emerald-500/15 rounded-lg border border-emerald-500/30">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-[#021310] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/20 cursor-pointer"
          >
            Next ›
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-[#021310] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/20 cursor-pointer"
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
}
