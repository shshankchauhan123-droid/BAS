import re
import os

filepath = r"frontend\src\pages\user\UserDashboard.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Add import
if "getDashboardStatistics" not in text:
    text = text.replace('import { getCases ,createCase} from "../../services/api/case";', 'import { getCases ,createCase} from "../../services/api/case";\nimport { getDashboardStatistics } from "../../services/api/dashboard";')

# Add state
if "const [stats, setStats] = useState(null);" not in text:
    text = text.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n  const [stats, setStats] = useState(null);')

# Update loadDashboardData
load_dashboard_regex = re.compile(r'const \[casesRes, ioRes\] = await Promise\.allSettled\(\[\s*getCases\(\),\s*getIOMasters\(\),\s*\]\);', re.DOTALL)
new_load_dashboard = """const [casesRes, ioRes, statsRes] = await Promise.allSettled([
          getCases(),
          getIOMasters(),
          getDashboardStatistics(),
        ]);"""
text = re.sub(load_dashboard_regex, new_load_dashboard, text)

# Update state setting
if "setStats(statsRes.value);" not in text:
    state_set_regex = re.compile(r'if \(ioRes\.status === "fulfilled" && Array\.isArray\(ioRes\.value\?\.data\)\) \{\s*setIoList\(ioRes\.value\.data\);\s*\}', re.DOTALL)
    new_state_set = """if (ioRes.status === "fulfilled" && Array.isArray(ioRes.value?.data)) {
            setIoList(ioRes.value.data);
          }
          if (statsRes.status === "fulfilled" && statsRes.value) {
            setStats(statsRes.value);
          }"""
    text = re.sub(state_set_regex, new_state_set, text)

# Replace static values
text = text.replace('value={loading ? "..." : String(cases.length).padStart(2, "0")}\n                  description="Total banking cases"', 'value={loading || !stats ? "..." : String(stats.analysis_cases).padStart(2, "0")}\n                  description="Total banking cases"')
text = text.replace('value={loading ? "..." : String(ioList.length).padStart(2, "0")}\n                  description="Master IO records"', 'value={loading || !stats ? "..." : String(stats.investigating_officers).padStart(2, "0")}\n                  description="Master IO records"')
text = text.replace('value="00"\n                  description="Statements processed"', 'value={loading || !stats ? "..." : String(stats.bank_statements).padStart(2, "0")}\n                  description="Statements processed"')
text = text.replace('value="00"\n                  description="Transactions analyzed"', 'value={loading || !stats ? "..." : String(stats.transactions).padStart(2, "0")}\n                  description="Transactions analyzed"')
text = text.replace('value="00"\n                  description="Reports generated"', 'value={loading || !stats ? "..." : String(stats.analytical_reports).padStart(2, "0")}\n                  description="Reports generated"')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
