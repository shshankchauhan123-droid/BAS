/**
 * Time-bucket and categorical aggregation engine for dynamic timeline & chart rendering.
 */

import { parseNumericValue } from "./columnDetector";

/**
 * Derives a bucket key and human-friendly display label for a date based on chosen granularity.
 */
function getDateBucketKey(dateObj, granularity = "daily") {
  if (!dateObj || isNaN(dateObj.getTime())) {
    return { key: "Unknown", label: "Unknown", sortTime: 0 };
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0-11
  const day = dateObj.getDate();

  if (granularity === "yearly") {
    return {
      key: `${year}`,
      label: `${year}`,
      sortTime: new Date(year, 0, 1).getTime(),
    };
  }

  if (granularity === "quarterly") {
    const quarter = Math.floor(month / 3) + 1;
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      sortTime: new Date(year, (quarter - 1) * 3, 1).getTime(),
    };
  }

  if (granularity === "monthly") {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = String(month + 1).padStart(2, "0");
    return {
      key: `${year}-${monthStr}`,
      label: `${monthNames[month]} ${year}`,
      sortTime: new Date(year, month, 1).getTime(),
    };
  }

  if (granularity === "weekly") {
    // Determine ISO week number
    const target = new Date(dateObj.valueOf());
    const dayNr = (dateObj.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const week = 1 + Math.ceil((firstThursday - target) / 604800000);
    return {
      key: `${year}-W${String(week).padStart(2, "0")}`,
      label: `W${week} ${year}`,
      sortTime: new Date(year, month, day - dayNr).getTime(),
    };
  }

  // Default: Daily
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month + 1).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    key: `${year}-${monthStr}-${dayStr}`,
    label: `${dayStr} ${monthNames[month]} ${year}`,
    sortTime: new Date(year, month, day).getTime(),
  };
}

/**
 * Aggregates a set of numbers based on chosen method.
 */
function computeAggregatedValue(numbers = [], method = "sum") {
  if (numbers.length === 0) return 0;

  switch (method) {
    case "count":
      return numbers.length;
    case "average": {
      const sum = numbers.reduce((acc, v) => acc + v, 0);
      return Math.round((sum / numbers.length) * 100) / 100;
    }
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
    case "sum":
    default: {
      const sum = numbers.reduce((acc, v) => acc + v, 0);
      return Math.round(sum * 100) / 100;
    }
  }
}

/**
 * Aggregates dataset rows for chart rendering.
 */
export function aggregateData({
  rows = [],
  xAxisCol,
  yAxesCols = [],
  xAxisType = "date",
  aggregation = "sum",
  granularity = "monthly", // daily | weekly | monthly | quarterly | yearly | raw
  sortOrder = "asc", // asc | desc
}) {
  if (!rows || rows.length === 0 || !xAxisCol || !yAxesCols || yAxesCols.length === 0) {
    return { categories: [], seriesData: {}, chartPoints: [] };
  }

  // If X-axis is Date and granularity is 'raw' or rows are small
  const isDateX = xAxisType === "date";

  // Bucket mapping: Map<bucketKey, { label, sortKey, rawRows, yValuesMap: { [yCol]: number[] } }>
  const buckets = new Map();

  rows.forEach((row) => {
    let bucketKey = "";
    let displayLabel = "";
    let sortKey = 0;

    if (isDateX) {
      const rawDate = row[`__date_${xAxisCol}`] || (row[xAxisCol] ? new Date(row[xAxisCol]) : null);
      if (!rawDate || isNaN(rawDate.getTime())) {
        bucketKey = "Invalid Date";
        displayLabel = "Invalid Date";
        sortKey = -Infinity;
      } else if (granularity === "raw") {
        bucketKey = rawDate.toISOString();
        displayLabel = rawDate.toISOString().split("T")[0];
        sortKey = rawDate.getTime();
      } else {
        const info = getDateBucketKey(rawDate, granularity);
        bucketKey = info.key;
        displayLabel = info.label;
        sortKey = info.sortTime;
      }
    } else {
      // Categorical / numeric grouping
      const rawVal = row[xAxisCol];
      bucketKey = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== "" ? String(rawVal) : "(Blank)";
      displayLabel = bucketKey;
      sortKey = typeof rawVal === "number" ? rawVal : bucketKey;
    }

    if (!buckets.has(bucketKey)) {
      const yValuesMap = {};
      yAxesCols.forEach((yCol) => {
        yValuesMap[yCol] = [];
      });
      buckets.set(bucketKey, {
        key: bucketKey,
        label: displayLabel,
        sortKey,
        yValuesMap,
        recordCount: 0,
        lastRow: row,
      });
    }

    const b = buckets.get(bucketKey);
    b.recordCount++;
    b.lastRow = row;

    yAxesCols.forEach((yCol) => {
      const num = parseNumericValue(row[yCol]);
      if (num !== null && !isNaN(num)) {
        b.yValuesMap[yCol].push(num);
      }
    });
  });

  // Convert buckets to sorted array
  let bucketList = Array.from(buckets.values());

  bucketList.sort((a, b) => {
    if (sortOrder === "desc") {
      return a.sortKey < b.sortKey ? 1 : -1;
    }
    return a.sortKey > b.sortKey ? 1 : -1;
  });

  // Build series outputs
  const categories = bucketList.map((b) => b.label);
  const seriesData = {};

  yAxesCols.forEach((yCol) => {
    seriesData[yCol] = bucketList.map((b) => {
      const numbers = b.yValuesMap[yCol];
      // For balance with date grouping, 'last' closing balance in that bucket makes intuitive sense if aggregation is 'last' or 'sum'
      if (/balance|bal/i.test(yCol) && aggregation === "sum") {
        // In balance, taking last recorded balance in that bucket represents closing balance
        const lastNum = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
        return lastNum;
      }
      return computeAggregatedValue(numbers, aggregation);
    });
  });

  // Multi-series points for tooltips or table sync
  const chartPoints = bucketList.map((b, idx) => {
    const pt = {
      key: b.key,
      label: b.label,
      recordCount: b.recordCount,
    };
    yAxesCols.forEach((yCol) => {
      pt[yCol] = seriesData[yCol][idx];
    });
    return pt;
  });

  return {
    categories,
    seriesData,
    chartPoints,
  };
}

