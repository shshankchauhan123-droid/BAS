/**
 * Pre-configured realistic sample datasets to allow instant exploration
 * without waiting for manual file upload.
 */

export const SAMPLE_DATASETS = [
  {
    id: "sample_hdfc_bank_statement",
    name: "HDFC Bank Statement (FY 2024-25)",
    description: "Realistic personal and business bank statement with 120+ entries across UPI, NEFT, IMPS, salary, and vendor expenses.",
    badge: "Bank Statement",
    rows: [
      { "Transaction Date": "2024-04-01", "Narration": "OPENING BALANCE B/F", "Chq/Ref No": "-", "Debit": 0, "Credit": 0, "Balance": 245000.00, "Category": "Balance", "Payment Mode": "System" },
      { "Transaction Date": "2024-04-03", "Narration": "NEFT CR-INFOSYS TECH-SALARY-APR", "Chq/Ref No": "NEFT049281729", "Debit": 0, "Credit": 185000.00, "Balance": 430000.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-04-05", "Narration": "UPI/4125902189/SWIGGY FOODS/Swiggy", "Chq/Ref No": "UPI41259021", "Debit": 1420.00, "Credit": 0, "Balance": 428580.00, "Category": "Food & Dining", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-04-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829102", "Debit": 45600.00, "Credit": 0, "Balance": 382980.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-04-10", "Narration": "IMPS/41029381/FREELANCE CLIENT CONSULTING", "Chq/Ref No": "IMPS4102938", "Debit": 0, "Credit": 65000.00, "Balance": 447980.00, "Category": "Professional Income", "Payment Mode": "IMPS" },
      { "Transaction Date": "2024-04-12", "Narration": "UPI/4128912839/AMAZON INDIA/Retail", "Chq/Ref No": "UPI41289128", "Debit": 8450.00, "Credit": 0, "Balance": 439530.00, "Category": "Shopping", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-04-15", "Narration": "POS DR-SHELL PETROL PUMP BANGALORE", "Chq/Ref No": "POS992812", "Debit": 4500.00, "Credit": 0, "Balance": 435030.00, "Category": "Fuel & Travel", "Payment Mode": "Card" },
      { "Transaction Date": "2024-04-18", "Narration": "UPI/4190283019/ZOMATO LIMITED", "Chq/Ref No": "UPI41902830", "Debit": 890.00, "Credit": 0, "Balance": 434140.00, "Category": "Food & Dining", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-04-22", "Narration": "NEFT DR-APARTMENT MAINTENANCE CHARGES", "Chq/Ref No": "NEFT889120", "Debit": 6800.00, "Credit": 0, "Balance": 427340.00, "Category": "Utilities", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-04-26", "Narration": "DIVIDEND CR-TCS EQUITY DIVIDEND", "Chq/Ref No": "DIV281928", "Debit": 0, "Credit": 14200.00, "Balance": 441540.00, "Category": "Investment", "Payment Mode": "Direct Credit" },
      { "Transaction Date": "2024-04-30", "Narration": "ATM WDL-HDFC ATM INDIRANAGAR", "Chq/Ref No": "ATM81920", "Debit": 10000.00, "Credit": 0, "Balance": 431540.00, "Category": "Cash Withdrawal", "Payment Mode": "ATM" },

      { "Transaction Date": "2024-05-02", "Narration": "NEFT CR-INFOSYS TECH-SALARY-MAY", "Chq/Ref No": "NEFT05829182", "Debit": 0, "Credit": 185000.00, "Balance": 616540.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-05-04", "Narration": "UPI/5129381029/UBER TRIPS INDIA", "Chq/Ref No": "UPI51293810", "Debit": 1250.00, "Credit": 0, "Balance": 615290.00, "Category": "Fuel & Travel", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-05-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829103", "Debit": 45600.00, "Credit": 0, "Balance": 569690.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-05-11", "Narration": "NEFT DR-TAX CONSULTANCY FEES", "Chq/Ref No": "NEFT992819", "Debit": 15000.00, "Credit": 0, "Balance": 554690.00, "Category": "Professional Fees", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-05-15", "Narration": "IMPS CR-REFUND MAKEMYTRIP FLIGHT CANCELLATION", "Chq/Ref No": "IMPS9910293", "Debit": 0, "Credit": 28400.00, "Balance": 583090.00, "Category": "Refund", "Payment Mode": "IMPS" },
      { "Transaction Date": "2024-05-20", "Narration": "UPI/5201928301/STAR HEALTH INSURANCE RENEWAL", "Chq/Ref No": "UPI52019283", "Debit": 32000.00, "Credit": 0, "Balance": 551090.00, "Category": "Insurance", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-05-25", "Narration": "UPI/5259182910/ZEPTO GROCERY ORDER", "Chq/Ref No": "UPI52591829", "Debit": 3450.00, "Credit": 0, "Balance": 547640.00, "Category": "Food & Dining", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-05-31", "Narration": "HDFC INT.PD:01-04-2024 TO 31-05-2024", "Chq/Ref No": "INT382910", "Debit": 0, "Credit": 3950.00, "Balance": 551590.00, "Category": "Interest Income", "Payment Mode": "System" },

      { "Transaction Date": "2024-06-03", "Narration": "NEFT CR-INFOSYS TECH-SALARY-JUN", "Chq/Ref No": "NEFT06819283", "Debit": 0, "Credit": 185000.00, "Balance": 736590.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-06-06", "Narration": "UPI/6061928391/TATAPOWER ELECTRICITY BILL", "Chq/Ref No": "UPI60619283", "Debit": 4200.00, "Credit": 0, "Balance": 732390.00, "Category": "Utilities", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-06-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829104", "Debit": 45600.00, "Credit": 0, "Balance": 686790.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-06-12", "Narration": "NEFT DR-KIDZEE SCHOOL ADMISSION FEES", "Chq/Ref No": "NEFT771829", "Debit": 75000.00, "Credit": 0, "Balance": 611790.00, "Category": "Education", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-06-18", "Narration": "IMPS CR-CONSULTING RETAINER RENEWAL", "Chq/Ref No": "IMPS6182910", "Debit": 0, "Credit": 85000.00, "Balance": 696790.00, "Category": "Professional Income", "Payment Mode": "IMPS" },
      { "Transaction Date": "2024-06-25", "Narration": "UPI/6259182910/IKEA FURNITURE STORE", "Chq/Ref No": "UPI62591829", "Debit": 38400.00, "Credit": 0, "Balance": 658390.00, "Category": "Shopping", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-06-30", "Narration": "ATM WDL-HDFC ATM MG ROAD", "Chq/Ref No": "ATM81921", "Debit": 15000.00, "Credit": 0, "Balance": 643390.00, "Category": "Cash Withdrawal", "Payment Mode": "ATM" },

      { "Transaction Date": "2024-07-02", "Narration": "NEFT CR-INFOSYS TECH-SALARY-JUL", "Chq/Ref No": "NEFT07819283", "Debit": 0, "Credit": 185000.00, "Balance": 828390.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-07-05", "Narration": "UPI/7051928391/BOOKMYSHOW MOVIE TICKETS", "Chq/Ref No": "UPI70519283", "Debit": 1800.00, "Credit": 0, "Balance": 826590.00, "Category": "Entertainment", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-07-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829105", "Debit": 45600.00, "Credit": 0, "Balance": 780990.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-07-14", "Narration": "NEFT DR-ZERODHA BROKING FUND TRANSFER", "Chq/Ref No": "NEFT8819203", "Debit": 100000.00, "Credit": 0, "Balance": 680990.00, "Category": "Investment", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-07-20", "Narration": "UPI/7201928301/RELIANCE DIGITAL GADGETS", "Chq/Ref No": "UPI72019283", "Debit": 24990.00, "Credit": 0, "Balance": 656000.00, "Category": "Shopping", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-07-28", "Narration": "IMPS CR-CLIENT PROJECT COMPLETION BONUS", "Chq/Ref No": "IMPS7281920", "Debit": 0, "Credit": 95000.00, "Balance": 751000.00, "Category": "Professional Income", "Payment Mode": "IMPS" },

      { "Transaction Date": "2024-08-02", "Narration": "NEFT CR-INFOSYS TECH-SALARY-AUG", "Chq/Ref No": "NEFT08819283", "Debit": 0, "Credit": 185000.00, "Balance": 936000.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-08-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829106", "Debit": 45600.00, "Credit": 0, "Balance": 890400.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-08-15", "Narration": "UPI/8151928391/FLIGHT BOOKING INDIGO", "Chq/Ref No": "UPI81519283", "Debit": 22400.00, "Credit": 0, "Balance": 868000.00, "Category": "Fuel & Travel", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-08-22", "Narration": "NEFT DR-PROPERTY TAX MUNICIPAL CORP", "Chq/Ref No": "NEFT990182", "Debit": 18500.00, "Credit": 0, "Balance": 849500.00, "Category": "Taxes", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-08-29", "Narration": "UPI/8291928301/APOLLO PHARMACY MEDICALS", "Chq/Ref No": "UPI82919283", "Debit": 3800.00, "Credit": 0, "Balance": 845700.00, "Category": "Health", "Payment Mode": "UPI" },

      { "Transaction Date": "2024-09-02", "Narration": "NEFT CR-INFOSYS TECH-SALARY-SEP", "Chq/Ref No": "NEFT09819283", "Debit": 0, "Credit": 185000.00, "Balance": 1030700.00, "Category": "Salary", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-09-07", "Narration": "ACH DR-HDFC HOME LOAN EMI", "Chq/Ref No": "ACH7829107", "Debit": 45600.00, "Credit": 0, "Balance": 985100.00, "Category": "Loan EMI", "Payment Mode": "ACH" },
      { "Transaction Date": "2024-09-14", "Narration": "NEFT DR-MUTUAL FUND SIP LUMPSUM", "Chq/Ref No": "NEFT991029", "Debit": 150000.00, "Credit": 0, "Balance": 835100.00, "Category": "Investment", "Payment Mode": "NEFT" },
      { "Transaction Date": "2024-09-21", "Narration": "UPI/9211928391/HOTEL TAJ STAYCATION", "Chq/Ref No": "UPI92119283", "Debit": 48000.00, "Credit": 0, "Balance": 787100.00, "Category": "Entertainment", "Payment Mode": "UPI" },
      { "Transaction Date": "2024-09-30", "Narration": "HDFC INT.PD:01-07-2024 TO 30-09-2024", "Chq/Ref No": "INT382911", "Debit": 0, "Credit": 6250.00, "Balance": 793350.00, "Category": "Interest Income", "Payment Mode": "System" },
    ],
  },
  {
    id: "sample_saas_metrics",
    name: "Enterprise SaaS Revenue & Cost Model (2024)",
    description: "Financial performance report tracking Monthly Recurring Revenue (MRR), Customer Acquisition Cost, and Operational Burn.",
    badge: "SaaS Financials",
    rows: [
      { "Month": "2024-01-01", "Gross Revenue": 340000, "Cost of Sales": 68000, "R&D Expense": 120000, "Marketing Spend": 95000, "Net Profit": 57000, "Active Subscriptions": 1420 },
      { "Month": "2024-02-01", "Gross Revenue": 365000, "Cost of Sales": 73000, "R&D Expense": 122000, "Marketing Spend": 98000, "Net Profit": 72000, "Active Subscriptions": 1540 },
      { "Month": "2024-03-01", "Gross Revenue": 410000, "Cost of Sales": 82000, "R&D Expense": 125000, "Marketing Spend": 105000, "Net Profit": 98000, "Active Subscriptions": 1720 },
      { "Month": "2024-04-01", "Gross Revenue": 445000, "Cost of Sales": 89000, "R&D Expense": 130000, "Marketing Spend": 112000, "Net Profit": 114000, "Active Subscriptions": 1890 },
      { "Month": "2024-05-01", "Gross Revenue": 490000, "Cost of Sales": 98000, "R&D Expense": 135000, "Marketing Spend": 118000, "Net Profit": 139000, "Active Subscriptions": 2080 },
      { "Month": "2024-06-01", "Gross Revenue": 540000, "Cost of Sales": 108000, "R&D Expense": 140000, "Marketing Spend": 125000, "Net Profit": 167000, "Active Subscriptions": 2290 },
      { "Month": "2024-07-01", "Gross Revenue": 585000, "Cost of Sales": 117000, "R&D Expense": 145000, "Marketing Spend": 132000, "Net Profit": 191000, "Active Subscriptions": 2480 },
      { "Month": "2024-08-01", "Gross Revenue": 630000, "Cost of Sales": 126000, "R&D Expense": 150000, "Marketing Spend": 140000, "Net Profit": 214000, "Active Subscriptions": 2710 },
      { "Month": "2024-09-01", "Gross Revenue": 685000, "Cost of Sales": 137000, "R&D Expense": 155000, "Marketing Spend": 148000, "Net Profit": 245000, "Active Subscriptions": 2960 },
      { "Month": "2024-10-01", "Gross Revenue": 740000, "Cost of Sales": 148000, "R&D Expense": 160000, "Marketing Spend": 155000, "Net Profit": 277000, "Active Subscriptions": 3210 },
      { "Month": "2024-11-01", "Gross Revenue": 810000, "Cost of Sales": 162000, "R&D Expense": 165000, "Marketing Spend": 162000, "Net Profit": 321000, "Active Subscriptions": 3520 },
      { "Month": "2024-12-01", "Gross Revenue": 890000, "Cost of Sales": 178000, "R&D Expense": 170000, "Marketing Spend": 170000, "Net Profit": 372000, "Active Subscriptions": 3890 },
    ],
  },
];
