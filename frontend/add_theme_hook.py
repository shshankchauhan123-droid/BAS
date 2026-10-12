filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\context\ThemeContext.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

add_hook = """
export function useThemeListener() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const handler = () => setKey(prev => prev + 1);
    window.addEventListener("theme-change", handler);
    return () => window.removeEventListener("theme-change", handler);
  }, []);
  return key;
}
"""

if "useThemeListener" not in text:
    text += add_hook

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
