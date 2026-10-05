import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

old_update = '''        // Update local state
        setUploadedFiles(prevFiles => prevFiles.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              ...editFormData
            };
          }
          return f;
        }));'''

new_update = '''        // Update local state
        setUploadedFiles(prevFiles => prevFiles.map(f => {
          if (f.id === fileId) {
            return response.data || {
              ...f,
              ...payload
            };
          }
          return f;
        }));'''

if "...editFormData" in content:
    content = content.replace(old_update, new_update)
    file_path.write_text(content, encoding='utf-8')
    print("Fixed response update mapping")
