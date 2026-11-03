import React, { useState } from "react";

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

export default function NcrpAccountProfileDrawer({
  isOpen,
  onClose,
  accountNode,
  allTransactions = [],
  allGaps = [],
  allActions = [],
  maskAccountsDefault = true,
}) {
  const [unmask, setUnmask] = useState(false);
  const [activeTab, setActiveTab] = useState("OVERVIEW");

  if (!isOpen || !accountNode) return null;

  const shouldMask = maskAccountsDefault && !unmask;
  const accNum = accountNode.account || "";
  const displayAcc = shouldMask ? maskAccountNumber(accNum) : accNum;

  // Filter linked incoming and outgoing transactions for this account
  const incomingTxs = allTransactions.filter(
    (tx) => tx.beneficiary_account === accNum
  );
  const outgoingTxs = allTransactions.filter(
    (tx) => tx.sender_account === accNum
  );

  // Filter gaps and actions for this account
  const accountGaps = allGaps.filter(
    (g) => g.related_account === accNum
  );
  const accountActions = allActions.filter(
    (a) => a.target_account === accNum
  );

  // Connected accounts
  const upstreamSenders = Array.from(
    new Set(incomingTxs.map((t) => t.sender_account).filter(Boolean))
  );
  const downstreamBeneficiaries = Array.from(
    new Set(outgoingTxs.map((t) => t.beneficiary_account).filter(Boolean))
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  accountNode.role === "STARTING_SUSPECT"
                    ? "bg-emerald-100 text-emerald-800"
                    : accountNode.is_terminal
                    ? "bg-rose-100 text-rose-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                Layer {accountNode.layer} • {accountNode.role}
              </span>
              {accountNode.is_terminal && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {accountNode.terminal_status || "TERMINAL"}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-[#172554] mt-1 font-mono tracking-tight flex items-center gap-2">
              {displayAcc}
              <button
                type="button"
                onClick={() => setUnmask((v) => !v)}
                title={unmask ? "Mask account number" : "Reveal full account number"}
                className="text-xs text-blue-600 hover:text-blue-800 font-sans font-medium px-2 py-0.5 rounded bg-blue-50"
              >
                {unmask ? "Mask" : "Reveal"}
              </button>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {accountNode.bank || "Unknown Bank"}
              {accountNode.holder_name && accountNode.holder_name !== "Not provided" && ` • ${accountNode.holder_name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-[#64748B] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#E2E8F0] px-6 bg-white gap-4 text-xs font-bold text-[#64748B]">
          <button
            type="button"
            onClick={() => setActiveTab("OVERVIEW")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "OVERVIEW"
                ? "border-blue-600 text-blue-600"
                : "border-transparent hover:text-[#1E293B]"
            }`}
          >
            Financial Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TRANSACTIONS")}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "TRANSACTIONS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent hover:text-[#1E293B]"
            }`}
          >
            Linked Transfers
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {incomingTxs.length + outgoingTxs.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("GAPS")}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "GAPS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent hover:text-[#1E293B]"
            }`}
          >
            Gaps & Actions
            {accountGaps.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                {accountGaps.length}
              </span>
            )}
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "OVERVIEW" && (
            <>
              {/* Financial KPI Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Inflow</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5 block">
                    ₹{formatIndianCurrency(accountNode.total_incoming)}
                  </span>
                  <span className="text-[10px] text-emerald-600 mt-1 block">{accountNode.incoming_count || 0} incoming transfers</span>
                </div>
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Total Outflow</span>
                  <span className="text-base font-black text-rose-700 mt-0.5 block">
                    ₹{formatIndianCurrency(accountNode.total_outgoing)}
                  </span>
                  <span className="text-[10px] text-rose-600 mt-1 block">{accountNode.outgoing_count || 0} outgoing transfers</span>
                </div>
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Bank Lien / Hold</span>
                  <span className="text-base font-black text-blue-700 mt-0.5 block">
                    ₹{formatIndianCurrency(accountNode.held_amount)}
                  </span>
                  <span className="text-[10px] text-blue-600 mt-1 block">Secured by statutory freeze</span>
                </div>
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Unresolved Trail</span>
                  <span className="text-base font-black text-amber-700 mt-0.5 block">
                    ₹{formatIndianCurrency(accountNode.unresolved_amount)}
                  </span>
                  <span className="text-[10px] text-amber-600 mt-1 block">Pending onward audit</span>
                </div>
              </div>

              {/* Terminal Reason Callout */}
              {accountNode.is_terminal && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    Terminal Account Reason
                  </h4>
                  <p className="text-xs text-rose-800 mt-1.5 leading-relaxed">
                    {accountNode.reason_trace_ends || "No further outgoing records available in workbook."}
                  </p>
                  {accountNode.suggested_next_step && (
                    <div className="mt-2.5 pt-2 border-t border-rose-200 text-xs font-semibold text-rose-900">
                      Recommendation: {accountNode.suggested_next_step}
                    </div>
                  )}
                </div>
              )}

              {/* Connected Accounts Map */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">Connected Accounts in Trail</h4>
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="text-[#64748B] font-semibold block text-[11px] mb-1">Direct Upstream Senders ({upstreamSenders.length})</span>
                    {upstreamSenders.length === 0 ? (
                      <span className="text-xs text-[#94A3B8] italic">No upstream sender (Initial Layer 1 Source)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {upstreamSenders.map((sAcc) => (
                          <span key={sAcc} className="px-2 py-1 bg-slate-100 rounded-md font-mono text-[11px] text-[#334155] border border-slate-200">
                            {shouldMask ? maskAccountNumber(sAcc) : sAcc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs mt-3">
                    <span className="text-[#64748B] font-semibold block text-[11px] mb-1">Direct Downstream Beneficiaries ({downstreamBeneficiaries.length})</span>
                    {downstreamBeneficiaries.length === 0 ? (
                      <span className="text-xs text-[#94A3B8] italic">No downstream beneficiaries (Terminal Account)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {downstreamBeneficiaries.map((dAcc) => (
                          <span key={dAcc} className="px-2 py-1 bg-slate-100 rounded-md font-mono text-[11px] text-[#334155] border border-slate-200">
                            {shouldMask ? maskAccountNumber(dAcc) : dAcc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "TRANSACTIONS" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">Incoming Credits ({incomingTxs.length})</h4>
              {incomingTxs.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic">No incoming transfers recorded.</p>
              ) : (
                <div className="space-y-2">
                  {incomingTxs.map((t) => (
                    <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-700">₹{formatIndianCurrency(t.amount)}</span>
                        <span className="text-[10px] text-[#64748B] font-mono">{t.date}</span>
                      </div>
                      <div className="text-[11px] text-[#334155]">
                        <span className="text-[#64748B]">From: </span>
                        <span className="font-mono font-medium">{shouldMask ? t.sender_masked : t.sender_account}</span> ({t.sender_bank})
                      </div>
                      <div className="text-[10px] text-[#64748B] font-mono flex items-center justify-between">
                        <span>UTR: {t.utr || "Not available"}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${t.link_status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {t.link_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider pt-3">Outgoing Debits ({outgoingTxs.length})</h4>
              {outgoingTxs.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic">No outgoing transfers recorded.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingTxs.map((t) => (
                    <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-700">₹{formatIndianCurrency(t.amount)}</span>
                        <span className="text-[10px] text-[#64748B] font-mono">{t.date}</span>
                      </div>
                      <div className="text-[11px] text-[#334155]">
                        <span className="text-[#64748B]">To: </span>
                        <span className="font-mono font-medium">{shouldMask ? t.beneficiary_masked : t.beneficiary_account}</span> ({t.dest_bank})
                      </div>
                      <div className="text-[10px] text-[#64748B] font-mono flex items-center justify-between">
                        <span>UTR: {t.utr || "Not available"}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${t.link_status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {t.link_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "GAPS" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">Identified Investigation Gaps</h4>
              {accountGaps.length === 0 ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  No missing evidence or broken links flagged for this account.
                </p>
              ) : (
                <div className="space-y-2">
                  {accountGaps.map((g) => (
                    <div key={g.gap_id} className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span>{g.issue_type}</span>
                        <span className="text-[10px] text-amber-700">{g.gap_id}</span>
                      </div>
                      <p className="text-[11px] text-[#475569]">{g.why_trail_cannot_be_confirmed}</p>
                      <div className="pt-1.5 border-t border-amber-200 text-xs font-semibold text-amber-900">
                        Suggested Action: {g.suggested_action}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {accountActions.length > 0 && (
                <>
                  <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider pt-3">Suggested Legal Requisitions</h4>
                  <div className="space-y-2">
                    {accountActions.map((act) => (
                      <div key={act.action_id} className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-blue-900">
                          <span>{act.action_title}</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">{act.legal_basis}</span>
                        </div>
                        <p className="text-[11px] text-[#334155]">{act.action_detail}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
