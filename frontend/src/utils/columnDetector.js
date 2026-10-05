/**
 * Smart Column Detection and Schema Inference Engine.
 * Infers data types (date, datetime, number, currency, text, boolean),
 * statistical properties, and financial field semantics.
 */

// Regex patterns for financial role detection from column names
const FINANCIAL_ROLE_PATTERNS = {
  date: [
    /^(txn|trans|transaction|posting|val|value|stmt|entry)?[\s_-]*date$/i,
    /^(date|timestamp|datetime|time|created_at|updated_at)$/i,
    /date/i,
  ],
  debit: [
    /^(debit|dr|withdrawal|withdraw|dr[\s_-]*amt|debit[\s_-]*amount|paid[\s_-]*out|expense|outflow)$/i,
    /debit/i,
    /\bdr\b/i,
  ],
  credit: [
    /^(credit|cr|deposit|dep|cr[\s_-]*amt|credit[\s_-]*amount|paid[\s_-]*in|income|inflow)$/i,
    /credit/i,
    /\bcr\b/i,
  ],
  balance: [
    /^(balance|closing[\s_-]*bal|closing[\s_-]*balance|running[\s_-]*bal|running[\s_-]*balance|avail[\s_-]*bal|net[\s_-]*balance|bal)$/i,
    /balance/i,
    /\bbal\b/i,
  ],
  amount: [
    /^(amount|amt|total[\s_-]*amt|total|txn[\s_-]*amt|transaction[\s_-]*amount|value|price)$/i,
    /amount/i,
    /\bamt\b/i,
  ],
  narration: [
    /^(narration|description|particulars|details|desc|remarks|memo|counterparty|party|reference|ref[\s_-]*no)$/i,
    /particular/i,
    /narration/i,
    /desc/i,
  ],
  reference: [
    /^(cheque|chq|ref|reference|txn[\s_-]*id|transaction[\s_-]*id|utr|utr[\s_-]*no|cheque[\s_-]*no|chq[\s_-]*number)$/i,
    /ref/i,
    /chq/i,
  ],
};

// Date string patterns: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY, etc.
const DATE_REGEX = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/, // ISO 8601
  /^\d{1,2}[-/.]([a-zA-Z]{3}|\d{1,2})[-/.]\d{2,4}$/, // 17-05-2008, 17/05/2008, 17-May-2008
  /^\d{1,2}\s+([a-zA-Z]{3,9})\s+\d{2,4}$/, // 17 May 2008
];

/**
 * Checks if a string can be parsed into a clean numeric value (handling currency symbols, commas, DR/CR).
 */
