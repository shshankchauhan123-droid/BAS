import React, { useEffect, useMemo, useState } from "react";
import { getNcrpAccountProfile } from "../../services/api/ncrp";

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = Number(amount);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function maskAccountNumber(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.length <= 4) return s;
  if (s.length <= 6) return s.slice(0, 1) + "X".repeat(s.length - 2) + s.slice(-1);
  return s.slice(0, 2) + "X".repeat(s.length - 6) + s.slice(-4);
}

export default function NcrpAccountPanel({
  account,
  fileId,
  caseId,
  rootAccount,
  onExpandInGraph,
  onSelectAccount,
  onClose,
  isCollapsible = false,
  moneyTransferOnly = true,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAccountWideSection, setShowAccountWideSection] = useState(false);
  const [showAccountWideTransfers, setShowAccountWideTransfers] = useState(false);

  // Section C worksheet active tab
  const [activeSheetTab, setActiveSheetTab] = useState("money_transfer");
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetPage, setSheetPage] = useState(1);

  const PAGE_SIZE = 5;

  // Fetch account profile when account, fileId, caseId, or rootAccount changes
  useEffect(() => {
    if (!account || !fileId) {
      setProfile(null);
      setError(null);
      return;
    }

    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        setShowFullAccount(false);
        setSheetPage(1);
        setSheetSearch("");
        setShowAccountWideTransfers(false);

        const res = await getNcrpAccountProfile(fileId, account, {
          caseId,
          moneyTransferOnly,
          rootAccount,
        });
        if (isMounted) {
          const data = res?.data || res;
          setProfile(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load account profile:", err);
          setError(err?.message || "Failed to load account profile.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [account, fileId, caseId, moneyTransferOnly, rootAccount]);

  const handleCopyAccount = (accToCopy = account) => {
    if (!accToCopy) return;
    navigator.clipboard.writeText(String(accToCopy));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 6 NCRP Worksheets collections extraction (selected path vs account-wide)
  const moneyTransfers = useMemo(() => {
    if (showAccountWideTransfers && profile?.account_wide_money_transfers) {
      return profile.account_wide_money_transfers;
    }
    return profile?.money_transfers || [];
  }, [profile, showAccountWideTransfers]);

  const posWithdrawals = useMemo(() => profile?.pos_withdrawals || [], [profile]);
  const atmWithdrawals = useMemo(() => profile?.atm_withdrawals || [], [profile]);
  const chequeWithdrawals = useMemo(() => profile?.cheque_withdrawals || [], [profile]);
  const holdRecords = useMemo(() => profile?.hold_records || [], [profile]);
  const otherRecords = useMemo(() => profile?.other_records || [], [profile]);

  // Active collection based on tab or moneyTransferOnly
  const activeRecords = useMemo(() => {
    if (moneyTransferOnly) return moneyTransfers;
    switch (activeSheetTab) {
      case "money_transfer":
        return moneyTransfers;
      case "pos":
        return posWithdrawals;
      case "atm":
        return atmWithdrawals;
      case "cheque":
        return chequeWithdrawals;
      case "hold":
        return holdRecords;
      case "other":
        return otherRecords;
      default:
        return moneyTransfers;
    }
  }, [moneyTransferOnly, activeSheetTab, moneyTransfers, posWithdrawals, atmWithdrawals, chequeWithdrawals, holdRecords, otherRecords]);

  // Filtered records based on local search
  const filteredRecords = useMemo(() => {
    if (!sheetSearch.trim()) return activeRecords;
    const q = sheetSearch.toLowerCase().trim();
    return activeRecords.filter((r) => {
      const matchUtr = r.utr?.toLowerCase().includes(q);
      const matchBank = (r.bank || r.sender_bank || r.receiver_bank)?.toLowerCase().includes(q);
      const matchAcc = (r.sender_account || r.receiver_account || r.account)?.toLowerCase().includes(q);
      const matchRemarks = r.remarks?.toLowerCase().includes(q);
      const matchAtm = r.atm_id?.toLowerCase().includes(q);
      const matchMerchant = r.merchant_name?.toLowerCase().includes(q);
      const matchCheque = r.cheque_no?.toLowerCase().includes(q);
      const matchRow = String(r.row_number || "").includes(q);
      return matchUtr || matchBank || matchAcc || matchRemarks || matchAtm || matchMerchant || matchCheque || matchRow;
    });
  }, [activeRecords, sheetSearch]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (sheetPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, sheetPage]);

  // Connected accounts list for Section D
  const connectedAccounts = useMemo(() => profile?.connected_accounts || [], [profile]);

  if (!account) {
    return (
      <div className="h-full rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <h4 className="text-sm font-bold text-[#172554]">
          Select an Account Node
        </h4>
        <p className="text-xs text-[#64748B] max-w-xs mt-1">
          Click any account card in the hierarchical money flow network to view its complete 360° forensic profile and all 6 NCRP worksheet records.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full max-h-[820px] rounded-2xl border border-[#E2E8F0] bg-white shadow-sm flex flex-col overflow-hidden">
      {/* Panel Top Header */}
      <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172554] truncate">
              Forensic Account Profile
            </h3>
            <span className="text-[10px] text-[#64748B] truncate block">
              Multi-Layer Ledger & NCRP Worksheets
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {profile?.has_hold && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Hold / Lien
            </span>
          )}

          {isCollapsible && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#172554] hover:bg-slate-100 transition-colors"
              title="Close Panel"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Independently Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-8 w-8 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
            <p className="text-xs font-medium text-[#64748B]">
              Loading 360° worksheet profile...
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {!loading && !error && profile && (
          <>
            {/* ========================================================
                SECTION A: ACCOUNT OVERVIEW
            ======================================================== */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#F1F5F9]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-600" />
                  Section A • Account Overview
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  profile.account_role?.includes("Source")
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : profile.account_role?.includes("Hold")
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : profile.account_role?.includes("Intermediate")
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {profile.account_role || "Account"}
                </span>
              </div>

              {/* Masked Account Banner with Copy & Reveal */}
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-900 block">
                    Account / Wallet ID
                  </span>
                  <span className="font-mono text-sm font-black text-[#172554] tracking-tight truncate block">
                    {showFullAccount
                      ? profile.account
                      : profile.masked_account || maskAccountNumber(profile.account)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFullAccount((prev) => !prev)}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 flex items-center gap-1 transition-colors"
                    title={showFullAccount ? "Mask Account" : "Reveal Full Account"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {showFullAccount ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                    <span>{showFullAccount ? "Mask" : "Reveal"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyAccount(profile.account)}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 flex items-center gap-1 transition-colors"
                    title="Copy Account Number"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Grid of Metadata Attributes */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Bank / FI Name
                  </span>
                  <span className="font-bold text-[#172554] truncate block" title={profile.bank || profile.bank_name}>
                    {profile.bank || profile.bank_name || "Not Available"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    IFSC / Branch
                  </span>
                  <span className="font-mono font-bold text-[#172554] truncate block">
                    {profile.ifsc || "Not Reported"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Account Holder Name
                  </span>
                  <span className="font-bold text-[#172554] truncate block" title={profile.account_holder_name}>
                    {profile.account_holder_name || "Not Reported"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Acknowledgement No
                  </span>
                  <span className="font-mono font-bold text-purple-700 truncate block">
                    {profile.ack_no || "Not Available"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Layer Recorded
                  </span>
                  <span className="font-bold text-[#172554]">
                    {profile.layer_recorded || "Unrecorded"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Layer Inferred
                  </span>
                  <span className="font-bold text-purple-700">
                    {profile.layer_inferred || (profile.layers?.length ? profile.layers[0] : "Layer 1")}
                  </span>
                </div>
              </div>
            </div>

            {/* ========================================================
                SECTION B: TRANSACTION SUMMARY & FINANCIAL KPIS
            ======================================================== */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#F1F5F9]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Section B • {profile.is_path_isolated ? "Selected Path Financial Summary" : "Financial Summary & KPIs"}
                </h4>
                <span className="text-[10px] text-[#64748B]">
                  Distinct UTRs: <span className="font-bold text-[#172554]">{profile.distinct_utr_count || 0}</span>
                </span>
              </div>

              {/* 6 Primary KPI Cards Grid (Path-Specific for active investigation branch) */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* 1. Total Inflow */}
                <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <span className="text-[10px] font-medium text-emerald-800 block">
                    Total Inflow
                  </span>
                  <span className="text-xs font-bold text-emerald-700 block">
                    ₹{formatIndianCurrency(profile.total_in_amount || profile.inflow_amount || 0)}
                  </span>
                  <span className="text-[9px] text-emerald-600">
                    {profile.incoming_count || 0} incoming transfer(s)
                  </span>
                </div>

                {/* 2. Total Outflow */}
                <div className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/50">
                  <span className="text-[10px] font-medium text-blue-800 block">
                    Total Outflow
                  </span>
                  <span className="text-xs font-bold text-blue-700 block">
                    ₹{formatIndianCurrency(profile.total_out_amount || profile.outflow_amount || 0)}
                  </span>
                  <span className="text-[9px] text-blue-600">
                    {profile.outgoing_count || 0} outgoing transfer(s)
                  </span>
                </div>

                {/* 3. Net Flow */}
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[10px] font-medium text-[#64748B] block">
                    Net Flow
                  </span>
                  <span className={`text-xs font-bold block ${
                    (profile.net_flow || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}>
                    {(profile.net_flow || 0) >= 0 ? "+" : ""}₹{formatIndianCurrency(profile.net_flow || 0)}
                  </span>
                  <span className="text-[9px] text-[#64748B]">
                    Inflow minus Outflow
                  </span>
                </div>

                {/* 4. Disputed Exposure */}
                <div className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/50">
                  <span className="text-[10px] font-medium text-amber-800 block">
                    Disputed Exposure
                  </span>
                  <span className="text-xs font-bold text-amber-700 block">
                    ₹{formatIndianCurrency(profile.total_disputed_amount || profile.disputed_amount || 0)}
                  </span>
                  <span className="text-[9px] text-amber-600">
                    Reported in NCRP
                  </span>
                </div>

                {moneyTransferOnly ? (
                  <>
                    {/* 5. Distinct UTRs */}
                    <div className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
                      <span className="text-[10px] font-medium text-indigo-800 block">
                        Distinct UTRs
                      </span>
                      <span className="text-xs font-bold text-indigo-700 block">
                        {profile.distinct_utr_count || 0}
                      </span>
                      <span className="text-[9px] text-indigo-600">
                        Active path transfers
                      </span>
                    </div>

                    {/* 6. Connected Accounts */}
                    <div className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/50">
                      <span className="text-[10px] font-medium text-purple-800 block">
                        Connected Accounts
                      </span>
                      <span className="text-xs font-bold text-purple-700 block">
                        {profile.distinct_linked_accounts_count || connectedAccounts.length || 0} entities
                      </span>
                      <span className="text-[9px] text-purple-600">
                        Counterparties in path
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 5. Hold / Lien Amount */}
                    <div className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/50">
                      <span className="text-[10px] font-medium text-rose-800 block">
                        Hold / Lien
                      </span>
                      <span className="text-xs font-bold text-rose-700 block">
                        ₹{formatIndianCurrency(profile.total_hold_amount || profile.hold_amount || 0)}
                      </span>
                      <span className="text-[9px] text-rose-600">
                        {profile.hold_count || 0} hold record(s)
                      </span>
                    </div>

                    {/* 6. Withdrawal Volume */}
                    <div className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/50">
                      <span className="text-[10px] font-medium text-purple-800 block">
                        Withdrawal Total
                      </span>
                      <span className="text-xs font-bold text-purple-700 block">
                        ₹{formatIndianCurrency(profile.total_withdrawal_amount || profile.withdrawal_amount || 0)}
                      </span>
                      <span className="text-[9px] text-purple-600">
                        {profile.withdrawal_count || 0} withdrawal(s)
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Observation Span & Counterparties */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] flex items-center justify-between text-[#64748B]">
                <div>
                  <span className="font-semibold text-[#172554] block">Observed Date Span:</span>
                  <span>{profile.first_observed_date || "N/A"} to {profile.last_observed_date || "N/A"}</span>
                </div>
                {!moneyTransferOnly && (
                  <div className="text-right">
                    <span className="font-semibold text-[#172554] block">Connected Accounts:</span>
                    <span className="font-bold text-purple-700">
                      {profile.distinct_linked_accounts_count || connectedAccounts.length || 0} entities
                    </span>
                  </div>
                )}
              </div>

              {/* Branch Isolation Banner & Expandable Account-Wide Summary */}
              {profile.has_unrelated_activity && (
                <div className="mt-3 pt-3 border-t border-[#F1F5F9] space-y-2.5">
                  {/* Isolation Alert Box */}
                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                    <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 space-y-0.5">
                      <span className="font-bold block text-amber-950">
                        Branch Isolation Active
                      </span>
                      <p className="text-[11px] leading-relaxed text-amber-900/90">
                        {profile.isolation_note || `₹${formatIndianCurrency(profile.unrelated_inflow)} from unrelated source account(s) (${profile.unrelated_source_accounts?.join(', ') || 'other branches'}) belongs to an independent branch and is excluded from this path summary.`}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button for Account-Wide Activity */}
                  <button
                    type="button"
                    onClick={() => setShowAccountWideSection((prev) => !prev)}
                    className="w-full py-2 px-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/70 text-purple-800 text-xs font-bold transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Account-Wide Activity (Across All Branches)
                    </span>
                    <span className="text-[11px] text-purple-700 font-mono">
                      {showAccountWideSection ? "Hide Details ▲" : "View Details ▼"}
                    </span>
                  </button>

                  {/* Collapsible Account-Wide Metrics & Breakdown */}
                  {showAccountWideSection && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-white border border-slate-100">
                          <span className="text-[10px] text-[#64748B] block">Workbook Total Inflow</span>
                          <span className="font-bold text-[#172554] text-xs block">
                            ₹{formatIndianCurrency(profile.account_wide_total_in || 0)}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]">
                            (₹{formatIndianCurrency(profile.unrelated_inflow)} outside active branch)
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-slate-100">
                          <span className="text-[10px] text-[#64748B] block">Workbook Total Outflow</span>
                          <span className="font-bold text-[#172554] text-xs block">
                            ₹{formatIndianCurrency(profile.account_wide_total_out || 0)}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]">
                            (₹{formatIndianCurrency(profile.unrelated_outflow)} outside active branch)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1">
                        <span>Workbook Net Flow: <strong className="text-[#172554]">₹{formatIndianCurrency(profile.account_wide_net_flow || 0)}</strong></span>
                        <span>Total Records: <strong className="text-[#172554]">{profile.account_wide_tx_count || 0}</strong></span>
                      </div>

                      {/* Unrelated Transactions List */}
                      {profile.unrelated_money_transfers && profile.unrelated_money_transfers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                            Unrelated Branch Transactions ({profile.unrelated_money_transfers.length}):
                          </span>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {profile.unrelated_money_transfers.map((tx, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-white border border-amber-200/80 text-[10px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-800">
                                    {tx.direction === "INCOMING" ? "Incoming from outside" : "Outgoing to outside"}
                                  </span>
                                  <span className="font-bold text-[#172554]">
                                    ₹{formatIndianCurrency(tx.amount)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[#64748B]">
                                  <span>Counterparty: <strong className="font-mono text-[#172554]">{tx.direction === "INCOMING" ? tx.sender_account : tx.receiver_account}</strong></span>
                                  <span className="font-mono">{tx.utr || "No UTR"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================
                SECTION C: ALL 6 NCRP WORKSHEETS RECORDS
            ======================================================== */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F1F5F9]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  {moneyTransferOnly ? "Section C • Money Transfer Records" : "Section C • All 6 NCRP Worksheets"}
                </h4>
                <span className="text-[10px] text-[#64748B]">
                  {moneyTransferOnly ? `Money Transfer To (${moneyTransfers.length} records)` : "Source Excel Ledger"}
                </span>
              </div>

              {/* View Scope Toggle (Active Branch vs Account-Wide) */}
              {moneyTransferOnly && profile.has_unrelated_activity && (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountWideTransfers(false);
                      setSheetPage(1);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      !showAccountWideTransfers
                        ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                        : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    Active Path ({profile.money_transfers?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountWideTransfers(true);
                      setSheetPage(1);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      showAccountWideTransfers
                        ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                        : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    Account-Wide ({profile.account_wide_money_transfers?.length || profile.money_transfers?.length || 0})
                  </button>
                </div>
              )}

              {/* 6 Tab Switcher */}
              {!moneyTransferOnly && (
                <div className="grid grid-cols-3 gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("money_transfer");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "money_transfer"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">Money Transfer</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "money_transfer" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {moneyTransfers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("pos");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "pos"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">POS Withdrawal</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "pos" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {posWithdrawals.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("atm");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "atm"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">ATM Withdrawal</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "atm" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {atmWithdrawals.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("cheque");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "cheque"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">Cheque / Cash</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "cheque" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {chequeWithdrawals.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("hold");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "hold"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">Put on Hold</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "hold" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {holdRecords.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheetTab("other");
                    setSheetPage(1);
                  }}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition-all border flex flex-col justify-between ${
                    activeSheetTab === "other"
                      ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">Other Records</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 w-fit ${
                    activeSheetTab === "other" ? "bg-purple-200 text-purple-900" : "bg-slate-100 text-[#64748B]"
                  }`}>
                    {otherRecords.length}
                  </span>
                </button>
              </div>
              )}

              {/* Local Search Filter */}
              <div className="relative mb-2.5">
                <input
                  type="text"
                  value={sheetSearch}
                  onChange={(e) => {
                    setSheetSearch(e.target.value);
                    setSheetPage(1);
                  }}
                  placeholder={moneyTransferOnly ? "Filter by UTR, sender, receiver, bank, layer, IFSC, Ack No..." : "Filter by UTR, account, bank, merchant, row..."}
                  className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-xl border border-[#DCE5EF] bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Worksheet Table Container */}
              <div className="rounded-xl border border-[#E2E8F0] overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[9px] tracking-wider">
                      {moneyTransferOnly ? (
                        <tr>
                          <th className="py-2 px-2.5">Sender</th>
                          <th className="py-2 px-2.5">Receiver</th>
                          <th className="py-2 px-2.5">Bank / FI</th>
                          <th className="py-2 px-2.5">UTR / Tx ID</th>
                          <th className="py-2 px-2.5">Date</th>
                          <th className="py-2 px-2.5 text-right">Amount</th>
                          <th className="py-2 px-2.5 text-right">Disputed</th>
                          <th className="py-2 px-2.5">Layer</th>
                          <th className="py-2 px-2.5">IFSC</th>
                          <th className="py-2 px-2.5">Ack No</th>
                        </tr>
                      ) : (
                        <>
                          {activeSheetTab === "money_transfer" && (
                            <tr>
                              <th className="py-2 px-2.5">Direction</th>
                              <th className="py-2 px-2.5">Counterparty</th>
                              <th className="py-2 px-2.5 text-right">Amount</th>
                              <th className="py-2 px-2.5">UTR / Date</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}

                          {activeSheetTab === "pos" && (
                            <tr>
                              <th className="py-2 px-2.5">Date</th>
                              <th className="py-2 px-2.5 text-right">Amount</th>
                              <th className="py-2 px-2.5">Merchant / POS</th>
                              <th className="py-2 px-2.5">UTR / Ref</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}

                          {activeSheetTab === "atm" && (
                            <tr>
                              <th className="py-2 px-2.5">Date</th>
                              <th className="py-2 px-2.5 text-right">Amount</th>
                              <th className="py-2 px-2.5">ATM / Location</th>
                              <th className="py-2 px-2.5">Bank / Ref</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}

                          {activeSheetTab === "cheque" && (
                            <tr>
                              <th className="py-2 px-2.5">Date</th>
                              <th className="py-2 px-2.5 text-right">Amount</th>
                              <th className="py-2 px-2.5">Cheque No</th>
                              <th className="py-2 px-2.5">Bank</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}

                          {activeSheetTab === "hold" && (
                            <tr>
                              <th className="py-2 px-2.5">Hold Date</th>
                              <th className="py-2 px-2.5 text-right">Hold Amount</th>
                              <th className="py-2 px-2.5">Bank Action</th>
                              <th className="py-2 px-2.5">Status</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}

                          {activeSheetTab === "other" && (
                            <tr>
                              <th className="py-2 px-2.5">Date</th>
                              <th className="py-2 px-2.5 text-right">Amount</th>
                              <th className="py-2 px-2.5">Description</th>
                              <th className="py-2 px-2.5">Bank / UTR</th>
                              <th className="py-2 px-2.5">Sheet & Row</th>
                            </tr>
                          )}
                        </>
                      )}
                    </thead>

                    <tbody className="divide-y divide-[#F1F5F9]">
                      {paginatedRecords.map((r, idx) => {
                        const isSender = r.sender_account === profile.account;
                        const counterAcc = isSender ? r.receiver_account : r.sender_account;
                        const counterBank = isSender ? r.receiver_bank : r.sender_bank;

                        if (moneyTransferOnly) {
                          const senderDisp = r.sender_account || "—";
                          const receiverDisp = r.receiver_account || "—";
                          const bankDisp = r.receiver_bank || r.sender_bank || "—";
                          const utrDisp = r.utr || "—";
                          const dateDisp = r.date || "—";
                          const amtDisp = formatIndianCurrency(r.amount);
                          const dispAmt = r.disputed_amount > 0 ? `₹${formatIndianCurrency(r.disputed_amount)}` : "—";
                          const layerDisp = r.layer || (r.layer_num ? `Layer ${r.layer_num}` : "Layer 1");
                          const ifscDisp = r.ifsc_code || r.raw_data?.["IFSC Code"] || r.raw_data?.["ifsc_code"] || r.raw_data?.["IFSC"] || "—";
                          const ackDisp = r.ack_no || r.raw_data?.["Acknowledgement No"] || "—";

                          return (
                            <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                              {/* 1. Sender */}
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <span className={`font-mono text-xs font-bold ${isSender ? "text-blue-700" : "text-[#172554]"}`}>
                                  {maskAccountNumber(senderDisp)}
                                </span>
                                {isSender && (
                                  <span className="ml-1 text-[8px] font-bold px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    Selected
                                  </span>
                                )}
                              </td>
                              {/* 2. Receiver */}
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <span className={`font-mono text-xs font-bold ${!isSender ? "text-emerald-700" : "text-[#172554]"}`}>
                                  {maskAccountNumber(receiverDisp)}
                                </span>
                                {!isSender && (
                                  <span className="ml-1 text-[8px] font-bold px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Selected
                                  </span>
                                )}
                              </td>
                              {/* 3. Bank / FI */}
                              <td className="py-2 px-2.5 text-[11px] text-[#172554] truncate max-w-[130px]" title={bankDisp}>
                                {bankDisp}
                              </td>
                              {/* 4. Transaction ID / UTR */}
                              <td className="py-2 px-2.5 font-mono text-[10px] text-[#64748B] truncate max-w-[120px]" title={utrDisp}>
                                {utrDisp}
                              </td>
                              {/* 5. Date */}
                              <td className="py-2 px-2.5 whitespace-nowrap text-[11px] text-[#64748B]">
                                {dateDisp}
                              </td>
                              {/* 6. Amount */}
                              <td className="py-2 px-2.5 text-right font-bold text-[#172554] whitespace-nowrap">
                                ₹{amtDisp}
                              </td>
                              {/* 7. Disputed Amount */}
                              <td className="py-2 px-2.5 text-right whitespace-nowrap text-[11px]">
                                {r.disputed_amount > 0 ? (
                                  <span className="font-semibold text-amber-700">{dispAmt}</span>
                                ) : (
                                  <span className="text-[#94A3B8]">—</span>
                                )}
                              </td>
                              {/* 8. Layer */}
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  {layerDisp}
                                </span>
                              </td>
                              {/* 9. IFSC Code */}
                              <td className="py-2 px-2.5 font-mono text-[10px] text-[#64748B] whitespace-nowrap">
                                {ifscDisp}
                              </td>
                              {/* 10. Acknowledgement No */}
                              <td className="py-2 px-2.5 font-mono text-[10px] text-[#64748B] whitespace-nowrap" title={ackDisp}>
                                {ackDisp}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                            {/* 1. Money Transfer Tab Row */}
                            {activeSheetTab === "money_transfer" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                    isSender ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                                  }`}>
                                    {isSender ? "OUTFLOW" : "INFLOW"}
                                  </span>
                                  <div className="text-[9px] text-[#64748B] mt-0.5">
                                    {r.layer || "Layer 1"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-mono text-xs font-bold text-[#172554]">
                                    {maskAccountNumber(counterAcc) || "—"}
                                  </div>
                                  <div className="text-[10px] text-[#64748B] truncate max-w-[120px]">
                                    {counterBank || "—"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                  <div className="font-bold text-[#172554]">
                                    ₹{formatIndianCurrency(r.amount)}
                                  </div>
                                  {r.disputed_amount > 0 && (
                                    <div className="text-[9px] font-medium text-amber-700">
                                      Disp: ₹{formatIndianCurrency(r.disputed_amount)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-mono text-[10px] text-[#64748B] truncate max-w-[100px]" title={r.utr}>
                                    {r.utr || "No UTR"}
                                  </div>
                                  <div className="text-[9px] text-[#94A3B8]">
                                    {r.date || "N/A"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 2. POS Tab Row */}
                            {activeSheetTab === "pos" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap text-[#172554]">
                                  {r.date || "N/A"}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-[#172554] whitespace-nowrap">
                                  ₹{formatIndianCurrency(r.amount)}
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-semibold text-[#172554] truncate max-w-[130px]" title={r.merchant_name}>
                                    {r.merchant_name || "Merchant"}
                                  </div>
                                  <div className="text-[9px] text-[#64748B]">
                                    {r.bank || "POS Terminal"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-mono text-[10px] text-[#64748B] truncate max-w-[100px]" title={r.utr}>
                                    {r.utr || "N/A"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 3. ATM Tab Row */}
                            {activeSheetTab === "atm" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap text-[#172554]">
                                  {r.date || "N/A"}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-[#172554] whitespace-nowrap">
                                  ₹{formatIndianCurrency(r.amount)}
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-semibold text-[#172554] truncate max-w-[130px]" title={r.atm_id}>
                                    {r.atm_id || "ATM"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="text-[10px] text-[#64748B] truncate max-w-[100px]">
                                    {r.bank || "ATM Terminal"}
                                  </div>
                                  <div className="font-mono text-[9px] text-[#94A3B8] truncate max-w-[100px]">
                                    {r.utr || "N/A"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 4. Cheque Tab Row */}
                            {activeSheetTab === "cheque" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap text-[#172554]">
                                  {r.date || "N/A"}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-[#172554] whitespace-nowrap">
                                  ₹{formatIndianCurrency(r.amount)}
                                </td>
                                <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-[#172554]">
                                  {r.cheque_no || "Cash / Cheque"}
                                </td>
                                <td className="py-2 px-2.5 text-[10px] text-[#64748B]">
                                  {r.bank || "Counter Bank"}
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 5. Hold Tab Row */}
                            {activeSheetTab === "hold" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap text-[#172554]">
                                  {r.action_date || r.date || "N/A"}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-rose-700 whitespace-nowrap">
                                  ₹{formatIndianCurrency(r.hold_amount || r.amount)}
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-semibold text-[#172554] truncate max-w-[120px]" title={r.action_taken}>
                                    {r.action_taken || "Account Hold"}
                                  </div>
                                  <div className="text-[9px] text-[#64748B] truncate max-w-[120px]" title={r.remarks}>
                                    {r.remarks || r.bank}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    {r.hold_status || "Active Hold"}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 6. Other Tab Row */}
                            {activeSheetTab === "other" && (
                              <>
                                <td className="py-2 px-2.5 whitespace-nowrap text-[#172554]">
                                  {r.date || "N/A"}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-[#172554] whitespace-nowrap">
                                  ₹{formatIndianCurrency(r.amount)}
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-semibold text-[#172554] truncate max-w-[130px]" title={r.remarks}>
                                    {r.remarks || "Worksheet record"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="text-[10px] text-[#64748B]">
                                    {r.bank || "N/A"}
                                  </div>
                                  <div className="font-mono text-[9px] text-[#94A3B8]">
                                    {r.utr || "No UTR"}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B] block w-fit">
                                    #{r.row_number}
                                  </span>
                                  <span className="text-[9px] text-[#94A3B8] truncate max-w-[90px] block" title={r.sheet_name}>
                                    {r.sheet_name}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}

                      {paginatedRecords.length === 0 && (
                        <tr>
                          <td colSpan={moneyTransferOnly ? "10" : "5"} className="py-8 text-center text-xs text-[#64748B]">
                            <div className="flex flex-col items-center justify-center space-y-1">
                              <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>
                                {moneyTransferOnly
                                  ? "No Money Transfer records found for this account."
                                  : "No records found in this worksheet for this account."}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-2 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <span className="text-[10px] text-[#64748B]">
                      Page {sheetPage} of {totalPages} ({filteredRecords.length} records)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sheetPage <= 1}
                        onClick={() => setSheetPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md border border-[#DCE5EF] bg-white text-[#172554] disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={sheetPage >= totalPages}
                        onClick={() => setSheetPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md border border-[#DCE5EF] bg-white text-[#172554] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================
                SECTION D: RELATED ACCOUNTS & COUNTERPARTIES
            ======================================================== */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F1F5F9]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-600" />
                  Section D • Connected Accounts ({connectedAccounts.length})
                </h4>
                <span className="text-[10px] text-[#64748B]">
                  Direct Transfers
                </span>
              </div>

              <div className="space-y-2">
                {connectedAccounts.length > 0 ? (
                  connectedAccounts.map((cp, idx) => (
                    <div
                      key={cp.account || idx}
                      className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:border-purple-300 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[#172554] truncate">
                            {cp.masked_account || maskAccountNumber(cp.account)}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                            cp.direction === "Incoming" || cp.role === "Sender"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : cp.direction === "Outgoing" || cp.role === "Receiver"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}>
                            {cp.direction || cp.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate mt-0.5">
                          {cp.bank || "Bank / FI"} • {cp.tx_count} tx • {cp.layer || "Layer 2"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#172554]">
                          ₹{formatIndianCurrency(cp.amount)}
                        </span>

                        {onExpandInGraph && (
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectAccount) onSelectAccount(cp.account);
                              if (onExpandInGraph) onExpandInGraph(cp.account);
                            }}
                            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors"
                            title="Expand / Select in Graph"
                          >
                            Expand in Graph
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-[#64748B]">
                    No connected counterparties recorded for this account.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
