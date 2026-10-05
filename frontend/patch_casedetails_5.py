import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

target = r'(\s+useEffect\(\(\) => \{)'
replacement = r'''

  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
    } else {
      setExpandedFileId(fileId);
    }
  };
\1'''

content = re.sub(target, replacement, content, count=1)

file_path.write_text(content, encoding='utf-8')
print("Added handleFileClick")