/**
 * Calculates dynamic KPI cards from the filtered dataset.
 */
export function calculateKPIs(rows = [], datasetMeta = {}, selectedYAxes = []) {
  if (!rows || rows.length === 0) {
    return {
      totalRecords: 0,
      totalDebit: 0,
      totalCredit: 0,
      netFlow: 0,
      openingBalance: null,
      closingBalance: null,
      dateRangeStr: "-",
      summaryMetrics: [],
    };
  }

  const { roles = {}, columns = [] } = datasetMeta;

  let totalDebit = 0;
  let totalCredit = 0;
  let hasDebit = false;
  let hasCredit = false;

  const debitCol = roles.debit;
  const creditCol = roles.credit;
  const balanceCol = roles.balance;
  const dateCol = roles.date;

  if (debitCol) {
    hasDebit = true;
    rows.forEach((r) => {
      const val = parseNumericValue(r[debitCol]);
      if (val !== null && !isNaN(val)) totalDebit += Math.abs(val);
    });
  }

  if (creditCol) {
    hasCredit = true;
    rows.forEach((r) => {
      const val = parseNumericValue(r[creditCol]);
      if (val !== null && !isNaN(val)) totalCredit += Math.abs(val);
    });
  }

  const netFlow = totalCredit - totalDebit;

  // Opening & Closing Balance
  let openingBalance = null;
  let closingBalance = null;

  if (balanceCol && rows.length > 0) {
    // Sort chronologically if date column exists
    let sortedRows = [...rows];
    if (dateCol) {
      sortedRows.sort((a, b) => {
        const da = a[`__date_${dateCol}`] || new Date(a[dateCol] || 0);
        const db = b[`__date_${dateCol}`] || new Date(b[dateCol] || 0);
        return da - db;
      });
    }

    const firstValid = sortedRows.find((r) => parseNumericValue(r[balanceCol]) !== null);
    if (firstValid) openingBalance = parseNumericValue(firstValid[balanceCol]);

    for (let i = sortedRows.length - 1; i >= 0; i--) {
      const val = parseNumericValue(sortedRows[i][balanceCol]);
      if (val !== null) {
        closingBalance = val;
        break;
      }
    }
  }

  // Date range
  let dateRangeStr = "-";
  if (dateCol) {
    let minD = null;
    let maxD = null;
    rows.forEach((r) => {
      const d = r[`__date_${dateCol}`] || (r[dateCol] ? new Date(r[dateCol]) : null);
      if (d && !isNaN(d.getTime())) {
        if (!minD || d < minD) minD = d;
        if (!maxD || d > maxD) maxD = d;
      }
    });

    if (minD && maxD) {
      const d1 = minD.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const d2 = maxD.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      dateRangeStr = d1 === d2 ? d1 : `${d1} → ${d2}`;
    }
  }

  // Generic metrics for selected Y-Axes
  const summaryMetrics = [];
  const targetCols = selectedYAxes.length > 0
    ? selectedYAxes
    : columns.filter((c) => c.isNumeric).slice(0, 3).map((c) => c.name);

  targetCols.forEach((colName) => {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;

    rows.forEach((r) => {
      const val = parseNumericValue(r[colName]);
      if (val !== null && !isNaN(val)) {
        sum += val;
        count++;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    });

    if (count > 0) {
      summaryMetrics.push({
        colName,
        sum: Math.round(sum * 100) / 100,
        avg: Math.round((sum / count) * 100) / 100,
        min: min !== Infinity ? min : 0,
        max: max !== -Infinity ? max : 0,
        count,
      });
    }
  });

  return {
    totalRecords: rows.length,
    hasFinancialColumns: datasetMeta.hasFinancialColumns || (hasDebit && hasCredit),
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    netFlow: Math.round(netFlow * 100) / 100,
    openingBalance,
    closingBalance,
    dateRangeStr,
    summaryMetrics,
  };
}
