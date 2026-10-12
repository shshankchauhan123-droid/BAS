import os
import re

replacements = {
    r"bg-\[#020b09\]": "bg-slate-50 dark:bg-[#020b09]",
    r"bg-\[#040e0c\]": "bg-white dark:bg-[#040e0c]",
    r"bg-\[#061411\]": "bg-white dark:bg-[#061411]",
    r"bg-\[#0a1714\]": "bg-white dark:bg-[#0a1714]",
    r"bg-\[#06201a\]": "bg-slate-100 dark:bg-[#06201a]",
    r"bg-\[#021814\]": "bg-white dark:bg-[#021814]",
    r"bg-\[#03120f\]": "bg-white dark:bg-[#03120f]",
    r"bg-\[#03100d\]": "bg-slate-50 dark:bg-[#03100d]",
    r"bg-\[#071512\]": "bg-white dark:bg-[#071512]",
    r"bg-\[#021310\]": "bg-white dark:bg-[#021310]",
    
    # Text colors
    r"text-white(?!/\[)": "text-slate-900 dark:text-white",
    r"text-white/\[0\.04\]": "text-slate-900/[0.04] dark:text-white/[0.04]",
    r"text-white/\[0\.08\]": "text-slate-900/[0.08] dark:text-white/[0.08]",
    r"text-white/\[0\.12\]": "text-slate-900/[0.12] dark:text-white/[0.12]",
    r"text-slate-300": "text-slate-600 dark:text-slate-300",
    r"text-slate-400": "text-slate-600 dark:text-slate-400",
    r"text-slate-200": "text-slate-800 dark:text-slate-200",
    r"text-gray-300": "text-gray-600 dark:text-gray-300",
    r"text-gray-400": "text-gray-600 dark:text-gray-400",
    
    # Borders
    r"border-white/\[0\.04\]": "border-slate-200 dark:border-white/[0.04]",
    r"border-white/\[0\.06\]": "border-slate-200 dark:border-white/[0.06]",
    r"border-white/\[0\.08\]": "border-slate-200 dark:border-white/[0.08]",
    r"border-white/\[0\.12\]": "border-slate-300 dark:border-white/[0.12]",
    r"border-slate-800": "border-slate-200 dark:border-slate-800",
    r"border-slate-700": "border-slate-300 dark:border-slate-700",
    r"border-\[#1a2924\]": "border-slate-200 dark:border-[#1a2924]",
    
    # Custom bg transparencies
    r"bg-white/\[0\.02\]": "bg-slate-100 dark:bg-white/[0.02]",
    r"bg-white/\[0\.04\]": "bg-slate-200 dark:bg-white/[0.04]",
    r"bg-white/\[0\.06\]": "bg-slate-200 dark:bg-white/[0.06]",
    r"bg-white/\[0\.08\]": "bg-slate-300 dark:bg-white/[0.08]",
}

def scan_dir(d):
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.jsx') or f.endswith('.js') or f.endswith('.ts') or f.endswith('.tsx'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                new_content = content
                for old, new in replacements.items():
                    # Use negative lookbehind to avoid replacing already themed tags
                    # e.g., (?<!dark:)(?<!\w)bg-\[#020b09\]
                    pattern = r'(?<!dark:)(?<!\w)' + old
                    new_content = re.sub(pattern, new, new_content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)

scan_dir(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src')
print("Replaced all tailwind classes globally.")
