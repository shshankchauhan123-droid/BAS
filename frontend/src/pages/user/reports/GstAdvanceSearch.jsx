import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../../context/AuthContext";
import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { searchGstAdvance } from "../../../services/api/gst";
import { exportGstReportPdf } from "../../../utils/gstPdfExport";

// Standard Indian GSTIN Regex Pattern
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Safely format address object or string into readable address line
 */
function formatAddress(addrObj) {
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
 * Safe string normalization helper
 * Distinguishes null/undefined while preserving numeric 0 and boolean false.
 */
function getFieldVal(obj, ...keys) {
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
function formatSafeValue(val, fallback = "-") {
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
function formatPercentage(val, fallback = "-") {
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
function formatRegistrationDate(val) {
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
const normalizeRecords = (value) => {
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

export default function GstAdvanceSearch() {
  // Search form state
  const [gstNumber, setGstNumber] = useState("");
  const [hsnDetails, setHsnDetails] = useState(true);
  const [branchDetails, setBranchDetails] = useState(true);
  const [filingDetails, setFilingDetails] = useState(true);
  const [filingFrequency, setFilingFrequency] = useState(true);
  const [liabilityPaidDetails, setLiabilityPaidDetails] = useState(true);

  // UI / Request state
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [apiError, setApiError] = useState("");
  const [searchedGstin, setSearchedGstin] = useState("");
  const [rawResponse, setRawResponse] = useState(null);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [filingActiveTab, setFilingActiveTab] = useState("current"); // 'current' | 'previous'
  const [liabilityActiveTab, setLiabilityActiveTab] = useState("current"); // 'current' | 'previous'
  const [copyNotice, setCopyNotice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Extract nested data payload safely following upstream contract:
  // response -> data -> data -> { basicDetails, branchDetails, hsnDetails, filingDetails, liabilityPaidDetails, filingFrequency, filingFrequencyLastYear }
  const gstData = useMemo(() => {
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
  }, [rawResponse]);

  const basicDetails = useMemo(() => gstData?.basicDetails || {}, [gstData]);
  const branchInfo = useMemo(() => gstData?.branchDetails || {}, [gstData]);
  const hsnInfo = useMemo(() => gstData?.hsnDetails || {}, [gstData]);
  const filingsInfo = useMemo(() => gstData?.filingDetails || {}, [gstData]);

  const currentYearFilings = useMemo(
    () => normalizeRecords(filingsInfo?.currentYear),
    [filingsInfo]
  );
  const previousYearFilings = useMemo(
    () => normalizeRecords(filingsInfo?.previousYear),
    [filingsInfo]
  );

  // Normalize HSN lists
  const goodsList = useMemo(() => {
    const goods = hsnInfo?.goods;
    if (Array.isArray(goods)) return goods;
    return [];
  }, [hsnInfo]);

  const servicesList = useMemo(() => {
    const services = hsnInfo?.services;
    if (Array.isArray(services)) return services;
    return [];
  }, [hsnInfo]);

  // Liability Paid details normalization
  const liabilityData = useMemo(() => {
    const raw = gstData?.liabilityPaidDetails;
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
  }, [gstData]);

  // Input change handler
  const handleGstChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setGstNumber(val);
    if (validationError) {
      setValidationError("");
    }
  };

  // Form Reset / Clear
  const handleReset = () => {
    setGstNumber("");
    setValidationError("");
    setApiError("");
    setRawResponse(null);
    setSearchedGstin("");
    setJsonViewerOpen(false);
    setFilingActiveTab("current");
    setLiabilityActiveTab("current");
    setIsExporting(false);
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const cleanGst = gstNumber.trim().toUpperCase();
    if (!cleanGst) {
      setValidationError("Please enter a 15-character GST Number.");
      return;
    }

    if (!GSTIN_REGEX.test(cleanGst)) {
      setValidationError(
        `Invalid GSTIN format "${cleanGst}". Expected 15-character alphanumeric format (e.g. 37EREPR9114M1Z4).`
      );
      return;
    }

    setValidationError("");
    setApiError("");
    setIsLoading(true);
    setIsExporting(false);

    try {
      const response = await searchGstAdvance({
        gstNumber: cleanGst,
        hsnDetails,
        branchDetails,
        filingDetails,
        filingFrequency,
        liabilityPaidDetails,
      });

      // Handle upstream error inside 200 payload
      if (response?.success === false || response?.errorMessage) {
        setApiError(
          response.errorMessage ||
            response.message ||
            "The external GST service could not find or return data for this GSTIN."
        );
        setRawResponse(response);
      } else if (response?.data?.status === false && response?.data?.errdata) {
        const errDetail =
          typeof response.data.errdata === "string"
            ? response.data.errdata
            : JSON.stringify(response.data.errdata);
        setApiError(`GST API Reported Issue: ${errDetail}`);
        setRawResponse(response);
      } else {
        setRawResponse(response);
        setSearchedGstin(cleanGst);
      }
    } catch (err) {
      console.error("GST Advance Search error:", err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.data?.detail ||
        err?.message ||
        "An unexpected error occurred while communicating with the GST service.";
      setApiError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy raw JSON helper
  const handleCopyJson = () => {
    if (!rawResponse) return;
    navigator.clipboard.writeText(JSON.stringify(rawResponse, null, 2));
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 2000);
  };

  // Complete GST PDF Export handler
  const handleExportPdf = async () => {
    if (isExporting || !rawResponse) return;
    setIsExporting(true);
    try {
      await exportGstReportPdf(rawResponse, searchedGstin || gstNumber);
      Swal.fire({
        icon: "success",
        title: "PDF Export Complete",
        text: "The complete GST Advance Search report has been downloaded successfully.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#059669",
      });
    } catch (err) {
      console.error("GST PDF Export failed:", err);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text:
          err?.message ||
          "An unexpected error occurred while generating the GST PDF report. Please try again.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#e11d48",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Registration and business overview mappings
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

  // Nature of Business Activities
  const businessActivities = useMemo(() => {
    const nba = basicDetails?.businessNature || basicDetails?.nba;
    if (Array.isArray(nba)) return nba;
    if (typeof nba === "string" && nba.trim()) {
      return nba.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [basicDetails]);

  // Branch & Registered Address details
  const permanentAdd = branchInfo?.permanentAdd;
  const principalAddress = useMemo(() => {
    if (typeof permanentAdd === "string" && permanentAdd.trim()) {
      return permanentAdd;
    }
    if (permanentAdd && typeof permanentAdd === "object") {
      if (permanentAdd.address && typeof permanentAdd.address === "string") {
        return permanentAdd.address;
      }
    }
    if (branchInfo?.pradr) {
      return formatAddress(branchInfo.pradr?.addr || branchInfo.pradr);
    }
    return "-";
  }, [permanentAdd, branchInfo]);

  const principalDealsIn = permanentAdd?.dealsIn || branchInfo?.pradr?.ntr || null;

  const additionalAddresses = useMemo(() => {
    const list = branchInfo?.additionalAdd || branchInfo?.adadr;
    if (!Array.isArray(list)) return [];
    return list;
  }, [branchInfo]);

  // Filing Frequency metrics
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

  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const hasGstPermission =
    isSuperAdmin ||
    isClientAdmin ||
    Boolean(user?.permissions?.can_gst_advance_search ?? user?.permissions?.gst_advance_search);

  if (!hasGstPermission) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col font-sans">
        <BASNavbar />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#172554]">Access Denied</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              You do not have permission to access FACT GST Advance Search. Please contact your Client Administrator to request access.
            </p>
            <div className="mt-6">
              <Link
                to="/dashboard"
                className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
        <UserFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col font-sans">
      <BASNavbar />

      <main className="flex-1 pb-16">
        {/* ============================================================
            A. PAGE HEADER
        ============================================================ */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    FACT Intelligence
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-500">
                    GST Verification & Taxpayer Analytics
                  </span>
                </div>
                <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                  GST Advance Search
                </h1>
                <p className="mt-1 text-xs text-[#64748B]">
                  Query live GSTIN records, registration status, HSN classification, filing history, and liability metrics via FACT API.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Reports Hub
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* ============================================================
              B. SEARCH FORM CARD
          ============================================================ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#172554]">
                    Taxpayer Search Criteria
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter a 15-character GST Identification Number (GSTIN) and select optional datasets to retrieve.
                  </p>
                </div>
              </div>

              {rawResponse && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Clear Form & Results
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* GSTIN Input Field */}
              <div>
                <label
                  htmlFor="gstNumber"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  GST Number (GSTIN) <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xl">
                  <input
                    id="gstNumber"
                    name="gstNumber"
                    type="text"
                    value={gstNumber}
                    onChange={handleGstChange}
                    placeholder="e.g. 37EREPR9114M1Z4"
                    maxLength={15}
                    disabled={isLoading}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-sm font-mono tracking-wider font-bold transition uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal",
                      validationError
                        ? "border-red-300 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
                    ].join(" ")}
                  />
                  {gstNumber && (
                    <span className="absolute right-3.5 top-3.5 text-xs font-mono font-bold text-slate-400">
                      {gstNumber.length}/15
                    </span>
                  )}
                </div>
                {validationError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {validationError}
                  </p>
                )}
              </div>

              {/* Optional Detail Checkboxes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Query Options & Datasets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* HSN Details */}
                  <label
                    className={[
                      "flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition select-none",
                      hsnDetails
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={hsnDetails}
                      onChange={(e) => setHsnDetails(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">HSN Details</span>
                  </label>

                  {/* Branch Details */}
                  <label
                    className={[
                      "flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition select-none",
                      branchDetails
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={branchDetails}
                      onChange={(e) => setBranchDetails(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Branch Details</span>
                  </label>

                  {/* Filing Details */}
                  <label
                    className={[
                      "flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition select-none",
                      filingDetails
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={filingDetails}
                      onChange={(e) => setFilingDetails(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Filing Details</span>
                  </label>

                  {/* Filing Frequency */}
                  <label
                    className={[
                      "flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition select-none",
                      filingFrequency
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={filingFrequency}
                      onChange={(e) => setFilingFrequency(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Filing Frequency</span>
                  </label>

                  {/* Liability Paid Details */}
                  <label
                    className={[
                      "flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition select-none",
                      liabilityPaidDetails
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={liabilityPaidDetails}
                      onChange={(e) => setLiabilityPaidDetails(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Liability Paid</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !gstNumber}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-sm transition",
                    isLoading || !gstNumber
                      ? "bg-emerald-400 cursor-not-allowed opacity-70"
                      : "bg-emerald-600 hover:bg-emerald-700 active:scale-98",
                  ].join(" ")}
                >
                  {isLoading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Searching FACT GST API...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search GST</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Clear / Reset
                </button>
              </div>
            </form>
          </section>

          {/* ============================================================
              C. API ERROR / WARNING BANNER
          ============================================================ */}
          {apiError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-3 shadow-2xs">
              <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1">
                <p className="font-bold text-red-900">GST API Request Notice</p>
                <p className="mt-0.5 text-red-700">{apiError}</p>
              </div>
              <button
                type="button"
                onClick={() => setApiError("")}
                className="text-red-400 hover:text-red-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* ============================================================
              D. RESULTS DASHBOARD
          ============================================================ */}
          {gstData && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Bar with Action & Info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-emerald-900">
                      Live GST Record: <span className="font-mono">{searchedGstin || basicDetails?.gstin}</span>
                    </span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-xs text-slate-600">
                      Status: <strong className="text-emerald-800">{regStatus}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExporting || !rawResponse}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold shadow-2xs transition",
                      isExporting
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-not-allowed opacity-80"
                        : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98",
                    ].join(" ")}
                    title="Export complete GST search report as PDF"
                  >
                    {isExporting ? (
                      <>
                        <svg className="h-3.5 w-3.5 animate-spin text-emerald-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Export PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setJsonViewerOpen(!jsonViewerOpen)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                  >
                    <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {jsonViewerOpen ? "Hide Raw JSON" : "View Raw JSON"}
                  </button>
                </div>
              </div>

              {/* 1. REGISTRATION SUMMARY CARDS */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Registration & Business Overview
                  </h3>
                </div>

                {/* Primary Metric Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* GSTIN Tile */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      GSTIN
                    </p>
                    <p className="mt-1 text-base font-black font-mono text-[#172554]">
                      {gstinVal}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      State Code: {gstinVal !== "-" ? gstinVal.slice(0, 2) : "-"}
                    </p>
                  </div>

                  {/* Status Tile */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Registration Status
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                          String(regStatus).toLowerCase() === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800",
                        ].join(" ")}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${String(regStatus).toLowerCase() === "active" ? "bg-emerald-600" : "bg-red-600"}`} />
                        {regStatus}
                      </span>
                    </div>
                    {cancelDate && (
                      <p className="mt-1 text-[11px] text-red-600">
                        Cancelled: {cancelDate}
                      </p>
                    )}
                  </div>

                  {/* Taxpayer Type */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Taxpayer Type
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#172554]">
                      {regType}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Reg Date: {regDate}
                    </p>
                  </div>

                  {/* Aggregate Turnover */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Aggregate Turnover
                    </p>
                    <p className="mt-1 text-sm font-black text-emerald-800">
                      {aggregateTurnover}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      FY: {turnoverFY ? turnoverFY : "Unavailable"}
                    </p>
                  </div>
                </div>

                {/* Detailed Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Legal Name of Business
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{legalName}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Trade Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{tradeName}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Constitution of Business
                    </span>
                    <span className="font-semibold text-slate-800">{constitution}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      State Jurisdiction
                    </span>
                    <span className="font-semibold text-slate-800">{jurisdiction}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Central Tax Jurisdiction (CTJ)
                    </span>
                    <span className="font-semibold text-slate-800">{ctj}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      E-Invoice Status
                    </span>
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      {einvoiceStatus}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Aadhaar Verification Status
                    </span>
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      {aadhaarStatus}
                    </span>
                  </div>
                </div>

                {/* Nature of Business Activities */}
                {businessActivities.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-2">
                      Nature of Business Activities
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {businessActivities.map((act, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-900"
                        >
                          {act}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 2. BRANCH & ADDRESS DETAILS */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Branch & Registered Address Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Principal Place of Business */}
                  <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        Principal Place of Business
                      </span>
                      {principalDealsIn && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Deals In: {principalDealsIn}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-800 leading-relaxed">
                      {principalAddress}
                    </p>
                  </div>

                  {/* Additional Places */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                        Additional Places of Business ({additionalAddresses.length})
                      </span>
                    </div>

                    {additionalAddresses.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {additionalAddresses.map((place, idx) => {
                          const addrText = typeof place === "string" ? place : place?.address || formatAddress(place?.addr || place);
                          const dealsInText = place?.dealsIn || place?.ntr || null;
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-slate-700">
                              <span className="font-bold text-slate-900 block mb-0.5">
                                Branch #{idx + 1} {dealsInText ? `(${dealsInText})` : ""}
                              </span>
                              <span>{addrText}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No additional branch addresses recorded for this taxpayer.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* 3. HSN GOODS & SERVICES */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    HSN / SAC Classification
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Goods Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Goods ({goodsList.length})
                      </h4>
                    </div>

                    {goodsList.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                              <th className="px-3.5 py-2.5 font-mono">HSN Code</th>
                              <th className="px-3.5 py-2.5">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {goodsList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">
                                  {item.hsnCode || item.hsn_cd || item.code || "-"}
                                </td>
                                <td className="px-3.5 py-2 text-slate-700">
                                  {item.hsnDescription || item.desc || item.description || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 italic">
                        No HSN Goods classification items reported.
                      </p>
                    )}
                  </div>

                  {/* Services Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Services ({servicesList.length})
                      </h4>
                    </div>

                    {servicesList.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                              <th className="px-3.5 py-2.5 font-mono">SAC Code</th>
                              <th className="px-3.5 py-2.5">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {servicesList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="px-3.5 py-2 font-mono font-bold text-blue-700">
                                  {item.hsnCode || item.hsn_cd || item.sacCode || item.code || "-"}
                                </td>
                                <td className="px-3.5 py-2 text-slate-700">
                                  {item.hsnDescription || item.desc || item.description || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 italic">
                        No HSN Services classification items reported.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* 4. FILING HISTORY TABLE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                      GST Return Filing History
                    </h3>
                  </div>

                  {/* Tabs for Current Year vs Previous Year */}
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setFilingActiveTab("current")}
                      className={[
                        "rounded-lg px-3.5 py-1 text-xs font-bold transition",
                        filingActiveTab === "current"
                          ? "bg-white text-[#172554] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900",
                      ].join(" ")}
                    >
                      Current Financial Year ({currentYearFilings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilingActiveTab("previous")}
                      className={[
                        "rounded-lg px-3.5 py-1 text-xs font-bold transition",
                        filingActiveTab === "previous"
                          ? "bg-white text-[#172554] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900",
                      ].join(" ")}
                    >
                      Previous Financial Year ({previousYearFilings.length})
                    </button>
                  </div>
                </div>

                {/* Filing Table */}
                {(() => {
                  const records = filingActiveTab === "current" ? currentYearFilings : previousYearFilings;
                  if (records.length === 0) {
                    return (
                      <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                        No filing records available for this financial year period.
                      </p>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-3.5 py-2.5">Financial Year</th>
                            <th className="px-3.5 py-2.5">Period</th>
                            <th className="px-3.5 py-2.5">Return Type</th>
                            <th className="px-3.5 py-2.5">Filing Date</th>
                            <th className="px-3.5 py-2.5">Mode</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5 font-mono">ARN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {records.map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3.5 py-2.5 font-bold text-slate-800">
                                {r.finYear || r.fy || "-"}
                              </td>
                              <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                                {r.period || r.taxp || "-"}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span className="inline-block rounded-md bg-purple-50 border border-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                                  {r.returnType || r.rtntype || "-"}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-600">
                                {formatRegistrationDate(r.filingDate || r.dof || "-")}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-600">
                                {r.mode || r.mof || "-"}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span
                                  className={[
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                                    String(r.status).toLowerCase() === "filed"
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-amber-50 text-amber-800 border border-amber-200",
                                  ].join(" ")}
                                >
                                  {r.status || "-"}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">
                                {r.arn || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </section>

              {/* 5. LIABILITY PAID & FILING FREQUENCY */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liability Paid Details (2 cols) */}
                <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                          Liability Paid Analysis
                        </h3>
                        <p className="text-xs text-slate-500">
                          Period-wise liability payment percentage metrics.
                        </p>
                      </div>
                    </div>

                    {/* Tabs for Liability Paid: Current Year vs Previous Year */}
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setLiabilityActiveTab("current")}
                          className={[
                            "rounded-lg px-3 py-1 text-xs font-bold transition",
                            liabilityActiveTab === "current"
                              ? "bg-white text-[#172554] shadow-2xs"
                              : "text-slate-600 hover:text-slate-900",
                          ].join(" ")}
                        >
                          {liabilityData.currFinYear || "Current FY"} ({liabilityData.currDetails.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiabilityActiveTab("previous")}
                          className={[
                            "rounded-lg px-3 py-1 text-xs font-bold transition",
                            liabilityActiveTab === "previous"
                              ? "bg-white text-[#172554] shadow-2xs"
                              : "text-slate-600 hover:text-slate-900",
                          ].join(" ")}
                        >
                          {liabilityData.prevFinYear || "Previous FY"} ({liabilityData.prevDetails.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Previous Year Total Indicator if applicable */}
                  {liabilityActiveTab === "previous" && liabilityData.prevTotal_pct !== null && (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-2 text-xs">
                      <span className="font-semibold text-emerald-900">
                        Previous Year Total Liability Paid:
                      </span>
                      <span className="font-bold font-mono text-emerald-800 text-sm">
                        {formatPercentage(liabilityData.prevTotal_pct)}
                      </span>
                    </div>
                  )}

                  {/* Liability Table */}
                  {(() => {
                    const activeRecords =
                      liabilityActiveTab === "current"
                        ? liabilityData.currDetails
                        : liabilityData.prevDetails;
                    const activeFy =
                      liabilityActiveTab === "current"
                        ? liabilityData.currFinYear || "Current FY"
                        : liabilityData.prevFinYear || "Previous FY";

                    if (activeRecords.length === 0) {
                      return (
                        <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                          No liability paid percentage records returned.
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="px-3.5 py-2.5">Financial Year</th>
                              <th className="px-3.5 py-2.5">Period</th>
                              <th className="px-3.5 py-2.5">Liability Paid %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {activeRecords.map((item, idx) => {
                              const val =
                                item.liabPaid_Pct !== undefined
                                  ? item.liabPaid_Pct
                                  : item.liabilityPaid !== undefined
                                  ? item.liabilityPaid
                                  : item.lpr;
                              const displayVal = formatPercentage(val);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="px-3.5 py-2.5 font-bold text-slate-800">
                                    {item.fy || activeFy}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                                    {item.period || item.taxp || "-"}
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <span className="font-bold text-emerald-800 font-mono">
                                      {displayVal}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </section>

                {/* Filing Frequency Summary (1 col) */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                      Filing Frequency
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Current Financial Year
                      </span>
                      <p className="mt-1 text-base font-black text-[#172554]">
                        {filingFrequencyCurrent}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Previous Financial Year
                      </span>
                      <p className="mt-1 text-base font-black text-[#172554]">
                        {filingFrequencyPrevious}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* 6. COLLAPSIBLE RAW JSON DEBUG VIEWER */}
              {jsonViewerOpen && (
                <section className="rounded-2xl border border-slate-300 bg-slate-900 p-5 text-white shadow-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <h4 className="text-xs font-bold font-mono tracking-wider text-slate-200">
                        FACT GST API RAW JSON RESPONSE
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCopyJson}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs font-bold text-emerald-400 transition"
                      >
                        {copyNotice ? "Copied!" : "Copy JSON"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonViewerOpen(false)}
                        className="text-slate-400 hover:text-white text-xs font-bold"
                      >
                        ✕ Close
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] font-mono text-emerald-400/90 leading-relaxed">
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <UserFooter />
    </div>
  );
}
