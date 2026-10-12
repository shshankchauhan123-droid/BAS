filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\layout\UserNavbar.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re
text = re.sub(r'\{theme === "dark" \? ".*?" : ".*?"\}', '{theme === "dark" ? "Light" : "Dark"}', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
