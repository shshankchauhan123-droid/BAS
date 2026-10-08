filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

bad_text = """import { formatFinancialValue } from "../../utils/chartFormatter";

function formatCurrency(amount) {
  return formatFinancialValue(amount);
}\\n{subtitle|\\${node.bank_name || 'Bank'}}\\`;"""

good_text = """import { formatFinancialValue } from "../../utils/chartFormatter";

function formatCurrency(amount) {
  return formatFinancialValue(amount);
}

export default function RelationshipGraph({ nodes = [], edges = [], transactions = [] }) {
  const chartRef = useRef(null);
  const [selectedPanel, setSelectedPanel] = useState(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const myChart = echarts.init(chartRef.current);

    let chartNodes = nodes.map((node) => {
      const displayAccount = (node.account_number && String(node.account_number).trim()) || 'Account number not available';
      return {
        id: String(node.id),
        name: displayAccount,
        value: node.matching_transaction_count,
        symbolSize: 70,
        itemStyle: {
          color: '#059669',
          borderColor: '#34d399',
          borderWidth: 2,
          shadowColor: 'rgba(52, 211, 153, 0.5)',
          shadowBlur: 10
        },
        label: {
          show: true,
          formatter: (params) => {
            return `{title|${displayAccount}}\\n{subtitle|${node.bank_name || 'Bank'}}`;"""

text = text.replace(bad_text, good_text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
