import os

filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Add imports
if 'import html2pdf' not in text:
    text = text.replace('import React, { useRef, useState, useEffect } from "react";', 'import React, { useRef, useState, useEffect } from "react";\nimport html2pdf from "html2pdf.js";\nimport Swal from "sweetalert2";')

# Add type="button"
text = text.replace('<button\n\n                onClick={handleExportPDF}', '<button\n                type="button"\n                onClick={handleExportPDF}')
text = text.replace('<button\n                onClick={handleExportPDF}', '<button\n                type="button"\n                onClick={handleExportPDF}')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
