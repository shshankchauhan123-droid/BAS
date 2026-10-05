import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseFileReport.jsx')
content = file_path.read_text(encoding='utf-8')

# Change title in the file selector card
old_card_p = '''                      <p
                        className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-200" : "text-slate-300 group-hover:text-white"}`}
                        title={displayAccountNumber}
                      >
                        {displayAccountNumber}
                      </p>'''

new_card_p = '''                      <p
                        className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-200" : "text-slate-300 group-hover:text-white"}`}
                        title={`File: ${file.original_filename}`}
                      >
                        {displayAccountNumber}
                      </p>'''

if old_card_p in content:
    content = content.replace(old_card_p, new_card_p)
    print("Patched card title")
else:
    print("Could not find card p to patch")

# Change title in the Statement Legend
old_legend = '''                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${col.badge}`}
                            title={f.account_number?.toString().trim() || "Account number not available"}
                          >'''

new_legend = '''                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${col.badge}`}
                            title={`File: ${f.original_filename}`}
                          >'''

if old_legend in content:
    content = content.replace(old_legend, new_legend)
    print("Patched legend title")
else:
    print("Could not find legend to patch")

file_path.write_text(content, encoding='utf-8')
