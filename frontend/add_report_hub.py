filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

new_report = '''    {
      id: "financial-transaction-intelligence",
      title: "Financial Transaction Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? /dashboard/cases//reports/financial-transaction-intelligence
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
    },
'''

text = text.replace('const reportsList = [', 'const reportsList = [\n' + new_report)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
