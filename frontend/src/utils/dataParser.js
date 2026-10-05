/**
 * Production File Parser for CSV, XLSX, XLS, and JSON formats.
 * Features smart header detection (skips metadata/disclaimer banners in bank statements),
 * data sanitation, and type inference.
 */

import * as XLSX from "xlsx";
import { detectColumns, parseDateValue, parseNumericValue } from "./columnDetector";

/**
 * Finds the likely header row index in a 2D array of rows.
 * In bank statements, rows 0-3 often contain bank names, branch info, period banners, etc.
 * The real header row has multiple distinct non-numeric string values matching column names.
 */
function findBestHeaderRowIndex(rawGrid) {
  if (!rawGrid || rawGrid.length === 0) return 0;

  const headerKeywords = [
    "date", "txn", "transaction", "description", "particulars", "narration",
    "debit", "credit", "balance", "amount", "chq", "cheque", "ref", "value",
    "withdraw", "deposit", "type", "category", "status", "id", "name",
  ];

  let bestIndex = 0;
  let bestScore = -1;

  const maxRowsToCheck = Math.min(rawGrid.length, 15);

  for (let i = 0; i < maxRowsToCheck; i++) {
    const row = rawGrid[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Filter non-empty cells
    const nonEmpties = row.filter(
      (c) => c !== null && c !== undefined && String(c).trim() !== ""
    );

    if (nonEmpties.length < 2) continue;

    let score = 0;
    const seenHeaders = new Set();

    nonEmpties.forEach((cell) => {
      const str = String(cell).toLowerCase().trim();
      seenHeaders.add(str);

      // Boost score if cell matches common column keywords
      if (headerKeywords.some((kw) => str.includes(kw))) {
        score += 4;
      }
      // String headers are preferred over pure numbers
      if (isNaN(Number(str))) {
        score += 1;
      } else {
        score -= 2;
      }
    });

    // Score is proportional to number of distinct meaningful columns
    score += seenHeaders.size * 2;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Parses CSV text with delimiter detection and quote handling.
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter: comma, semicolon, tab
  const sample = lines.slice(0, 5).join("\n");
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  let delimiter = ",";
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
  if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = [];
    let cur = "";
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      const nextChar = line[c + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cur += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }

  return rows;
}

/**
 * Converts a 2D grid of values into an array of objects based on detected header row.
 */
function gridToObjects(grid) {
  if (!grid || grid.length === 0) return [];

  const headerIdx = findBestHeaderRowIndex(grid);
  const rawHeaders = grid[headerIdx] || [];

  // Clean headers and handle duplicates / empty headers
  const headers = [];
  const headerCount = {};

  rawHeaders.forEach((h, idx) => {
    let clean = String(h || `col_${idx + 1}`).trim();
    if (!clean) clean = `Column_${idx + 1}`;

    if (headerCount[clean]) {
      headerCount[clean]++;
      headers.push(`${clean}_${headerCount[clean]}`);
    } else {
      headerCount[clean] = 1;
      headers.push(clean);
    }
  });

  const objects = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;

    // Check if entire row is empty or summary banner
    const hasData = row.some((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (!hasData) continue;

    const obj = {};
    let populatedCount = 0;

    headers.forEach((hdr, colIdx) => {
      const val = row[colIdx];
      obj[hdr] = val !== undefined ? val : null;
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        populatedCount++;
      }
    });

    if (populatedCount > 0) {
      objects.push(obj);
    }
  }

  return objects;
}

/**
 * Sanitizes and normalizes row values for consistent handling.
 */
function sanitizeRows(rows, columnDefs) {
  const numericCols = new Set(
    columnDefs.filter((c) => c.isNumeric).map((c) => c.name)
  );
  const dateCols = new Set(
    columnDefs.filter((c) => c.isDate).map((c) => c.name)
  );

  return rows.map((row, idx) => {
    const cleanRow = { __rowId: idx + 1 };

    Object.keys(row).forEach((k) => {
      const val = row[k];

      if (numericCols.has(k)) {
        const num = parseNumericValue(val);
        cleanRow[k] = num !== null ? num : (val === null || val === undefined || String(val).trim() === "" ? null : val);
      } else if (dateCols.has(k)) {
        const d = parseDateValue(val);
        cleanRow[k] = d ? d.toISOString().split("T")[0] : String(val || "");
        cleanRow[`__date_${k}`] = d;
      } else {
        cleanRow[k] = val !== null && val !== undefined ? String(val).trim() : "";
      }
    });

    return cleanRow;
  });
}

/**
 * Computes overall dataset metadata including date ranges and financial roles.
 */
function computeDatasetMeta(rows, columnDefs, fileName, fileSize) {
  const dateCols = columnDefs.filter((c) => c.isDate);
  let globalStartDate = null;
  let globalEndDate = null;

  if (dateCols.length > 0) {
    const primaryDateCol = dateCols.find((c) => c.financialRole === "date") || dateCols[0];
    dateCols.forEach((col) => {
      if (col.min && (!globalStartDate || col.min < globalStartDate)) {
        globalStartDate = col.min;
      }
      if (col.max && (!globalEndDate || col.max > globalEndDate)) {
        globalEndDate = col.max;
      }
    });
  }

  // Detect financial roles
  const roles = {
    date: columnDefs.find((c) => c.financialRole === "date")?.name || dateCols[0]?.name || null,
    debit: columnDefs.find((c) => c.financialRole === "debit")?.name || null,
    credit: columnDefs.find((c) => c.financialRole === "credit")?.name || null,
    balance: columnDefs.find((c) => c.financialRole === "balance")?.name || null,
    amount: columnDefs.find((c) => c.financialRole === "amount")?.name || null,
    narration: columnDefs.find((c) => c.financialRole === "narration")?.name || null,
    reference: columnDefs.find((c) => c.financialRole === "reference")?.name || null,
  };

  const hasFinancialColumns = Boolean(
    roles.date && (roles.debit || roles.credit || roles.amount || roles.balance)
  );

  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName: fileName || "Untitled Dataset",
    fileSize: fileSize || 0,
    rowCount: rows.length,
    columnCount: columnDefs.length,
    columns: columnDefs,
    dateRange: {
      start: globalStartDate ? globalStartDate.toISOString().split("T")[0] : null,
      end: globalEndDate ? globalEndDate.toISOString().split("T")[0] : null,
    },
    hasFinancialColumns,
    roles,
  };
}

/**
 * Main parse entry point accepting a File or ArrayBuffer/string.
 */
export async function parseUploadedFile(file) {
  const fileName = file.name || "uploaded_file";
  const fileSize = file.size || 0;
  const ext = fileName.split(".").pop().toLowerCase();

  let rawObjects = [];

  if (ext === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rawObjects = parsed;
    } else if (parsed && Array.isArray(parsed.data)) {
      rawObjects = parsed.data;
    } else if (parsed && Array.isArray(parsed.transactions)) {
      rawObjects = parsed.transactions;
    } else if (parsed && typeof parsed === "object") {
      // Find the first array property
      const arrKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (arrKey) {
        rawObjects = parsed[arrKey];
      } else {
        rawObjects = [parsed];
      }
    } else {
      throw new Error("Invalid JSON structure: Expected an array of records.");
    }
  } else if (ext === "csv" || ext === "txt") {
    const text = await file.text();
    const grid = parseCSV(text);
    rawObjects = gridToObjects(grid);
  } else if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      dense: true,
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Spreadsheet contains no sheets.");
    }

    // Pick first non-empty sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    rawObjects = gridToObjects(grid);
  } else {
    // Attempt XLSX read for other spreadsheet extensions
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    rawObjects = gridToObjects(grid);
  }

  if (rawObjects.length === 0) {
    throw new Error("No data rows found in the selected file.");
  }

  const columnDefs = detectColumns(rawObjects);
  const sanitizedRows = sanitizeRows(rawObjects, columnDefs);
  const metadata = computeDatasetMeta(sanitizedRows, columnDefs, fileName, fileSize);

  return {
    ...metadata,
    rows: sanitizedRows,
    previewRows: sanitizedRows.slice(0, 10),
  };
}

/**
 * Parses raw JSON or array directly without file object (useful for sample datasets).
 */
export function parseRawDataset(rawObjects, name = "Sample Dataset") {
  if (!Array.isArray(rawObjects) || rawObjects.length === 0) {
    throw new Error("Expected non-empty array of objects");
  }

  const columnDefs = detectColumns(rawObjects);
  const sanitizedRows = sanitizeRows(rawObjects, columnDefs);
  const metadata = computeDatasetMeta(sanitizedRows, columnDefs, name, 0);

  return {
    ...metadata,
    rows: sanitizedRows,
    previewRows: sanitizedRows.slice(0, 10),
  };
}
