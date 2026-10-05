import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

target = '''                            </div>
                          )
                        )}'''

replacement = '''                              {/* File Details Expanded Section */}
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
                            </div>
                          )
                        )}'''

content = content.replace(target, replacement)
file_path.write_text(content, encoding='utf-8')
print("Patched successfully!")
