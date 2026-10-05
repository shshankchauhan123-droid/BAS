import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\TransactionRelationshipReport.jsx')
content = file_path.read_text(encoding='utf-8')

old_button = '''                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        toggleFileSelection(f.id)
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                          : "bg-[#020b09] border-white/[0.1] text-slate-400 hover:border-slate-500"
                      }`}
                    >'''

new_button = '''                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        toggleFileSelection(f.id)
                      }
                      title={f.original_filename || `Statement ${f.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                          : "bg-[#020b09] border-white/[0.1] text-slate-400 hover:border-slate-500"
                      }`}
                    >'''

if old_button in content:
    content = content.replace(old_button, new_button)
    print("Patched button title")
else:
    print("Could not find button declaration")

old_label = '''                      {f.original_filename ||
                        `Statement ${f.id}`}
                    </button>'''

new_label = '''                      {f.account_number?.toString().trim() ||
                        "Account number not available"}
                    </button>'''

if old_label in content:
    content = content.replace(old_label, new_label)
    print("Patched button label")
else:
    print("Could not find button label")

file_path.write_text(content, encoding='utf-8')
