import React from "react";
import NcrpAccountPanel from "./NcrpAccountPanel";

export default function NcrpAccountDrawer({
  isOpen,
  onClose,
  account,
  fileId,
  caseId,
  rootAccount,
  onExpandInGraph,
  onSelectAccount,
  moneyTransferOnly = true,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-[#E2E8F0] animate-in slide-in-from-right duration-300">
          <NcrpAccountPanel
            account={account}
            fileId={fileId}
            caseId={caseId}
            rootAccount={rootAccount}
            onExpandInGraph={onExpandInGraph}
            onSelectAccount={onSelectAccount}
            onClose={onClose}
            isCollapsible={true}
            moneyTransferOnly={moneyTransferOnly}
          />
        </div>
      </div>
    </div>
  );
}
