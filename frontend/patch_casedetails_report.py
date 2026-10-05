import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CaseFileReport.jsx')
content = file_path.read_text(encoding='utf-8')

old_map_start = '''              {files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";

                return ('''

new_map_start = '''              {files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                const isCompleted = String(file.status || "").toUpperCase() === "COMPLETED";
                const displayAccountNumber = file.account_number?.toString().trim() || "Account number not available";

                return ('''

content = content.replace(old_map_start, new_map_start)

old_file_render = '''                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-200" : "text-slate-300 group-hover:text-white"}`}
                        title={file.original_filename}
                      >
                        {file.original_filename}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>&bull;</span>
                        <span'''

new_file_render = '''                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-200" : "text-slate-300 group-hover:text-white"}`}
                        title={displayAccountNumber}
                      >
                        {displayAccountNumber}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="truncate max-w-[90px]" title={file.bank_name || file.original_filename}>
                          {file.bank_name || file.original_filename}
                        </span>
                        <span>&bull;</span>
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>&bull;</span>
                        <span'''

content = content.replace(old_file_render, new_file_render)

old_legend = '''                        return (
                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${col.badge}`}
                            title={f.original_filename}
                          >
                            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                            <span className="truncate max-w-[170px]">{f.original_filename}</span>
                          </span>
                        );'''

new_legend = '''                        return (
                          <span
                            key={fid}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${col.badge}`}
                            title={f.account_number?.toString().trim() || "Account number not available"}
                          >
                            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                            <span className="truncate max-w-[170px]">{f.account_number?.toString().trim() || "Account number not available"}</span>
                          </span>
                        );'''

content = content.replace(old_legend, new_legend)

file_path.write_text(content, encoding='utf-8')
print("Patched frontend report file successfully")
