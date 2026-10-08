filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add formatDate helper
if "const formatDate = " not in text:
    text = text.replace(
        "export default function CounterpartyIntelligenceReport() {", 
        "const formatDate = (dateStr) => {\n  if (!dateStr) return '-';\n  const parts = dateStr.split('-');\n  if (parts.length === 3) return f\"{parts[2]}/{parts[1]}/{parts[0]}\";\n  return dateStr;\n};\n\nexport default function CounterpartyIntelligenceReport() {"
    )

# 2. Remove Type header
text = text.replace(
    '<th className="px-4 py-3 font-medium">Type</th>',
    ''
)

# 3. Remove Type cell
import re
text = re.sub(
    r'<td className="px-4 py-3 whitespace-nowrap">\{cp\.counterparty_type \|\| \'-\'\}</td>',
    '',
    text
)

# 4. Update dates
text = text.replace(
    '<td className="px-4 py-3 text-right">{cp.first_transaction}</td>',
    '<td className="px-4 py-3 text-right">{formatDate(cp.first_transaction)}</td>'
)
text = text.replace(
    '<td className="px-4 py-3 text-right">{cp.last_transaction}</td>',
    '<td className="px-4 py-3 text-right">{formatDate(cp.last_transaction)}</td>'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated CounterpartyIntelligenceReport.jsx")
