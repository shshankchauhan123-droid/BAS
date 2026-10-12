import os
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\layout\UserNavbar.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

toggle_btn_desktop = """
          {/* =================================================
              THEME TOGGLE (DESKTOP)
          ================================================== */}
          <button
            type="button"
            onClick={toggleTheme}
            className="
              flex items-center gap-2
              rounded-2xl
              border
              border-slate-200 dark:border-white/[0.08]
              px-6
              py-3
              text-sm
              font-semibold
              text-slate-600 dark:text-slate-400
              transition
              hover:border-slate-300 dark:hover:border-emerald-400/20
              hover:bg-slate-50 dark:hover:bg-emerald-400/[0.04]
              hover:text-slate-900 dark:hover:text-emerald-300
            "
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
"""

# The desktop logout comment block is:
# {/* =================================================
#     LOGOUT
# ================================================== */}

target_comment = """          {/* =================================================
              LOGOUT
          ================================================== */}"""

if "THEME TOGGLE (DESKTOP)" not in text:
    text = text.replace(target_comment, toggle_btn_desktop + "\n" + target_comment)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
