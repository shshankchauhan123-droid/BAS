import pathlib

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\cases\CaseDetails.jsx')
content = file_path.read_text(encoding='utf-8')

# Fix the broken helper function
broken = '''          if (typeof item === "string") {
            return item;
          }

            const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
    } else {
      setExpandedFileId(fileId);
    }
  };

  return (
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
          );'''

fixed = '''          if (typeof item === "string") {
            return item;
          }
          return (
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
          );'''

if broken in content:
    content = content.replace(broken, fixed)
    print("Fixed broken helper")
else:
    print("Broken string not found exactly, will use regex")
    import re
    broken_regex = re.compile(r'if \(typeof item === "string"\) \{\s*return item;\s*\}\s*const handleFileClick.*?return \(\s*item\?\.msg', re.DOTALL)
    fixed_regex = r'''if (typeof item === "string") {
            return item;
          }
          return (
            item?.msg'''
    content = broken_regex.sub(fixed_regex, content)


# Now we add handleFileClick correctly
# Let's place it right before: const loadCaseDetails = async () => {
# which is usually at the top level of the component
target = '  const loadCaseDetails = async () => {'
handle_click = '''  const handleFileClick = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
    } else {
      setExpandedFileId(fileId);
    }
  };

  const loadCaseDetails = async () => {'''

if target in content and "const handleFileClick" not in content:
    content = content.replace(target, handle_click)
    print("Added handleFileClick correctly")

file_path.write_text(content, encoding='utf-8')
