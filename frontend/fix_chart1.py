import re

filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\dynamicReport\DynamicModeWiseChart.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import_str = 'import { formatFinancialValue } from "../../utils/chartFormatter";\n'
if 'formatFinancialValue' not in text:
    text = text.replace('import * as echarts from "echarts";', 'import * as echarts from "echarts";\n' + import_str)

# Add tooltip formatting
tooltip_pattern = r'tooltip:\s*\{\s*trigger:\s*["\']axis["\'],?\s*axisPointer:\s*\{\s*type:\s*["\']shadow["\']\s*\}\s*\},'
new_tooltip = '''tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          let res = `<div style="font-weight:bold;margin-bottom:5px">${params[0].name}</div>`;
          params.forEach(param => {
             const val = (param.seriesName === "Transaction Count") ? param.value : formatFinancialValue(param.value);
             res += `<div>${param.marker} ${param.seriesName}: <b>${val}</b></div>`;
          });
          return res;
        }
      },'''
if 'formatter:' not in text.split('tooltip: {')[1].split('},')[0]:
    text = re.sub(tooltip_pattern, new_tooltip, text)

# Add yAxis formatting
yAxis_pattern = r'yAxis:\s*\[\s*\{\s*type:\s*["\']value["\'],?\s*name:\s*["\']Amount["\'],?\s*axisLabel:\s*\{\s*color:\s*["\']#94a3b8["\']\s*\}\s*\},'
new_yAxis = '''yAxis: [
        {
          type: "value",
          name: "Amount",
          axisLabel: { 
            color: "#94a3b8",
            formatter: function(value) { return formatFinancialValue(value); }
          }
        },'''
text = re.sub(yAxis_pattern, new_yAxis, text)

# Add series label formatting
label_pattern = r'label:\s*\{\s*show:\s*true,\s*position:\s*["\']top["\'],?\s*color:\s*["\']#fff["\'],?\s*fontSize:\s*10\s*\}'
new_label = '''label: {
            show: true,
            position: "top",
            color: "#fff",
            fontSize: 10,
            formatter: function(params) {
               return formatFinancialValue(params.value);
            }
          }'''
text = re.sub(label_pattern, new_label, text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
