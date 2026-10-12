import os
filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\layout\UserNavbar.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re
text = text.replace('{theme === "dark" ? "\\u2600 Light" : "\\u1F319 Dark"}', '{theme === "dark" ? "\\u{2600} Light" : "\\u{1F319} Dark"}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
