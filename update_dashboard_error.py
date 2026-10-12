filepath = r"frontend\src\pages\user\UserDashboard.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re

# Add statsError state
if "const [statsError, setStatsError] = useState(false);" not in text:
    text = text.replace('const [stats, setStats] = useState(null);', 'const [stats, setStats] = useState(null);\n  const [statsError, setStatsError] = useState(false);')

# Handle statsRes rejected
stats_handling_regex = re.compile(r'if \(statsRes\.status === "fulfilled" && statsRes\.value\) \{\s*setStats\(statsRes\.value\);\s*\}', re.DOTALL)
new_stats_handling = """if (statsRes.status === "fulfilled" && statsRes.value) {
            setStats(statsRes.value);
            setStatsError(false);
          } else {
            setStatsError(true);
          }"""
text = re.sub(stats_handling_regex, new_stats_handling, text)

# Replace "..." with error or loading state
text = text.replace('value={loading || !stats ? "..." : String(stats.analysis_cases).padStart(2, "0")}', 'value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.analysis_cases).padStart(2, "0")}')
text = text.replace('value={loading || !stats ? "..." : String(stats.investigating_officers).padStart(2, "0")}', 'value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.investigating_officers).padStart(2, "0")}')
text = text.replace('value={loading || !stats ? "..." : String(stats.bank_statements).padStart(2, "0")}', 'value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.bank_statements).padStart(2, "0")}')
text = text.replace('value={loading || !stats ? "..." : String(stats.transactions).padStart(2, "0")}', 'value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.transactions).padStart(2, "0")}')
text = text.replace('value={loading || !stats ? "..." : String(stats.analytical_reports).padStart(2, "0")}', 'value={loading ? "..." : statsError || !stats ? "ERR" : String(stats.analytical_reports).padStart(2, "0")}')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
