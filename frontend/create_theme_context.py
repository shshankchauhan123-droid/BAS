import os

os.makedirs(r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\context", exist_ok=True)

theme_context_content = """import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("bas-theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    localStorage.setItem("bas-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // Dispatch an event so components like ECharts can re-render immediately
    window.dispatchEvent(new Event("theme-change"));
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
"""

with open(r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\context\ThemeContext.jsx", "w", encoding="utf-8") as f:
    f.write(theme_context_content)
