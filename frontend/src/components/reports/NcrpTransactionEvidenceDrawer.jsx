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

export default function NcrpTransactionEvidenceDrawer({
  isOpen,
  onClose,
  evidenceData,
  maskAccountsDefault = true,
}) {
  const [unmask, setUnmask] = useState(false);

  if (!isOpen || !evidenceData) return null;

  const shouldMask = maskAccountsDefault && !unmask;

  // Normalize data whether it came from an edge click or a table row click
  const tx = {
    amount: evidenceData.amount ?? 0,
    date: evidenceData.date || "Not available",
    datetime: evidenceData.datetime || evidenceData.date || "Not available",
    utr: evidenceData.utr && evidenceData.utr !== "Not available" ? evidenceData.utr : null,
    sourceAccount: evidenceData.sender_account || evidenceData.source || "Unknown",
    sourceBank: evidenceData.sender_bank || evidenceData.source_bank || "Unknown Bank",
    targetAccount: evidenceData.beneficiary_account || evidenceData.target || "Unknown",
    targetBank: evidenceData.dest_bank || evidenceData.beneficiary_bank || "Unknown Bank",
    layer: evidenceData.layer || (evidenceData.layer_num ? `Layer ${evidenceData.layer_num}` : "N/A"),
    status: evidenceData.link_status || evidenceData.status || "UNVERIFIED",
    rationale: evidenceData.rationale || (evidenceData.evidence && evidenceData.evidence.join(". ")) || "Evidence reconstructed from canonical transaction records.",
    sourceSheet: evidenceData.source_sheet || "Transaction Record",
    rowNumber: evidenceData.row_number || "N/A",
    remarks: evidenceData.remarks || evidenceData.description || "Direct transfer",
    missingFields: evidenceData.missing_fields || [],
  };

  const isConfirmed = tx.status === "CONFIRMED";
  const isPossible = tx.status === "POSSIBLE";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isConfirmed
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : isPossible
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}
              >
                {tx.status} LINK
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] bg-slate-200/80 px-2 py-0.5 rounded">
                {tx.layer}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#172554] mt-1.5">
              Transaction Evidence Audit
            </h3>
            <p className="text-xs text-[#64748B]">
              Detailed verification trail, UTR confirmation status, and source sheet references
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Amount Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-[#1E293B] text-white rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold block">
              Transfer Amount
            </span>
            <div className="text-2xl font-black mt-1 tracking-tight">
              ₹{formatIndianCurrency(tx.amount)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-300">
              <span>Date & Time:</span>
              <span className="font-mono font-bold text-white">{tx.datetime}</span>
            </div>
          </div>

          {/* Account Transfer Routing */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="font-bold text-[#172554] uppercase text-[11px] tracking-wider">
                Routing Pathway
              </span>
              <button
                type="button"
                onClick={() => setUnmask((v) => !v)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded bg-blue-50 border border-blue-200"
              >
                {unmask ? "Mask Numbers" : "Reveal Numbers"}
              </button>
            </div>

            {/* Sender / Remitting */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-rose-700 uppercase block tracking-wider">
                Remitting Account (Debited)
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#0F172A]">
                  {shouldMask ? maskAccountNumber(tx.sourceAccount) : tx.sourceAccount}
                </span>
                <span className="text-xs font-semibold text-[#475569]">{tx.sourceBank}</span>
              </div>
            </div>

            {/* Visual Arrow */}
            <div className="flex items-center justify-center py-1">
              <div className="h-6 w-[1px] bg-slate-300 relative">
                <div className="absolute -bottom-1 -left-1 text-[8px] text-slate-400">▼</div>
              </div>
            </div>

            {/* Beneficiary / Credited */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block tracking-wider">
                Beneficiary Account (Credited)
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#0F172A]">
                  {shouldMask ? maskAccountNumber(tx.targetAccount) : tx.targetAccount}
                </span>
                <span className="text-xs font-semibold text-[#475569]">{tx.targetBank}</span>
              </div>
            </div>
          </div>

          {/* UTR & Evidence Hierarchy */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Verification & UTR Evidence
            </h4>
            <div className="p-3.5 bg-white border border-[#CBD5E1] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">UTR / Ref Number:</span>
                {tx.utr ? (
                  <span className="font-mono font-black text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {tx.utr}
                  </span>
                ) : (
                  <span className="font-mono font-bold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Unrecorded in Workbook
                  </span>
                )}
              </div>

              <div className="text-xs">
                <span className="text-[#64748B] block text-[11px] font-semibold mb-0.5">Link Rationale:</span>
                <p className="text-[#334155] leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-sans">
                  {tx.rationale}
                </p>
              </div>

              {/* Missing Fields Audit if any */}
              {Array.isArray(tx.missingFields) && tx.missingFields.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">
                    Missing Evidence In Workbook:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
                    {tx.missingFields.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Source Workbook Provenance */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
              Source Workbook Provenance
            </h4>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-[#475569]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Worksheet Tab:</span>
                <span className="font-semibold text-[#1E293B]">{tx.sourceSheet}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Row Number:</span>
                <span className="font-mono font-bold text-[#1E293B]">{tx.rowNumber}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200">
                <span className="text-[10px] text-[#64748B] uppercase font-bold block mb-0.5">Narration / Remarks:</span>
                <p className="text-[11px] text-[#334155] italic bg-white p-2 rounded border border-slate-200">
                  "{tx.remarks}"
                </p>
              </div>
            </div>
          </div>

          {/* Statutory Lead Recommendation */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase">
              <svg className="w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Statutory Action Recommendation
            </div>
            <p className="text-xs text-blue-800 mt-1.5 leading-relaxed">
              {tx.utr
                ? `Serve notice u/s 91 CrPC / Section 94 BNSS on ${tx.targetBank} referencing UTR ${tx.utr} to obtain core banking ledger statement and beneficiary KYC packet.`
                : `Summon ${tx.sourceBank} to furnish the inter-bank clearing UTR and credit acknowledgment confirmation for the ₹${formatIndianCurrency(tx.amount)} remittance to account ${maskAccountNumber(tx.targetAccount)}.`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-[#1E293B] rounded-xl text-xs font-bold transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
