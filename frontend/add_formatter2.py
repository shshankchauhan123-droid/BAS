filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\utils\chartFormatter.js'
with open(filepath, 'w', encoding='utf-8') as f:
    f.write('''
export function formatFinancialValue(value) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 10000000) {
    return `${sign}\u20B9${(abs / 10000000).toFixed(2)} Cr`;
  } else if (abs >= 100000) {
    return `${sign}\u20B9${(abs / 100000).toFixed(2)} L`;
  } else {
    // Format below 1,00,000 as exact Indian numbering format
    return `${sign}\u20B9${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}
''')
