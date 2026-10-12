import re

filepath = r"frontend\src\pages\user\UserDashboard.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Analysis Cases
text = re.sub(
    r'<AnalysisStat\s+title="Analysis Cases"\s+value=\{[^}]+\}\s+description="Total banking cases"',
    r'<AnalysisStat\n                  title="Analysis Cases"\n                  value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.analysis_cases).padStart(2, "0")}\n                  description="Total banking cases"',
    text,
    flags=re.DOTALL
)

# Investigating Officers
text = re.sub(
    r'<AnalysisStat\s+title="Investigating Officers"\s+value=\{[^}]+\}\s+description="Master IO records"',
    r'<AnalysisStat\n                  title="Investigating Officers"\n                  value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.investigating_officers).padStart(2, "0")}\n                  description="Master IO records"',
    text,
    flags=re.DOTALL
)

# Bank Statements
text = re.sub(
    r'<AnalysisStat\s+title="Bank Statements"\s+value="[^"]+"\s+description="Statements processed"',
    r'<AnalysisStat\n                  title="Bank Statements"\n                  value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.bank_statements).padStart(2, "0")}\n                  description="Statements processed"',
    text,
    flags=re.DOTALL
)

# Transactions
text = re.sub(
    r'<AnalysisStat\s+title="Transactions"\s+value="[^"]+"\s+description="Transactions analyzed"',
    r'<AnalysisStat\n                  title="Transactions"\n                  value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.transactions).padStart(2, "0")}\n                  description="Transactions analyzed"',
    text,
    flags=re.DOTALL
)

# Analytical Reports
text = re.sub(
    r'<AnalysisStat\s+title="Analytical Reports"\s+value="[^"]+"\s+description="Reports generated"',
    r'<AnalysisStat\n                  title="Analytical Reports"\n                  value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.analytical_reports).padStart(2, "0")}\n                  description="Reports generated"',
    text,
    flags=re.DOTALL
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
