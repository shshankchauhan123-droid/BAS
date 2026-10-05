import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

old_save = '''    try {
      const response = await updateFileDetails(fileId, editFormData);'''

new_save = '''    try {
      const payload = { ...editFormData };
      // Convert empty strings to null to avoid Pydantic date validation errors
      Object.keys(payload).forEach(key => {
        if (payload[key] === "") {
          payload[key] = null;
        }
      });
      const response = await updateFileDetails(fileId, payload);'''

if "const payload =" not in content:
    content = content.replace(old_save, new_save)
    file_path.write_text(content, encoding='utf-8')
    print("Fixed payload empty string handling")
