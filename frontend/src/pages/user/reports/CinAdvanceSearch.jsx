import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../../context/AuthContext";
import BASNavbar from "../../../components/layout/UserNavbar";
import UserFooter from "../../../components/layout/UserFooter";
import { searchCinAdvance } from "../../../services/api/cin";
import {
  extractCinData,
  mapCompanyDetails,
  mapDirectors,
  mapCharges,
  mapAnnualReturns,
  mapBalanceSheets,
} from "../../../utils/cinMapping";
import { exportCinReportPdf } from "../../../utils/cinPdfExport";

// Permissive regex for CIN / search identifier
const SEARCH_NUMBER_REGEX = /^[A-Za-z0-9\-_/]{3,35}$/;

export default function CinAdvanceSearch() {
  // Search form state
  const [searchNumber, setSearchNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [apiError, setApiError] = useState("");
  const [searchedCin, setSearchedCin] = useState("");
  const [rawResponse, setRawResponse] = useState(null);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Extract nested company data payload safely handling any wrapper nesting
  const companyData = useMemo(() => {
    return extractCinData(rawResponse);
  }, [rawResponse]);

  // Normalized company details
  const companyDetails = useMemo(() => {
    return mapCompanyDetails(companyData);
  }, [companyData]);

  // Normalized directors with unique count vs total role records vs API reported count
  const directorsData = useMemo(() => {
    return mapDirectors(companyData?.cIN_DINs, companyData?.nofDirectors);
  }, [companyData]);

  // Normalized charges list
  const chargesList = useMemo(() => {
    return mapCharges(companyData?.cIN_Charges);
  }, [companyData]);

  // Normalized annual returns list
  const annualReturnsList = useMemo(() => {
    return mapAnnualReturns(companyData?.annualReturnFillingInfo);
  }, [companyData]);

  // Normalized balance sheet list
  const balanceSheetList = useMemo(() => {
    return mapBalanceSheets(companyData?.balanceSheet);
  }, [companyData]);

  // Input change handler
  const handleInputChange = (e) => {
    const val = e.target.value.replace(/[^A-Za-z0-9\-_/]/g, "").slice(0, 35);
    setSearchNumber(val);
    if (validationError) {
      setValidationError("");
    }
  };

  // Form Reset / Clear
  const handleReset = () => {
    setSearchNumber("");
    setValidationError("");
    setApiError("");
    setRawResponse(null);
    setSearchedCin("");
    setJsonViewerOpen(false);
    setIsExporting(false);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const cleanInput = searchNumber.trim();
    if (!cleanInput) {
      setValidationError("Please enter a CIN or company search number.");
      return;
    }

    if (!SEARCH_NUMBER_REGEX.test(cleanInput)) {
      setValidationError(
        `Invalid format "${cleanInput}". Please enter a valid company identifier (3 to 35 alphanumeric characters).`
      );
      return;
    }

    setValidationError("");
    setApiError("");
    setIsLoading(true);
    setIsExporting(false);

    try {
      const response = await searchCinAdvance(cleanInput);

      // Handle upstream failure in response body
      if (response?.success === false || response?.errorMessage) {
        setApiError(
          response.errorMessage ||
            response.message ||
            "The external CIN service could not find or return company data for this identifier."
        );
        setRawResponse(response);
      } else if (response?.data?.status === false && response?.data?.errdata) {
        const errDetail =
          typeof response.data.errdata === "string"
            ? response.data.errdata
            : JSON.stringify(response.data.errdata);
        setApiError(`CIN Service Reported Issue: ${errDetail}`);
        setRawResponse(response);
      } else {
        setRawResponse(response);
        setSearchedCin(cleanInput);
      }
    } catch (err) {
      console.error("CIN Advance Search error:", err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.data?.detail ||
        err?.message ||
        "An unexpected error occurred while communicating with the CIN service.";
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

  // Complete CIN PDF Export handler
  const handleExportPdf = async () => {
    if (isExporting || !rawResponse) return;
    setIsExporting(true);
    try {
      await exportCinReportPdf(rawResponse, searchedCin || searchNumber);
      Swal.fire({
        icon: "success",
        title: "PDF Export Complete",
        text: "The complete CIN Advance Search report has been downloaded successfully.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#059669",
      });
    } catch (err) {
      console.error("CIN PDF Export failed:", err);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text:
          err?.message ||
          "An unexpected error occurred while generating the CIN PDF report. Please try again.",
        background: "#ffffff",
        color: "#172554",
        confirmButtonColor: "#e11d48",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
  const isClientAdmin = userRole === "client_admin";
  const hasCinPermission =
    isSuperAdmin ||
    isClientAdmin ||
    Boolean(user?.permissions?.can_cin_advance_search ?? user?.permissions?.cin_advance_search);

  if (!hasCinPermission) {
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
              You do not have permission to access FACT CIN Advance Search. Please contact your Client Administrator to request access.
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

  const isStatusActive =
    String(companyDetails?.companyStatus || "").toLowerCase() === "active";

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
                    MCA & Corporate Identification Registry
                  </span>
                </div>
                <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                  CIN Advance Search
                </h1>
                <p className="mt-1 text-xs text-[#64748B]">
                  Retrieve comprehensive corporate registration, directors (DIN), ROC filings, charges, and financial compliance details via FACT API.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/reports/fact/gst"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  GST Advance Search
                </Link>
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#172554]">
                    Company Identification Query
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter a Corporate Identification Number (CIN), LLPIN, or registration search identifier.
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="searchNumber"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  CIN / Company Search Identifier <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xl">
                  <input
                    id="searchNumber"
                    name="searchNumber"
                    type="text"
                    value={searchNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. ADB-0675, ADD-5165, or U72200TG2020PTC123456"
                    maxLength={35}
                    disabled={isLoading}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-sm font-mono tracking-wider font-bold transition uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal",
                      validationError
                        ? "border-red-300 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
                    ].join(" ")}
                  />
                  {searchNumber && (
                    <span className="absolute right-3.5 top-3.5 text-xs font-mono font-bold text-slate-400">
                      {searchNumber.length} chars
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

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !searchNumber}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-sm transition",
                    isLoading || !searchNumber
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
                      <span>Searching FACT CIN API...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search CIN</span>
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
                <p className="font-bold text-red-900">CIN API Request Notice</p>
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
          {companyData && (
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
                      Company Record: <span className="font-mono">{companyDetails.cin !== "Not available" ? companyDetails.cin : searchedCin}</span>
                    </span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-xs text-slate-600">
                      Status: <strong className="text-emerald-800">{companyDetails.companyStatus}</strong>
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
                    title="Export complete CIN search report as PDF"
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

              {/* 1. COMPANY OVERVIEW SECTION */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Company Information & Capital Structure
                  </h3>
                </div>

                {/* Primary Metric Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Company Name & CIN Tile */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Company CIN
                    </p>
                    <p className="mt-1 text-base font-black font-mono text-[#172554] truncate" title={companyDetails.cin}>
                      {companyDetails.cin}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600 truncate" title={companyDetails.companyName}>
                      {companyDetails.companyName}
                    </p>
                  </div>

                  {/* Company Status Tile */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Company Status
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                          isStatusActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800",
                        ].join(" ")}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isStatusActive ? "bg-emerald-600" : "bg-amber-600"}`} />
                        {companyDetails.companyStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Class: {companyDetails.companyClass}
                    </p>
                  </div>

                  {/* Authorized Capital Tile */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Authorized Capital
                    </p>
                    <p className="mt-1 text-sm font-black text-emerald-800">
                      {companyDetails.authorizedCapitalFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Paid-up: {companyDetails.paidupCapitalFormatted}
                    </p>
                  </div>

                  {/* Registration Date & ROC */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Registration Date
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#172554]">
                      {companyDetails.registrationDate}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      ROC: {companyDetails.rocCode}
                    </p>
                  </div>
                </div>

                {/* Company Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Company Legal Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{companyDetails.companyName}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Company Category
                    </span>
                    <span className="font-semibold text-slate-800">{companyDetails.companyCategory}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Company Subcategory
                    </span>
                    <span className="font-semibold text-slate-800">{companyDetails.companySubCategory}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Listing Status
                    </span>
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      {companyDetails.listingStatus}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Origin Type
                    </span>
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      {companyDetails.originType}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      Directors Overview
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-800 text-sm">
                        {directorsData.uniqueDirectorCount} Unique
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
                        {directorsData.totalRoleRecords} Roles
                      </span>
                      {directorsData.apiReportedCount !== null && (
                        <span className="text-[10px] font-medium text-slate-400">
                          (API: {directorsData.apiReportedCount})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. REGISTERED OFFICE & LOCATION */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Registered Office & Location Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address Card */}
                  <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded inline-block mb-2">
                      Registered Office Address
                    </span>
                    <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                      {companyDetails.registeredOfficeAddress}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 border-t border-emerald-100/60 pt-2.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">City</span>
                        <span>{companyDetails.city}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">State</span>
                        <span>{companyDetails.state}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Pincode</span>
                        <span>{companyDetails.pincode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Country</span>
                        <span>{companyDetails.country}</span>
                      </div>
                    </div>
                  </div>

                  {/* Regional Director & Jurisdictional Office */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded inline-block">
                      Jurisdiction & Regulatory Office
                    </span>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-500 uppercase text-[10px] block">Regional Director (RD)</span>
                        <span className="font-semibold text-slate-800">{companyDetails.rdName}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 uppercase text-[10px] block">RD Region</span>
                        <span className="font-semibold text-slate-800">{companyDetails.rdRegion}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 uppercase text-[10px] block">State Code</span>
                        <span className="font-semibold text-slate-800">{companyDetails.stateCode}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 uppercase text-[10px] block">Official Email</span>
                        <span className="font-semibold text-blue-700">{companyDetails.officialEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. COMPLIANCE & FILING DATES */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Compliance & Statutory Filings Overview
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Date of Last AGM
                    </span>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {companyDetails.lastAgm}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Date of Last Balance Sheet
                    </span>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {companyDetails.lastBalanceSheet}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Number of Members
                    </span>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {companyDetails.numberOfMembers}
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. DIRECTORS AND DIN TABLE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                      Directors & Key Managerial Personnel
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {directorsData.uniqueDirectorCount} Unique Directors
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {directorsData.totalRoleRecords} Total Roles
                    </span>
                    {directorsData.apiReportedCount !== null && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        API Reported: {directorsData.apiReportedCount}
                      </span>
                    )}
                  </div>
                </div>

                {directorsData.records.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3.5 py-2.5">Director Name</th>
                          <th className="px-3.5 py-2.5 font-mono">DIN</th>
                          <th className="px-3.5 py-2.5">Designation</th>
                          <th className="px-3.5 py-2.5">Date Appointed</th>
                          <th className="px-3.5 py-2.5">Date Resigned</th>
                          <th className="px-3.5 py-2.5">DSC Expiry</th>
                          <th className="px-3.5 py-2.5">Companies</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {directorsData.records.map((dir, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">
                              {dir.name}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-emerald-700">
                              {dir.din}
                            </td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                              <span className="inline-block rounded bg-purple-50 border border-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                                {dir.designation}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {dir.dateJoin}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {dir.dateResign}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {dir.dscExpiry}
                            </td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-700">
                              {dir.noOfCompanies}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                    No directors or key managerial personnel recorded for this company.
                  </p>
                )}
              </section>

              {/* 5. CIN CHARGES TABLE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                    Registered Charges & Encumbrances ({chargesList.length})
                  </h3>
                </div>

                {chargesList.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3.5 py-2.5 font-mono">Charge ID</th>
                          <th className="px-3.5 py-2.5">Charge Holder</th>
                          <th className="px-3.5 py-2.5">Creation Date</th>
                          <th className="px-3.5 py-2.5">Modification Date</th>
                          <th className="px-3.5 py-2.5">Satisfaction Date</th>
                          <th className="px-3.5 py-2.5">Charge Amount</th>
                          <th className="px-3.5 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {chargesList.map((chg, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800">
                              {chg.chargeId}
                            </td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">
                              {chg.holderName}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {chg.dateOfCreation}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {chg.dateOfModification}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {chg.dateOfSatisfaction}
                            </td>
                            <td className="px-3.5 py-2.5 font-black text-emerald-800">
                              {chg.chargeAmountFormatted}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className={[
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  String(chg.status || "").toLowerCase() === "open"
                                    ? "bg-red-50 text-red-800 border border-red-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200",
                                ].join(" ")}
                              >
                                {chg.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                    No registered charges or encumbrances found for this company.
                  </p>
                )}
              </section>

              {/* 6. ANNUAL RETURN FILING & BALANCE SHEET SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Annual Return Filing Info */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                      Annual Return Filings ({annualReturnsList.length})
                    </h3>
                  </div>

                  {annualReturnsList.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-3 py-2">FY</th>
                            <th className="px-3 py-2">AGM Date</th>
                            <th className="px-3 py-2">Filing Date</th>
                            <th className="px-3 py-2">Form</th>
                            <th className="px-3 py-2 font-mono">SRN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {annualReturnsList.map((ret, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-bold text-slate-800">
                                {ret.financialYear}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {ret.agmDate}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {ret.filingDate}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-block rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                  {ret.form}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                {ret.srn}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                      No annual return filing records returned.
                    </p>
                  )}
                </section>

                {/* Balance Sheet Information */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#172554]">
                      Balance Sheet Filings ({balanceSheetList.length})
                    </h3>
                  </div>

                  {balanceSheetList.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-3 py-2">FY</th>
                            <th className="px-3 py-2">Filing Date</th>
                            <th className="px-3 py-2">Form</th>
                            <th className="px-3 py-2 font-mono">SRN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {balanceSheetList.map((bs, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-bold text-slate-800">
                                {bs.financialYear}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {bs.filingDate}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-block rounded bg-purple-50 border border-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                                  {bs.form}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                {bs.srn}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400 italic">
                      No balance sheet filing records returned.
                    </p>
                  )}
                </section>
              </div>

              {/* 7. RAW JSON DEBUG VIEWER */}
              {jsonViewerOpen && (
                <section className="rounded-2xl border border-slate-300 bg-slate-900 p-5 text-white shadow-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <h4 className="text-xs font-bold font-mono tracking-wider text-slate-200">
                        FACT CIN API RAW JSON RESPONSE
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
