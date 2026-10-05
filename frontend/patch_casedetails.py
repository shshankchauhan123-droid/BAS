import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

# 1. Add expandedFileId state
state_pattern = r'(const \[uploadedFiles, setUploadedFiles\] =\s*useState\(\[\]\);)'
state_replacement = r'\1\n  const [expandedFileId, setExpandedFileId] = useState(null);\n'
content = re.sub(state_pattern, state_replacement, content)

# 2. Add handleFileClick function before return statement
# I will find 'return (' that opens the main component render
return_pattern = r'(return \()'
handle_click = '''  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
    } else {
      setExpandedFileId(fileId);
    }
  };

  \\1'''
content = re.sub(return_pattern, handle_click, content, count=1)

# 3. Replace filename <p> tag
p_tag_pattern = re.compile(
    r'<p\s*className="truncate text-sm font-semibold text-slate-200"\s*title=\{\s*file\.original_filename\s*\}\s*>\s*\{\s*file\.original_filename\s*\}\s*</p>',
    re.MULTILINE | re.DOTALL
)

p_tag_replacement = '''<p
                                      className="truncate text-sm font-semibold text-slate-200 cursor-pointer hover:text-emerald-300 transition-colors flex items-center gap-2 select-none"
                                      title={file.original_filename}
                                      onClick={() => handleFileClick(file.id)}
                                    >
                                      {file.original_filename}
                                      {expandedFileId === file.id ? (
                                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </p>'''

content = p_tag_pattern.sub(p_tag_replacement, content)

# 4. Insert expanded section at the end of the file card
# The file card ends with:
#                                 </div>
#                               </div>
#                             </div>
end_card_pattern = re.compile(
    r'(\s*</button>\s*)\s*\}\s*\s*</div>\s*</div>\s*</div>',
    re.MULTILINE
)
end_card_replacement = '''\\1
                                  )}
                                </div>
                              </div>
                              {/* File Details Expanded Section */}
                              {expandedFileId === file.id && (
                                <div className="mt-4 border-t border-white/[0.06] pt-4 animate-in slide-in-from-top-2 duration-200">
                                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400 mb-4">File Details</h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Account Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Name</div>
                                        <div className="text-sm font-medium text-slate-200">{file.account_name || 'Not Available'}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Number</div>
                                        <div className="text-sm font-medium text-slate-200">{file.account_number || 'Not Available'}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Type</div>
                                        <div className="text-sm font-medium text-slate-200">{file.account_type || 'Not Available'}</div>
                                      </div>
                                    </div>

                                    {/* Bank Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Bank Name</div>
                                        <div className="text-sm font-medium text-slate-200">{file.bank_name || 'Not Available'}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Branch Name</div>
                                        <div className="text-sm font-medium text-slate-200">{file.branch_name || 'Not Available'}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">IFSC</div>
                                          <div className="text-sm font-medium text-slate-200">{file.ifsc || 'Not Available'}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">MICR</div>
                                          <div className="text-sm font-medium text-slate-200">{file.micr || 'Not Available'}</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Statement & Processing Information */}
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement From</div>
                                          <div className="text-sm font-medium text-slate-200">{file.statement_start_date ? formatDate(file.statement_start_date) : 'Not Available'}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement To</div>
                                          <div className="text-sm font-medium text-slate-200">{file.statement_end_date ? formatDate(file.statement_end_date) : 'Not Available'}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Status</div>
                                        <div className="text-sm font-medium text-slate-200">{file.status || 'Not Available'}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Processing Stage</div>
                                          <div className="text-sm font-medium text-slate-200">{file.processing_stage || 'Not Available'}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Processing</div>
                                          <div className="text-sm font-medium text-slate-200">
                                            {file.processing_progress ? `${file.processing_progress}%` : 'Not Available'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>'''

content = end_card_pattern.sub(end_card_replacement, content, count=1)

file_path.write_text(content, encoding='utf-8')
print("Patched CaseDetails.jsx")
