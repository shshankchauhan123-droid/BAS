import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

# 1. Update imports
old_import = '''  uploadFile,
  getFileView,
  deleteFile,
} from "../../../services/api/file";'''

new_import = '''  uploadFile,
  getFileView,
  deleteFile,
  updateFileDetails,
} from "../../../services/api/file";'''

if "updateFileDetails" not in content:
    content = content.replace(old_import, new_import)


# 2. Add state variables near expandedFileId
old_state = '''  const [expandedFileId, setExpandedFileId] = useState(null);'''
new_state = '''  const [expandedFileId, setExpandedFileId] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSavingFile, setIsSavingFile] = useState(false);'''

if "const [editingFileId" not in content:
    content = content.replace(old_state, new_state)


# 3. Add handler functions right after handleFileClick
old_click = '''  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
    } else {
      setExpandedFileId(fileId);
    }
  };'''

new_click = '''  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
      setEditingFileId(null);
    } else {
      setExpandedFileId(fileId);
      setEditingFileId(null);
    }
  };

  const handleEditClick = (e, file) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditFormData({
      account_name: file.account_name || "",
      account_number: file.account_number || "",
      bank_name: file.bank_name || "",
      branch_name: file.branch_name || "",
      ifsc: file.ifsc || "",
      micr: file.micr || "",
      account_type: file.account_type || "",
      statement_start_date: file.statement_start_date || "",
      statement_end_date: file.statement_end_date || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingFileId(null);
    setEditFormData({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveFileDetails = async (fileId) => {
    setIsSavingFile(true);
    try {
      const response = await updateFileDetails(fileId, editFormData);
      if (response && response.success) {
        // Update local state
        setUploadedFiles(prevFiles => prevFiles.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              ...editFormData
            };
          }
          return f;
        }));
        setEditingFileId(null);
        // show success (if toast is available, but for now just console or alert is fine if toast isn't in scope)
      } else {
        alert(response?.message || "Failed to update file details");
      }
    } catch (err) {
      alert(err.message || "An error occurred while saving");
    } finally {
      setIsSavingFile(false);
    }
  };'''

if "handleEditClick" not in content:
    content = content.replace(old_click, new_click)


# 4. Modify File Details section
old_ui_block = r'''                                  <h4 className="text-\[10px\] font-semibold uppercase tracking-\[0\.14em\] text-emerald-400 mb-4">File Details</h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/\* Account Information \*/}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Account Name</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.account_name \|\| 'Not Available'\}</div>
                                      </div>
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Account Number</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.account_number \|\| 'Not Available'\}</div>
                                      </div>
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Account Type</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.account_type \|\| 'Not Available'\}</div>
                                      </div>
                                    </div>

                                    {/\* Bank Information \*/}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Bank Name</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.bank_name \|\| 'Not Available'\}</div>
                                      </div>
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Branch Name</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.branch_name \|\| 'Not Available'\}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">IFSC</div>
                                          <div className="text-sm font-medium text-slate-200">\{file\.ifsc \|\| 'Not Available'\}</div>
                                        </div>
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">MICR</div>
                                          <div className="text-sm font-medium text-slate-200">\{file\.micr \|\| 'Not Available'\}</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/\* Statement & Processing Information \*/}
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">Statement From</div>
                                          <div className="text-sm font-medium text-slate-200">\{file\.statement_start_date \? formatDate\(file\.statement_start_date\) : 'Not Available'\}</div>
                                        </div>
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">Statement To</div>
                                          <div className="text-sm font-medium text-slate-200">\{file\.statement_end_date \? formatDate\(file\.statement_end_date\) : 'Not Available'\}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-\[10px\] uppercase text-slate-500 mb-1">Status</div>
                                        <div className="text-sm font-medium text-slate-200">\{file\.status \|\| 'Not Available'\}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">Processing Stage</div>
                                          <div className="text-sm font-medium text-slate-200">\{file\.processing_stage \|\| 'Not Available'\}</div>
                                        </div>
                                        <div>
                                          <div className="text-\[10px\] uppercase text-slate-500 mb-1">Processing</div>
                                          <div className="text-sm font-medium text-slate-200">
                                            \{file\.processing_progress \? `\$\{file\.processing_progress\}%` : 'Not Available'\}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>'''


new_ui_block = '''                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">File Details</h4>
                                    {editingFileId !== file.id && (
                                      <button 
                                        type="button" 
                                        onClick={(e) => handleEditClick(e, file)}
                                        className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300 hover:text-cyan-400 border border-cyan-400/20 hover:border-cyan-400/40 bg-cyan-400/[0.05] hover:bg-cyan-400/[0.1] px-3 py-1 rounded-full transition-all"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Account Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_name" value={editFormData.account_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Number</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_number" value={editFormData.account_number} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_number || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Account Type</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="account_type" value={editFormData.account_type} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.account_type || 'Not Available'}</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Bank Information */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Bank Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="bank_name" value={editFormData.bank_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.bank_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase text-slate-500 mb-1">Branch Name</div>
                                        {editingFileId === file.id ? (
                                          <input type="text" name="branch_name" value={editFormData.branch_name} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                        ) : (
                                          <div className="text-sm font-medium text-slate-200">{file.branch_name || 'Not Available'}</div>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">IFSC</div>
                                          {editingFileId === file.id ? (
                                            <input type="text" name="ifsc" value={editFormData.ifsc} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.ifsc || 'Not Available'}</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">MICR</div>
                                          {editingFileId === file.id ? (
                                            <input type="text" name="micr" value={editFormData.micr} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.micr || 'Not Available'}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Statement & Processing Information */}
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement From</div>
                                          {editingFileId === file.id ? (
                                            <input type="date" name="statement_start_date" value={editFormData.statement_start_date} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.statement_start_date ? formatDate(file.statement_start_date) : 'Not Available'}</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase text-slate-500 mb-1">Statement To</div>
                                          {editingFileId === file.id ? (
                                            <input type="date" name="statement_end_date" value={editFormData.statement_end_date} onChange={handleEditChange} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50" />
                                          ) : (
                                            <div className="text-sm font-medium text-slate-200">{file.statement_end_date ? formatDate(file.statement_end_date) : 'Not Available'}</div>
                                          )}
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
                                  
                                  {editingFileId === file.id && (
                                    <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]">
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingFile}
                                        className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveFileDetails(file.id)}
                                        disabled={isSavingFile}
                                        className="px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        {isSavingFile ? 'Saving...' : 'Save Changes'}
                                      </button>
                                    </div>
                                  )}'''

content = re.sub(old_ui_block, new_ui_block, content, count=1)

file_path.write_text(content, encoding='utf-8')
print("Patched frontend CaseDetails successfully")