export function parseNumericValue(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;

  let str = String(val).trim();
  if (!str) return null;

  // Handle accounting negatives e.g. (1,234.50)
  let isNegative = false;
  if (str.startsWith("(") && str.endsWith(")")) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Handle DR / CR suffix: "2,139.00 CR", "500.00 DR"
  if (/\bDR\b/i.test(str)) {
    // In balance column DR is often debit/negative
    isNegative = true;
    str = str.replace(/\bDR\b/gi, "").trim();
  } else if (/\bCR\b/i.test(str)) {
    str = str.replace(/\bCR\b/gi, "").trim();
  }

  // Remove currency symbols, commas, whitespace
  str = str.replace(/[$₹€£¥,\s]/g, "");

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return null;
  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Checks if a string or object is a parseable date.
 */
export function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Excel serial number (e.g. 44562 for year ~2022)
  if (typeof val === "number" && val > 20000 && val < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + val * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(val).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY format handling
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    // Check if DD-MM-YYYY or MM-DD-YYYY
    // If p1 > 12, p1 must be day
    if (p1 > 12 && p2 <= 12) {
      const d = new Date(year, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d;
    } else {
      // Default standard in bank statements: Day first (DD-MM-YYYY)
      const d = new Date(year, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Standard JS Date parsing
  const standardDate = new Date(str);
  if (!isNaN(standardDate.getTime()) && standardDate.getFullYear() > 1970 && standardDate.getFullYear() < 2100) {
    return standardDate;
  }

  return null;
}

/**
 * Detect the role of a column in financial context
 */
function detectFinancialRole(columnName) {
  const norm = String(columnName).toLowerCase().trim();

  for (const [role, patterns] of Object.entries(FINANCIAL_ROLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(norm)) {
        return role;
      }
    }
  }
  return null;
}

/**
 * Analyzes an array of rows and infers metadata for each column.
 */
export function detectColumns(rows = []) {
  if (!rows || rows.length === 0) return [];

  // Collect all unique column keys
  const columnKeySet = new Set();
  const sampleSize = Math.min(rows.length, 300);
  const sampleRows = rows.slice(0, sampleSize);

  sampleRows.forEach((row) => {
    if (row && typeof row === "object") {
      Object.keys(row).forEach((k) => columnKeySet.add(k));
    }
  });

  const columnKeys = Array.from(columnKeySet);

  return columnKeys.map((name) => {
    let nullCount = 0;
    let numberCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let textCount = 0;
    let currencySymbolCount = 0;

    const values = [];
    const uniqueValuesSet = new Set();
    let numericMin = Infinity;
    let numericMax = -Infinity;
    let dateMin = null;
    let dateMax = null;

    sampleRows.forEach((row) => {
      const rawVal = row[name];

      if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "") {
        nullCount++;
        return;
      }

      uniqueValuesSet.add(rawVal);
      values.push(rawVal);

      // Check currency symbols
      if (typeof rawVal === "string" && /[$₹€£¥]/.test(rawVal)) {
        currencySymbolCount++;
      }

      // Check boolean
      if (typeof rawVal === "boolean" || /^(true|false|yes|no)$/i.test(String(rawVal).trim())) {
        booleanCount++;
        return;
      }

      // Check number
      const num = parseNumericValue(rawVal);
      const isNumDirect = typeof rawVal === "number" || (!isNaN(rawVal) && String(rawVal).trim() !== "");

      // Check date
      const date = parseDateValue(rawVal);

      // Distinguish date vs pure number (pure integers shouldn't be dates unless recognized pattern)
      const hasDateDelim = typeof rawVal === "string" && /[-/.T\s]/.test(rawVal) && DATE_REGEX.some((r) => r.test(rawVal.trim()));

      if (date && (hasDateDelim || /date|time/i.test(name))) {
        dateCount++;
        if (!dateMin || date < dateMin) dateMin = date;
        if (!dateMax || date > dateMax) dateMax = date;
      } else if (num !== null && !isNaN(num) && (isNumDirect || currencySymbolCount > 0 || !hasDateDelim)) {
        numberCount++;
        if (num < numericMin) numericMin = num;
        if (num > numericMax) numericMax = num;
      } else {
        textCount++;
      }
    });

    const nonNullCount = values.length;
    let inferredType = "text";
    let detectedFormat = null;

    if (nonNullCount === 0) {
      inferredType = "text";
    } else if (dateCount / nonNullCount >= 0.5 || (/date|time/i.test(name) && dateCount > 0)) {
      inferredType = "date";
      detectedFormat = "Date / Time";
    } else if (numberCount / nonNullCount >= 0.6) {
      if (currencySymbolCount > 0 || /amount|amt|price|balance|bal|debit|credit|cost|revenue/i.test(name)) {
        inferredType = "currency";
        detectedFormat = "Currency (₹ / $)";
      } else {
        inferredType = "number";
        detectedFormat = "Numeric";
      }
    } else if (booleanCount / nonNullCount >= 0.8) {
      inferredType = "boolean";
      detectedFormat = "Boolean";
    } else {
      inferredType = "text";
      detectedFormat = "Text / Categorical";
    }

    const financialRole = detectFinancialRole(name);

    return {
      name,
      label: name.replace(/[_\s]+/g, " ").trim(),
      type: inferredType,
      financialRole, // 'date' | 'debit' | 'credit' | 'balance' | 'amount' | 'narration' | 'reference' | null
      nullable: nullCount > 0,
      nullRatio: sampleRows.length ? (nullCount / sampleRows.length) : 0,
      uniqueValues: uniqueValuesSet.size,
      sampleValues: Array.from(uniqueValuesSet).slice(0, 5),
      min: inferredType === "date" ? dateMin : (numericMin !== Infinity ? numericMin : null),
      max: inferredType === "date" ? dateMax : (numericMax !== -Infinity ? numericMax : null),
      detectedFormat,
      isNumeric: inferredType === "number" || inferredType === "currency",
      isDate: inferredType === "date",
    };
  });
}
