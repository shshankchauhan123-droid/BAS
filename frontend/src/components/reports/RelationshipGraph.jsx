import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

import { formatFinancialValue } from "../../utils/chartFormatter";

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
      const displayAccount =
        (node.account_number && String(node.account_number).trim()) ||
        (node.file_name && (node.file_name.match(/(?:Merged_Statement_|Statement_)?(\d{9,18})/i)?.[1])) ||
        'Unknown Account';

      return {
        id: String(node.id),
        name: displayAccount,
        value: node.matching_transaction_count,
        symbolSize: 72,
        itemStyle: {
          color: '#059669',
          borderColor: '#a7f3d0',
          borderWidth: 3,
          shadowColor: 'rgba(5, 150, 105, 0.25)',
          shadowBlur: 10
        },
        label: {
          show: true,
          formatter: () => `{title|${displayAccount}}\n{subtitle|${node.bank_name || 'Bank Account'}}`,
          rich: {
            title: {
              fontSize: 13,
              fontWeight: 'bold',
              color: '#172554',
              lineHeight: 18
            },
            subtitle: {
              fontSize: 11,
              color: '#64748B',
              fontWeight: '500',
              lineHeight: 16
            }
          },
          position: 'bottom',
          distance: 10
        },
        tooltip: {
          formatter: () => {
            return `
              <div style="font-weight: 800; color: #172554; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                ${node.bank_name || 'Bank Statement Account'}
              </div>
              <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                <b>Account:</b> <span style="font-family: monospace; font-weight: 700; color: #059669;">${displayAccount}</span><br/>
                <b>File:</b> ${node.file_name || 'Statement File'}<br/>
                <b>Transactions:</b> ${Number(node.matching_transaction_count || 0).toLocaleString('en-IN')}
              </div>
            `;
          }
        },
        isStatement: true
      };
    });

    let chartEdges = [];
    const relationTxIds = new Set();
    
    // Multi-statement scenario: create edges for relationships
    if (nodes.length > 1) {
      edges.forEach((edgeGrp) => {
        const txs = edgeGrp.transactions || [];
        if (txs.length > 0) {
          txs.forEach((tx, idx) => {
            relationTxIds.add(tx.id);
            
            // Distribute curveness between -0.4 and 0.4
            let curveness = 0;
            if (txs.length > 1) {
               const step = 0.8 / (txs.length - 1);
               curveness = -0.4 + (step * idx);
            }
            
            chartEdges.push({
              id: `edge-${edgeGrp.id}-${tx.id}`,
              source: String(edgeGrp.source),
              target: String(edgeGrp.target),
              value: tx.amount,
              lineStyle: {
                width: 2,
                color: tx.debit > 0 ? '#e11d48' : '#059669',
                opacity: 0.75,
                curveness: curveness
              },
              label: {
                show: true,
                formatter: () => `{amt|${formatCurrency(tx.amount)}}`,
                rich: {
                  amt: {
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: tx.debit > 0 ? '#be123c' : '#047857',
                    backgroundColor: tx.debit > 0 ? '#ffe4e6' : '#d1fae5',
                    borderColor: tx.debit > 0 ? '#fecdd3' : '#a7f3d0',
                    borderWidth: 1,
                    padding: [2, 6],
                    borderRadius: 4
                  }
                }
              },
              tooltip: {
                formatter: () => {
                  return `
                    <div style="font-weight: 800; color: #172554; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                      Direct Relationship
                    </div>
                    <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                      <b>Amount:</b> <span style="font-weight: 800; color: ${tx.debit > 0 ? '#e11d48' : '#059669'};">${formatCurrency(tx.amount)}</span><br/>
                      <b>Mode:</b> ${tx.mode || 'N/A'}<br/>
                      <b>Date:</b> ${tx.transaction_date || 'N/A'}<br/>
                      <b>Description:</b> ${tx.description || 'N/A'}
                    </div>
                  `;
                }
              },
              raw_edge: edgeGrp,
              raw_tx: tx
            });
          });
        }
      });
    }

    // For ALL transactions not part of a relationship edge, create satellite nodes
    transactions.forEach(tx => {
      if (relationTxIds.has(tx.id)) return;
      
      const centralNodeId = `file-${tx.file_id}`;
      
      chartNodes.push({
        id: `tx-${tx.id}`,
        name: `Txn ${tx.id}`,
        symbol: 'roundRect',
        symbolSize: [115, 52],
        itemStyle: {
          color: tx.debit > 0 ? '#fff1f2' : '#ecfdf5',
          borderColor: tx.debit > 0 ? '#fecdd3' : '#a7f3d0',
          borderWidth: 1,
          shadowColor: 'rgba(15, 23, 42, 0.04)',
          shadowBlur: 6
        },
        label: {
          show: true,
          position: 'inside',
          formatter: () => `{amt|${formatCurrency(tx.amount)}}\n{desc|${tx.mode || 'N/A'} • ${tx.debit > 0 ? 'Debit' : 'Credit'}}`,
          rich: {
            amt: { fontSize: 11, fontWeight: 'bold', color: tx.debit > 0 ? '#e11d48' : '#059669' },
            desc: { fontSize: 9, color: '#64748B', padding: [2, 0], fontWeight: '600' }
          }
        },
        tooltip: {
          formatter: () => {
            return `
              <div style="font-weight: 800; color: #172554; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                ${tx.debit > 0 ? 'Debit Transaction' : 'Credit Transaction'}
              </div>
              <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                <b>Amount:</b> <span style="font-weight: 800; color: ${tx.debit > 0 ? '#e11d48' : '#059669'};">${formatCurrency(tx.amount)}</span><br/>
                <b>Mode:</b> ${tx.mode || 'N/A'}<br/>
                <b>Date:</b> ${tx.transaction_date || 'N/A'}<br/>
                <b>Description:</b> ${tx.description || 'N/A'}
              </div>
            `;
          }
        },
        isTransaction: true,
        raw_tx: tx
      });
      
      chartEdges.push({
        id: `edge-tx-${tx.id}`,
        source: centralNodeId,
        target: `tx-${tx.id}`,
        lineStyle: { width: 1.5, color: tx.debit > 0 ? '#e11d48' : '#059669', type: 'dashed' },
        label: { show: false }
      });
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: { 
        show: true, 
        trigger: 'item', 
        backgroundColor: '#ffffff', 
        borderColor: '#e2e8f0', 
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06); border-radius: 12px; padding: 12px;',
        textStyle: { color: '#172554', fontFamily: 'inherit' } 
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          force: {
            repulsion: 2500,
            edgeLength: nodes.length === 1 ? 160 : 360,
            gravity: 0.1
          },
          roam: true,
          label: { show: true },
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: [4, 10],
          edgeLabel: { fontSize: 12 },
          data: chartNodes,
          links: chartEdges,
          lineStyle: {
            color: 'source',
            curveness: 0.2
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 4 }
          }
        }
      ]
    };

    myChart.setOption(option);

    myChart.on('click', (params) => {
      if (params.dataType === 'edge' && params.data.raw_edge) {
        setSelectedPanel({ type: 'edge', data: params.data.raw_edge, title: 'Relationship Details' });
      } else if (params.dataType === 'node' && params.data.isSummary) {
        setSelectedPanel({ type: 'summary', data: { transactions, total_amount: transactions.reduce((s, t) => s + t.amount, 0), transaction_count: transactions.length }, title: 'Filtered Transactions' });
      } else if (params.dataType === 'node' && params.data.isTransaction) {
        setSelectedPanel({ type: 'transaction', data: { transactions: [params.data.raw_tx], total_amount: params.data.raw_tx.amount, transaction_count: 1 }, title: 'Transaction Details' });
      } else {
        setSelectedPanel(null);
      }
    });

    const handleResize = () => myChart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      myChart.dispose();
    };
  }, [nodes, edges, transactions]);

  // Derived panel data
  const panelData = selectedPanel?.data || { transactions: [] };
  const txList = panelData.transactions || [];

  return (
    <div className="relative w-full h-[650px] border border-slate-200 bg-white rounded-2xl shadow-xs overflow-hidden">
      <div ref={chartRef} className="w-full h-full" />
      
      {/* Transaction / Relationship Drill-Down Panel */}
      {selectedPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-[420px] max-w-full bg-white border-l border-slate-200 p-6 overflow-y-auto z-20 shadow-[-10px_0_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-[#172554] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {selectedPanel.title}
            </h3>
            <button 
              onClick={() => setSelectedPanel(null)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 mb-5 border border-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Volume</p>
            <p className="text-2xl font-black font-mono text-[#172554]">{formatCurrency(panelData.total_amount)}</p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {panelData.transaction_count} Transaction{panelData.transaction_count === 1 ? '' : 's'}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Transaction Details ({txList.length})
            </h4>
            {txList.map((tx) => (
              <div 
                key={tx.id} 
                className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-emerald-300 hover:shadow-2xs transition-all space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {tx.mode || 'TRANSFER'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    {tx.transaction_date || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-base font-extrabold font-mono text-[#172554]">
                    {formatCurrency(tx.amount)}
                  </span>
                  <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md border ${
                    tx.debit > 0 
                      ? 'text-rose-700 bg-rose-50 border-rose-200' 
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}>
                    {tx.debit > 0 ? 'Debit' : 'Credit'}
                  </span>
                </div>

                {tx.reference_number && (
                  <p className="text-xs text-slate-500 truncate">
                    <span className="font-semibold text-slate-600">Ref:</span> {tx.reference_number}
                  </p>
                )}

                {tx.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={tx.description}>
                    <span className="font-semibold text-slate-700">Desc:</span> {tx.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty / Zero-Relationship Overlays */}
      {nodes.length === 0 && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xs z-0 pointer-events-none p-6 text-center">
           <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3 shadow-2xs">
             <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
           </div>
           <p className="text-base font-bold text-[#172554]">No Relationships Found</p>
           <p className="text-xs text-slate-500 mt-1 max-w-sm">Try selecting different statement files or adjusting your amount and date filters above.</p>
         </div>
      )}
      
      {nodes.length > 0 && edges.length === 0 && transactions.length === 0 && (
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-rose-50 border border-rose-200 text-rose-800 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm z-10 pointer-events-none">
           No transactions match the selected filters.
         </div>
      )}
      
      {nodes.length > 1 && edges.length === 0 && transactions.length > 0 && (
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-50 border border-blue-200 text-blue-900 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm z-10 pointer-events-none">
           No cross-statement transaction relationships found between the selected accounts for the current filters.
         </div>
      )}
    </div>
  );
}
