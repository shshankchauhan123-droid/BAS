filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\layout\UserNavbar.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

toggle_btn = """
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
"""

if "☀️ Light" not in text:
    # Desktop
    text = text.replace('className="group flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-rose-400 transition-colors hover:bg-rose-500/20"', 'className="group flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-rose-400 transition-colors hover:bg-rose-500/20"\n            onClick={handleLogout}')
    text = text.replace('<div className="flex items-center gap-6">', f'<div className="flex items-center gap-6">\n{toggle_btn}')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
