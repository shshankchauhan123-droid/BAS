filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\layout\UserNavbar.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re

if "useTheme" not in text:
    text = text.replace('import { useAuth }', 'import { useTheme } from "../../context/ThemeContext";\nimport { useAuth }')

if "const { theme, toggleTheme } = useTheme();" not in text:
    text = re.sub(r'(const \{\s*userId,\s*user,\s*logout\s*\} = useAuth\(\);)', r'\1\n  const { theme, toggleTheme } = useTheme();', text)

toggle_btn = """
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
"""

if "☀️ Light" not in text:
    text = text.replace('            {/* Logout */}', toggle_btn + '\n            {/* Logout */}')
    text = text.replace('          {/* LOGOUT */}', toggle_btn + '\n          {/* LOGOUT */}')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
