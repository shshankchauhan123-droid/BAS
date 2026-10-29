/**
 * GST Data Mapping & Normalization Utilities
 * Handles FACT GST Advance Search Postman response mapping,
 * safe value formatting, array flattening, and fallbacks.
 */

/**
 * Safely format address object or string into readable address line
 */
export function formatAddress(addrObj) {
  if (!addrObj) return "-";
  if (typeof addrObj === "string") return addrObj;
  if (typeof addrObj === "object") {
    if (addrObj.address && typeof addrObj.address === "string") {
      return addrObj.address;
    }
    if (addrObj.addr && typeof addrObj.addr === "string") {
      return addrObj.addr;
    }
    const target = addrObj.addr || addrObj;
    const parts = [
      target.bno ? `Building ${target.bno}` : null,
      target.bnm,
      target.st ? `Street ${target.st}` : null,
      target.loc,
      target.dst,
      target.stcd,
      target.pncd ? `PIN: ${target.pncd}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  }
  return String(addrObj);
}

/**
 * Safe string / field normalization helper.
 * Returns first non-null, non-undefined, non-empty-string value.
 * Preserves numeric 0 and boolean false.
 */
export function getFieldVal(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null) {
      if (typeof val === "string" && val.trim() === "") continue;
      return val;
    }
  }
  return null;
}

/**
 * Safe value formatter that distinguishes:
 * - null and undefined -> fallback
 * - empty string -> fallback
 * - numeric 0 -> "0"
 * - boolean false -> "No" / boolean true -> "Yes"
 * - valid strings and numbers
 */
export function formatSafeValue(val, fallback = "-") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof val === "number") {
    return String(val);
  }
  if (typeof val === "boolean") {
    return val ? "Yes" : "No";
  }
  if (Array.isArray(val)) {
    return val.length > 0 ? val.join(", ") : fallback;
  }
  return String(val);
}

/**
 * Safely format percentage values.
 * Preserves numeric zero as "0%". Never treats 0 as falsy.
 */
export function formatPercentage(val, fallback = "-") {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "string" && val.endsWith("%")) return val;
  const num = typeof val === "number" ? val : parseFloat(val);
  if (!isNaN(num)) {
    return `${num}%`;
  }
  return String(val);
}

/**
 * Safely format date strings (DD/MM/YYYY or YYYY-MM-DD) readably.
 */
export function formatRegistrationDate(val) {
  if (!val) return "-";
  if (typeof val !== "string") return String(val);
  const trimmed = val.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    try {
      const parts = trimmed.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * Reusable normalization function that safely flattens nested filing arrays
 * while preserving all valid records.
 */
export const normalizeRecords = (value) => {
  if (!value) return [];
  const target = Array.isArray(value)
    ? value
    : value.filingStatus !== undefined
    ? value.filingStatus
    : value;

  if (!Array.isArray(target)) return [];

  return target.flat(Infinity).filter(
    (item) => item !== null && typeof item === "object" && !Array.isArray(item)
  );
};

/**
 * Safely extract data payload following upstream contract:
 * response -> data -> data -> { basicDetails, branchDetails, ... }
 */
export function extractGstData(rawResponse) {
  if (!rawResponse) return null;
  if (rawResponse.data?.data && typeof rawResponse.data.data === "object") {
    return rawResponse.data.data;
  }
  if (rawResponse.data?.basicDetails) {
    return rawResponse.data;
  }
  if (rawResponse.basicDetails) {
    return rawResponse;
  }
  return rawResponse.data?.data || rawResponse.data || rawResponse;
}

/**
 * Normalizes basic details fields
 */
export function mapBasicDetails(basicDetails, searchedGstin = "") {
  const gstinVal = formatSafeValue(basicDetails?.gstin || searchedGstin, "-");
  const regStatus = formatSafeValue(
    getFieldVal(basicDetails, "registrationStatus", "sts", "status"),
    "-"
  );
  const regType = formatSafeValue(
    getFieldVal(basicDetails, "registrationType", "dty", "taxpayerType"),
    "-"
  );
  const regDate = formatRegistrationDate(
    getFieldVal(basicDetails, "registrationDate", "rgdt")
  );
  const aggregateTurnover = formatSafeValue(
    getFieldVal(basicDetails, "aggreTurnOver", "aggregateTurnover", "turnover"),
    "-"
  );
  const turnoverFY = getFieldVal(
    basicDetails,
    "aggreTurnOverFY",
    "turnoverFY",
    "turnoverFinancialYear"
  );
  const legalName = formatSafeValue(
    getFieldVal(basicDetails, "legal_Name", "lgnm", "legalName"),
    "-"
  );
  const tradeName = formatSafeValue(
    getFieldVal(basicDetails, "tradeNam", "tradeName"),
    "-"
  );
  const constitution = formatSafeValue(
    getFieldVal(basicDetails, "constitution", "ctb"),
    "-"
  );
  const jurisdiction = formatSafeValue(
    getFieldVal(basicDetails, "jurisdiction", "centerJurisdiction"),
    "-"
  );
  const ctj = formatSafeValue(
    getFieldVal(basicDetails, "ctj", "centralTaxJurisdiction"),
    "-"
  );

  const rawEinvoice = getFieldVal(
    basicDetails,
    "eInvoiceStatus",
    "einvoiceStatus",
    "mandatedeInvoice"
  );
  const einvoiceStatus =
    rawEinvoice !== null && rawEinvoice !== undefined
      ? typeof rawEinvoice === "boolean"
        ? rawEinvoice
          ? "Enabled"
          : "Disabled"
        : formatSafeValue(rawEinvoice, "Unavailable")
      : "Unavailable";

  const rawAadhaar = getFieldVal(
    basicDetails,
    "aadharVerified",
    "adhrVrfSts",
    "aadhaarVerificationStatus"
  );
  const aadhaarStatus =
    rawAadhaar !== null && rawAadhaar !== undefined
      ? typeof rawAadhaar === "boolean"
        ? rawAadhaar
          ? "Verified"
          : "Not Verified"
        : formatSafeValue(rawAadhaar, "Unavailable")
      : "Unavailable";

  const cancelDate = getFieldVal(basicDetails, "cancellationDate", "cxdt");

  const nba = basicDetails?.businessNature || basicDetails?.nba;
  let businessActivities = [];
  if (Array.isArray(nba)) {
    businessActivities = nba;
  } else if (typeof nba === "string" && nba.trim()) {
    businessActivities = nba.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return {
    gstinVal,
    regStatus,
    regType,
    regDate,
    aggregateTurnover,
    turnoverFY,
    legalName,
    tradeName,
    constitution,
    jurisdiction,
    ctj,
    einvoiceStatus,
    aadhaarStatus,
    cancelDate,
    businessActivities,
  };
}

/**
 * Normalizes branch details
 */
export function mapBranchDetails(branchInfo) {
  const permanentAdd = branchInfo?.permanentAdd;
  let principalAddress = "-";
  if (typeof permanentAdd === "string" && permanentAdd.trim()) {
    principalAddress = permanentAdd;
  } else if (permanentAdd && typeof permanentAdd === "object") {
    if (permanentAdd.address && typeof permanentAdd.address === "string") {
      principalAddress = permanentAdd.address;
    } else {
      principalAddress = formatAddress(permanentAdd.addr || permanentAdd);
    }
  } else if (branchInfo?.pradr) {
    principalAddress = formatAddress(branchInfo.pradr?.addr || branchInfo.pradr);
  }

  const principalDealsIn = permanentAdd?.dealsIn || branchInfo?.pradr?.ntr || null;

  const rawAdd = branchInfo?.additionalAdd || branchInfo?.adadr;
  const additionalAddresses = Array.isArray(rawAdd) ? rawAdd : [];

  return {
    principalAddress,
    principalDealsIn,
    additionalAddresses,
  };
}

/**
 * Normalizes HSN Goods and Services records
 */
export function mapHsnDetails(hsnInfo) {
  const goods = Array.isArray(hsnInfo?.goods) ? hsnInfo.goods : [];
  const services = Array.isArray(hsnInfo?.services) ? hsnInfo.services : [];

  const mapItem = (item, isService = false) => ({
    code: item.hsnCode || item.hsn_cd || (isService ? item.sacCode : null) || item.code || "-",
    description: item.hsnDescription || item.desc || item.description || "-",
  });

  return {
    goodsList: goods.map((g) => mapItem(g, false)),
    servicesList: services.map((s) => mapItem(s, true)),
  };
}

/**
 * Normalizes liability paid details
 */
export function mapLiabilityDetails(raw) {
  if (!raw) {
    return {
      currFinYear: null,
      prevFinYear: null,
      prevTotal_pct: null,
      currDetails: [],
      prevDetails: [],
    };
  }
  if (Array.isArray(raw)) {
    return {
      currFinYear: raw[0]?.fy || "Current FY",
      prevFinYear: null,
      prevTotal_pct: null,
      currDetails: raw,
      prevDetails: [],
    };
  }
  return {
    currFinYear: raw.currFinYear || null,
    prevFinYear: raw.prevFinYear || null,
    prevTotal_pct:
      raw.prevTotal_pct !== undefined && raw.prevTotal_pct !== null
        ? raw.prevTotal_pct
        : null,
    currDetails: Array.isArray(raw.currDetails) ? raw.currDetails : [],
    prevDetails: Array.isArray(raw.prevDetails) ? raw.prevDetails : [],
  };
}

/**
 * Normalizes filing frequency
 */
export function mapFilingFrequency(gstData) {
  const filingFrequencyCurrent =
    gstData?.filingFrequency !== null &&
    gstData?.filingFrequency !== undefined &&
    gstData?.filingFrequency !== ""
      ? String(gstData.filingFrequency)
      : "Unavailable";

  const filingFrequencyPrevious =
    gstData?.filingFrequencyLastYear !== null &&
    gstData?.filingFrequencyLastYear !== undefined &&
    gstData?.filingFrequencyLastYear !== ""
      ? String(gstData.filingFrequencyLastYear)
      : "Unavailable";

  return {
    filingFrequencyCurrent,
    filingFrequencyPrevious,
  };
}
