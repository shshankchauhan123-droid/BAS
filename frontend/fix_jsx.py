filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Just to be safe, replace whatever is there.
text = re.sub(r'<div className=\{grid gap-4 mt-6.*?\}', r'<div className={grid gap-4 mt-6 }', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Fixed JSX className interpolation issue")
