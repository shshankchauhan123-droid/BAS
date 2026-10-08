filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseReportsHub.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

new_report = '''
    {
      id: "counterparty-intelligence",
      title: "Counterparty Intelligence Report",
      category: "analysis",
      categoryLabel: "Advanced Analysis",
      status: "available",
      isReady: true,
      route: activeCaseId
        ? /dashboard/cases//reports/counterparty-intelligence
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
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      badgeColor: "emerald",
    },
  ];
'''

text = text.replace('  ];', new_report, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated CaseReportsHub.jsx")
