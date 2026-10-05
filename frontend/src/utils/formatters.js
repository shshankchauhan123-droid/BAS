/**
 * Formatting utilities for numbers, currencies, dates, and labels.
 */

export function formatCurrency(amount, currency = "INR") {
  if (amount === null || amount === undefined || isNaN(amount) || amount === "") {
    return "-";
  }
  const num = Number(amount);
  if (isNaN(num)) return String(amount);

  try {
    if (currency === "INR" || currency === "₹") {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(num);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
}

export function formatCurrencyCompact(amount, currency = "₹") {
  if (amount === null || amount === undefined || isNaN(amount)) return "0";
  const num = Number(amount);
  if (isNaN(num)) return "0";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  // Indian numbering system check
  if (currency === "INR" || currency === "₹") {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
    return `${sign}₹${Math.round(abs)}`;
  }

  // Western compact
  if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

export function formatNumber(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val) || val === "") return "-";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Number.isInteger(num) ? 0 : Math.min(2, decimals),
  }).format(num);
}

export function formatDate(val, style = "medium") {
  if (!val) return "-";
  const date = val instanceof Date ? val : new Date(val);
  if (isNaN(date.getTime())) return String(val);

  if (style === "short") {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }
  if (style === "iso") {
    return date.toISOString().split("T")[0];
  }
  if (style === "monthYear") {
    return date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(val) {
  if (!val) return "-";
  const date = val instanceof Date ? val : new Date(val);
  if (isNaN(date.getTime())) return String(val);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cleanHeaderLabel(header) {
  if (!header) return "";
  return String(header)
    .replace(/[_\s]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
