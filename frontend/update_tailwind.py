filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\tailwind.config.js"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

if "darkMode:" not in text:
    text = text.replace("export default {", "export default {\n  darkMode: 'class',")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
