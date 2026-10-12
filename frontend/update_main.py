import os

filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\main.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

if "ThemeProvider" not in text:
    text = text.replace('import { AuthProvider } from "./context/AuthContext.jsx";', 'import { AuthProvider } from "./context/AuthContext.jsx";\nimport { ThemeProvider } from "./context/ThemeContext.jsx";')
    text = text.replace('<AuthProvider>', '<ThemeProvider>\n    <AuthProvider>')
    text = text.replace('</AuthProvider>', '</AuthProvider>\n    </ThemeProvider>')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)

filepath_html = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\index.html"
with open(filepath_html, "r", encoding="utf-8") as f:
    html = f.read()

# Add script to avoid flash
script = """
    <script>
      (function() {
        var theme = localStorage.getItem("bas-theme");
        if (theme === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
        }
      })();
    </script>
"""
if "bas-theme" not in html:
    html = html.replace("<title>frontend</title>", "<title>frontend</title>" + script)

with open(filepath_html, "w", encoding="utf-8") as f:
    f.write(html)
