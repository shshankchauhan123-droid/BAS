/**
 * CIN Advance Search Data Mapping & Normalization Utilities
 * Handles FACT CIN Advance Search Postman response mapping,
 * safe value formatting, currency formatting, address cleaning,
 * and director / DIN counting and role record mapping.
 */

/**
 * Safe value formatter that distinguishes:
 * - null and undefined -> fallback (default: "Not available")
 * - empty string / whitespace string -> fallback
 * - numeric 0 -> "0" (never treats zero as missing)
 * - boolean false -> "No" / boolean true -> "Yes"
 * - valid strings and numbers -> string representation
 */
export function formatSafeValue(val, fallback = "Not available") {
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
 * Format currency or capital amounts into Indian numbering system (INR).
 * CRITICAL: Zero capital values must display as ₹0.00 rather than "Not available".
 */
export function formatCurrency(amount, fallback = "Not available") {
  if (amount === 0 || amount === "0" || amount === 0.0) {
    return "₹0.00";
  }
  if (amount === undefined || amount === null || amount === "") {
    return fallback;
  }
  const num = Number(amount);
  if (Number.isNaN(num)) {
    return String(amount);
  }
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Safely format date strings (e.g. "26/10/2026", "2018-05-15", or ISO strings)
 * into readable date format without changing their meaning.
 */
export function formatCinDate(val, fallback = "Not available") {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val !== "string") {
    try {
      const str = String(val).trim();
      return str.length > 0 ? str : fallback;
    } catch {
      return fallback;
    }
  }

  const trimmed = val.trim();
  if (trimmed.length === 0) return fallback;

  // DD/MM/YYYY format - preserve directly
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY-MM-DD format - convert to DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    try {
      const parts = trimmed.substring(0, 10).split("-");
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
 * Clean up repeated commas, redundant spaces, and irregular separators
 * in registered office address for presentation only.
 * Does not remove meaningful address information or overwrite raw API data.
 */
export function cleanOfficeAddress(address, fallback = "Not available") {
  if (!address || typeof address !== "string") return fallback;
  const trimmed = address.trim();
  if (!trimmed) return fallback;

  const cleaned = trimmed
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/(\s*,\s*)+/g, ", ") // Collapse multiple commas
    .replace(/,([^\s])/g, ", $1") // Ensure single space after commas
    .replace(/^[\s,]+|[\s,]+$/g, ""); // Strip leading and trailing commas

  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Safely unwrap API response structure:
 * Can handle response.data.data, response.data, or root object.
 */
export function extractCinData(rawResponse) {
  if (!rawResponse) return null;

  // Double nested: response.data.data
  if (
    rawResponse.data?.data &&
    typeof rawResponse.data.data === "object" &&
    (rawResponse.data.data.cin || rawResponse.data.data.companyName)
  ) {
    return rawResponse.data.data;
  }

  // Single nested: response.data
  if (
    rawResponse.data &&
    typeof rawResponse.data === "object" &&
    (rawResponse.data.cin || rawResponse.data.companyName)
  ) {
    return rawResponse.data;
  }

  // Raw root object
  if (rawResponse.cin || rawResponse.companyName) {
    return rawResponse;
  }

  return rawResponse.data?.data || rawResponse.data || rawResponse;
}

/**
 * Normalizes company overview and details from data object.
 * Maps exact response properties as specified in prompt section 1.
 */
export function mapCompanyDetails(data) {
  if (!data || typeof data !== "object") {
    return {
      cin: "Not available",
      companyName: "Not available",
      companyStatus: "Not available",
      companyCategory: "Not available",
      companySubCategory: "Not available",
      companyClass: "Not available",
      authorizedCapitalFormatted: "Not available",
      paidupCapitalFormatted: "Not available",
      authorizedCapitalRaw: null,
      paidupCapitalRaw: null,
      registrationDate: "Not available",
      rocCode: "Not available",
      listingStatus: "Not available",
      originType: "Not available",
      apiDirectorCount: "Not available",
      registeredOfficeAddress: "Not available",
      rawRegisteredOfficeAddress: "Not available",
      city: "Not available",
      state: "Not available",
      pincode: "Not available",
      country: "Not available",
      rdName: "Not available",
      rdRegion: "Not available",
      officialEmail: "Not available",
      lastAgm: "Not available",
      lastBalanceSheet: "Not available",
      numberOfMembers: "Not available",
      stateCode: "Not available",
    };
  }

  return {
    cin: formatSafeValue(data.cin),
    companyName: formatSafeValue(data.companyName),
    companyStatus: formatSafeValue(data.companyStatus),
    companyCategory: formatSafeValue(data.companyCategory),
    companySubCategory: formatSafeValue(data.companySubCategory),
    companyClass: formatSafeValue(data.companyClass),
    authorizedCapitalFormatted: formatCurrency(data.authorizedCapital),
    paidupCapitalFormatted: formatCurrency(data.paidupCapital),
    authorizedCapitalRaw: data.authorizedCapital,
    paidupCapitalRaw: data.paidupCapital,
    registrationDate: formatCinDate(data.companyRegistrationdate_date),
    rocCode: formatSafeValue(data.companyROCcode),
    listingStatus: formatSafeValue(data.listingstatus),
    originType: formatSafeValue(data.companyIndian),
    apiDirectorCount:
      data.nofDirectors !== undefined && data.nofDirectors !== null
        ? Number(data.nofDirectors)
        : null,
    apiDirectorCountFormatted: formatSafeValue(data.nofDirectors),
    registeredOfficeAddress: cleanOfficeAddress(data.registered_Office_Address),
    rawRegisteredOfficeAddress: data.registered_Office_Address || "Not available",
    city: formatSafeValue(data.city),
    state: formatSafeValue(data.state),
    pincode: formatSafeValue(data.pincode),
    country: formatSafeValue(data.country),
    rdName: formatSafeValue(data.rdName),
    rdRegion: formatSafeValue(data.rdRegion),
    officialEmail: formatSafeValue(data.email),
    lastAgm: formatCinDate(data.last_AGM),
    lastBalanceSheet: formatCinDate(data.last_BalanceSheet),
    numberOfMembers: formatSafeValue(data.number_Of_Members),
    stateCode: formatSafeValue(data.companyStateCode),
  };
}

/**
 * Normalizes director records from data.cIN_DINs:
 * - Uses exact properties: name, din, designation, datE_JOIN, datE_RESIGN, dsC_EXPIRY, noOfCompanies
 * - Includes fallbacks for alternative field casings
 * - Calculates unique directors count using distinct, non-empty DINs
 * - Preserves all role records and distinct designations
 * - Computes separate stats: uniqueDirectorCount, totalRoleRecords, apiReportedCount
 */
export function mapDirectors(cinDins, apiReportedCount = null) {
  if (!Array.isArray(cinDins)) {
    return {
      records: [],
      uniqueDirectorCount: 0,
      totalRoleRecords: 0,
      apiReportedCount:
        apiReportedCount !== null && apiReportedCount !== undefined
          ? Number(apiReportedCount)
          : null,
      distinctDins: [],
    };
  }

  const records = cinDins.map((item) => {
    const rawJoin =
      item.datE_JOIN ?? item.dateOfAppointment ?? item.dateJoined ?? null;
    const rawResign =
      item.datE_RESIGN ?? item.cessationDate ?? item.dateResigned ?? null;
    const rawExpiry =
      item.dsC_EXPIRY ?? item.dscExpiryDate ?? item.dscExpiry ?? null;
    const rawCompanies =
      item.noOfCompanies ?? item.numberOfCompanies ?? null;

    return {
      name: formatSafeValue(item.name ?? item.directorName),
      din: formatSafeValue(item.din),
      rawDin: item.din ? String(item.din).trim() : "",
      designation: formatSafeValue(item.designation),
      dateJoin: formatCinDate(rawJoin),
      rawDateJoin: rawJoin,
      dateResign:
        rawResign !== null && rawResign !== undefined && String(rawResign).trim() !== ""
          ? formatCinDate(rawResign)
          : "-",
      rawDateResign: rawResign,
      dscExpiry:
        rawExpiry !== null && rawExpiry !== undefined && String(rawExpiry).trim() !== ""
          ? formatCinDate(rawExpiry)
          : "-",
      rawDscExpiry: rawExpiry,
      noOfCompanies:
        rawCompanies !== null && rawCompanies !== undefined
          ? String(rawCompanies)
          : "-",
      rawNoOfCompanies: rawCompanies,
    };
  });

  // Calculate unique director count using distinct, non-empty DINs
  const distinctDins = Array.from(
    new Set(
      records
        .map((r) => r.rawDin)
        .filter((din) => din && din.length > 0 && din !== "Not available")
    )
  );

  return {
    records,
    uniqueDirectorCount: distinctDins.length,
    totalRoleRecords: records.length,
    apiReportedCount:
      apiReportedCount !== null && apiReportedCount !== undefined
        ? Number(apiReportedCount)
        : null,
    distinctDins,
  };
}

/**
 * Normalizes charges from data.cIN_Charges
 */
export function mapCharges(cinCharges) {
  if (!Array.isArray(cinCharges)) return [];

  return cinCharges.map((chg) => ({
    chargeId: formatSafeValue(chg.chargeId ?? chg.id),
    holderName: formatSafeValue(chg.holderName ?? chg.chargeHolder),
    dateOfCreation: formatCinDate(chg.dateOfCreation ?? chg.creationDate),
    dateOfModification: chg.dateOfModification
      ? formatCinDate(chg.dateOfModification)
      : "-",
    dateOfSatisfaction: chg.dateOfSatisfaction
      ? formatCinDate(chg.dateOfSatisfaction)
      : "-",
    chargeAmountFormatted: formatCurrency(chg.chargeAmount ?? chg.amount),
    chargeAmountRaw: chg.chargeAmount ?? chg.amount,
    status: formatSafeValue(chg.status),
  }));
}

/**
 * Normalizes annual return filings from data.annualReturnFillingInfo
 */
export function mapAnnualReturns(annualReturns) {
  if (!Array.isArray(annualReturns)) return [];

  return annualReturns.map((ret) => ({
    financialYear: formatSafeValue(ret.financialYear ?? ret.fy),
    agmDate: formatCinDate(ret.agmDate),
    filingDate: formatCinDate(ret.filingDate ?? ret.dof),
    form: formatSafeValue(ret.form ?? ret.returnType),
    srn: formatSafeValue(ret.srn ?? ret.arn),
  }));
}

/**
 * Normalizes balance sheet filings from data.balanceSheet
 */
export function mapBalanceSheets(balanceSheets) {
  if (!Array.isArray(balanceSheets)) return [];

  return balanceSheets.map((bs) => ({
    financialYear: formatSafeValue(bs.financialYear ?? bs.fy),
    filingDate: formatCinDate(bs.filingDate ?? bs.dof),
    form: formatSafeValue(bs.form ?? bs.returnType),
    srn: formatSafeValue(bs.srn ?? bs.arn),
  }));
}
