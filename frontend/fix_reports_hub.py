filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. First, we'll rewrite the reportsList array entirely.
new_reports_list = """  const reportsList = [
    {
      id: "file-statement",
      reportNumber: "01",
      title: "Bank Statement & Transactions Report",
      category: "statement",
      categoryLabel: "Statement Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/file-statement`
        : "/dashboard/reports/file-statement",
      description:
        "Comprehensive file-wise statement audit with fully filtered transactions, live narration & reference search with validation, debit/credit breakdown, balances, and CSV/Print export.",
      features: [
        "File-wise statement switching",
        "Live search with input validation",
        "Instant calendar date range pickers",
        "Debit & Credit type filters",
        "Opening & Closing balance checks",
        "Export CSV & Print Report",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "dynamic-timeline-report",
      reportNumber: "02",
      title: "Transaction Mode Wise Report",
      category: "statement",
      categoryLabel: "Dynamic Visualizations",
      status: "available",
      isReady: true,
      route: "/analysis",
      description:
        "Analyze transaction activity by mode or channel with dynamic case and file filtering, transaction counts, and an interactive vertical bar chart with detailed hover insights.",
      features: [
        "Upload CSV, XLSX, XLS, JSON",
        "Automatic column & type detection",
        "Dynamic X & Multi-Y Axis mapping",
        "Synchronized search, filters, KPIs & table",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "transaction-relationships",
      reportNumber: "03",
      title: "Transaction Flow / Relationship Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/transaction-relationships`
        : "/reports/transaction-relationships",
      description:
        "Visualize monetary flows and transaction relationships between multiple statements as an interactive node-edge graph.",
      features: [
        "Cross-statement relationship mapping",
        "Dynamic amount & mode filtering",
        "Live Edge interactive drill-down",
        "Debit/Credit aggregations",
        "Visual node cluster analysis",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "counterparty-intelligence",
      reportNumber: "04",
      title: "Counterparty Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/counterparty-intelligence`
        : "/reports/counterparty-intelligence",
      description:
        "Analyze counterparty activity across statements. Find common counterparties shared between different bank statements and view aggregated transaction matrices.",
      features: [
        "Single statement counterparty breakdown",
        "Common counterparties across multiple files",
        "Counterparty vs Statement activity matrix",
        "Top counterparties by value and count",
      ],
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      badgeColor: "emerald",
    },
    {
      id: "financial-transaction-intelligence",
      reportNumber: "05",
      title: "Financial Transaction Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? `/dashboard/cases/${activeCaseId}/reports/financial-transaction-intelligence`
        : "/reports/financial-transaction-intelligence",
      description:
        "Analyze financial movement, high-value transactions, distribution, and patterns within selected statements.",
      features: [
        "Data-driven KPI calculations",
        "Most frequent & round-value transaction analysis",
        "Financial concentration & balance trend",
        "File-wise statistical comparison",
      ],
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badgeColor: "emerald",
    }
  ];"""

pattern = re.compile(r'const reportsList = \[.*?\];', re.DOTALL)
text = pattern.sub(new_reports_list, text)

# 2. Update the rendering of the report title to include the number.
title_pattern = r'<h3 className="mt-5 text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">\s*\{report\.title\}\s*<\/h3>'
new_title = """<div className="mt-5 flex flex-col">
  {report.reportNumber && (
    <span className="text-4xl font-extrabold text-white/[0.04] absolute top-4 right-6 group-hover:text-emerald-500/10 transition-colors pointer-events-none select-none">
      {report.reportNumber}
    </span>
  )}
  <div className="flex items-center gap-3">
    {report.reportNumber && (
      <span className="text-emerald-500 font-mono text-sm tracking-widest font-bold">
        {report.reportNumber}
      </span>
    )}
    <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
      {report.title}
    </h3>
  </div>
</div>"""

text = re.sub(title_pattern, new_title, text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
