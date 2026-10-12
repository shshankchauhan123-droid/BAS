import os
import re

from collections import Counter

color_pattern = re.compile(r'bg-\[#[a-fA-F0-9]+\]')

counter = Counter()

def scan_dir(d):
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.jsx') or f.endswith('.js'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    matches = color_pattern.findall(content)
                    counter.update(matches)

scan_dir(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages')
scan_dir(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components')

for k, v in counter.most_common(20):
    print(f"{k}: {v}")
