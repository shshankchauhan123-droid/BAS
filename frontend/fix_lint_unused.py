filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import React, { useState, useEffect, useRef, useMemo } from "react";', 'import { useState, useEffect } from "react";')
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Removed unused imports")
