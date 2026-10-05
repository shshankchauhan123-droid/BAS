import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\components\reports\RelationshipGraph.jsx')
content = file_path.read_text(encoding='utf-8')

old_nodes_map = '''    let chartNodes = nodes.map((node) => ({
      id: String(node.id),
      name: node.file_name,
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
          return `{title|${params.name}}\\n{subtitle|${node.bank_name || 'Bank'}}\\n{subtitle|${node.account_number || 'A/C N/A'}}`;
        },
        rich: {
          title: {
            fontSize: 14,
            fontWeight: 'bold',
            color: '#fff'
          },
          subtitle: {
            fontSize: 11,
            color: '#94a3b8'
          }
        },
        position: 'bottom',
        distance: 10
      },
      isStatement: true
    }));'''

new_nodes_map = '''    let chartNodes = nodes.map((node) => {
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
            return `{title|${displayAccount}}\\n{subtitle|${node.bank_name || 'Bank'}}`;
          },
          rich: {
            title: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff'
            },
            subtitle: {
              fontSize: 11,
              color: '#94a3b8'
            }
          },
          position: 'bottom',
          distance: 10
        },
        tooltip: {
          formatter: () => {
            return `<b>Account Number:</b> ${displayAccount}<br/><b>File:</b> ${node.file_name || 'Unknown'}`;
          }
        },
        isStatement: true
      };
    });'''

if "let chartNodes = nodes.map" in content:
    content = content.replace(old_nodes_map, new_nodes_map)
    file_path.write_text(content, encoding='utf-8')
    print("Patched RelationshipGraph.jsx successfully")
else:
    print("Could not find nodes map block")
