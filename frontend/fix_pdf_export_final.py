import os
import re

filepath = r"c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\FinancialTransactionIntelligenceReport.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Check if imports are already there
if "html2pdf.js" not in text:
    text = text.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport Swal from "sweetalert2";\nimport html2pdf from "html2pdf.js";')

# 2. Replace the handlePrint block with handleExportPDF
# The block is:
#   const handlePrint = () => {
#
#     window.print();
#
#   };

handle_print_regex = re.compile(r"const handlePrint = \(\) => \{\s*window\.print\(\);\s*\};", re.DOTALL)

new_handle_export = """const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('pdf-report-content');
    
    if (!element) {
      console.error("PDF container not found");
      setIsExporting(false);
      return;
    }

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

if "const handleExportPDF" not in text:
    text = handle_print_regex.sub(new_handle_export, text)

# 3. Add id to the main wrapper
text = text.replace('<div className="max-w-7xl mx-auto px-4 py-8 mt-16 print:mt-0 print:p-0">', '<div id="pdf-report-content" className="max-w-7xl mx-auto px-4 py-8 mt-16 print:mt-0 print:p-0">')

# 4. Hide print:hidden from html2canvas
text = re.sub(r'className="flex gap-2 print:hidden"', 'className="flex gap-2 print:hidden" data-html2canvas-ignore="true"', text)
text = re.sub(r'className="bg-slate-50 dark:bg-\[#03100d\] border border-slate-200 dark:border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden"', 'className="bg-slate-50 dark:bg-[#03100d] border border-slate-200 dark:border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden" data-html2canvas-ignore="true"', text)
text = re.sub(r'className="bg-\[#03120f\] border border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden"', 'className="bg-[#03120f] border border-emerald-500/20 rounded-xl p-4 mb-8 print:hidden" data-html2canvas-ignore="true"', text)

# 5. Update the button
text = text.replace('onClick={handlePrint}', 'onClick={handleExportPDF}\n                disabled={isExporting}')

text = text.replace('Export PDF\n\n              </button>', '{isExporting ? "Generating PDF..." : "Export PDF"}\n              </button>')
text = text.replace('Export PDF\n              </button>', '{isExporting ? "Generating PDF..." : "Export PDF"}\n              </button>')
text = re.sub(r'Export PDF\s*</button>', '{isExporting ? "Generating PDF..." : "Export PDF"}\n              </button>', text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
