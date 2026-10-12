import os
import re

filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Imports
imports = """import Swal from 'sweetalert2';
import html2pdf from 'html2pdf.js';"""
if "import html2pdf" not in text:
    text = text.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\n' + imports)

# 2. Add isExporting state and update handlePrint
handle_print_regex = r"const handlePrint = \(\) => \{\s*window\.print\(\);\s*\};"
new_handle_export = """const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('pdf-report-content');
    
    const opt = {
      margin: 10,
      filename: `Financial_Transaction_Intelligence_Report_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      Swal.fire({
        icon: 'success',
        title: 'Export Successful',
        text: 'The PDF has been downloaded successfully.',
        background: document.documentElement.classList.contains("dark") ? '#1e293b' : '#ffffff',
        color: document.documentElement.classList.contains("dark") ? '#f8fafc' : '#0f172a',
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Export Failed',
        text: 'An error occurred while generating the PDF.',
        background: document.documentElement.classList.contains("dark") ? '#1e293b' : '#ffffff',
        color: document.documentElement.classList.contains("dark") ? '#f8fafc' : '#0f172a',
      });
    } finally {
      setIsExporting(false);
    }
  };"""

text = re.sub(handle_print_regex, new_handle_export, text)

# 3. Add id="pdf-report-content"
text = text.replace('<div className="max-w-7xl mx-auto px-4 py-8 mt-16 print:mt-0 print:p-0">', '<div id="pdf-report-content" className="max-w-7xl mx-auto px-4 py-8 mt-16 print:mt-0 print:p-0">')

# 4. Add data-html2canvas-ignore to hide elements in PDF
text = text.replace('<div className="flex gap-2 print:hidden">', '<div className="flex gap-2 print:hidden" data-html2canvas-ignore>')
text = text.replace('<div className="bg-slate-50 dark:bg-[#03100d] border border-slate-200 dark:border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden">', '<div className="bg-slate-50 dark:bg-[#03100d] border border-slate-200 dark:border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden" data-html2canvas-ignore>')
# If the above replacement failed due to whitespace/formatting, I'll use regex for filters panel:
text = re.sub(r'(<div[^>]*print:hidden[^>]*>)', r'\1', text) # Wait, regex is safer. Let's do it manually if needed.

# 5. Update the button
text = text.replace('onClick={handlePrint}', 'onClick={handleExportPDF}\n                disabled={isExporting}')
text = text.replace('Export PDF\n\n              </button>', '{isExporting ? "Generating PDF..." : "Export PDF"}\n              </button>')
text = text.replace('Export PDF\n              </button>', '{isExporting ? "Generating PDF..." : "Export PDF"}\n              </button>')

# 6. Apply html2canvas-ignore safely to all print:hidden containers inside the main div
text = text.replace('print:hidden', 'print:hidden" data-html2canvas-ignore="true')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
