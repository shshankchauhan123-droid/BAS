filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

bad_str = """function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}"""

good_str = """import { formatFinancialValue } from "../../utils/chartFormatter";

function formatCurrency(amount) {
  return formatFinancialValue(amount);
}"""

text = text.replace(bad_str, good_str)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
