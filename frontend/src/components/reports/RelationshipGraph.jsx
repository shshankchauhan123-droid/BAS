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
            return `{title|${displayAccount}}\n{subtitle|${node.bank_name || 'Bank'}}`;
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
                width: 1.5,
                color: tx.debit > 0 ? '#e11d48' : '#10b981',
                opacity: 0.6,
                curveness: curveness
              },
              label: {
                show: true,
                formatter: () => `{amt|${formatCurrency(tx.amount)}}`,
                rich: {
                  amt: {
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: tx.debit > 0 ? '#fda4af' : '#6ee7b7',
                    backgroundColor: '#0f172a',
                    padding: [1, 2],
                    borderRadius: 2
                  }
                }
              },
              tooltip: {
                formatter: () => {
                  return `<b>Amount:</b> ${formatCurrency(tx.amount)}<br/><b>Mode:</b> ${tx.mode || 'N/A'}<br/><b>Date:</b> ${tx.transaction_date || 'N/A'}<br/><b>Desc:</b> ${tx.description || 'N/A'}`;
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
        symbolSize: [110, 50],
        itemStyle: {
          color: tx.debit > 0 ? '#2e1017' : '#0a2217',
          borderColor: tx.debit > 0 ? '#e11d48' : '#10b981',
          borderWidth: 1
        },
        label: {
          show: true,
          position: 'inside',
          formatter: () => `{amt|${formatCurrency(tx.amount)}}\n{desc|${tx.mode || 'N/A'} | ${tx.debit > 0 ? 'Debit' : 'Credit'}}`,
          rich: {
            amt: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
            desc: { fontSize: 9, color: '#94a3b8', padding: [2, 0] }
          }
        },
        tooltip: {
          formatter: () => {
            return `<b>Amount:</b> ${formatCurrency(tx.amount)}<br/><b>Mode:</b> ${tx.mode || 'N/A'}<br/><b>Date:</b> ${tx.transaction_date || 'N/A'}<br/><b>Desc:</b> ${tx.description || 'N/A'}`;
          }
        },
        isTransaction: true,
        raw_tx: tx
      });
      
      chartEdges.push({
        id: `edge-tx-${tx.id}`,
        source: centralNodeId,
        target: `tx-${tx.id}`,
        lineStyle: { width: 1.5, color: tx.debit > 0 ? '#e11d48' : '#10b981', type: 'dashed' },
        label: { show: false }
      });
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: { 
        show: true, 
        trigger: 'item', 
        backgroundColor: '#0f172a', 
        borderColor: '#334155', 
        textStyle: { color: '#fff' } 
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          force: {
            repulsion: 2500,
            edgeLength: nodes.length === 1 ? 150 : 350,
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
            lineStyle: { width: 5 }
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
    <div className="relative w-full h-[600px] border border-white/[0.08] bg-[#03100d]/90 rounded-2xl shadow-xl overflow-hidden">
      <div ref={chartRef} className="w-full h-full" />
      
      {selectedPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-[450px] bg-[#061411] border-l border-white/[0.08] p-6 overflow-y-auto z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-emerald-400">{selectedPanel.title}</h3>
            <button 
              onClick={() => setSelectedPanel(null)}
              className="text-slate-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-[#020b09] rounded-xl p-4 mb-6 border border-white/[0.04]">
            <p className="text-xs text-slate-400 mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(panelData.total_amount)}</p>
            <p className="text-xs text-emerald-500 mt-1">{panelData.transaction_count} Transactions</p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-300">Transaction History</h4>
            {txList.map((tx) => (
              <div key={tx.id} className="bg-[#020b09] rounded-xl p-4 border border-white/[0.04] hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                    {tx.mode || 'TRANSFER'}
                  </span>
                  <span className="text-xs text-slate-500">{tx.transaction_date}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-white">
                    {formatCurrency(tx.amount)}
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${tx.debit > 0 ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                    {tx.debit > 0 ? 'Debit' : 'Credit'}
                  </span>
                </div>
                {tx.reference_number && (
                  <p className="text-xs text-slate-400 mb-1">
                    <span className="text-slate-500 font-medium">Ref:</span> {tx.reference_number}
                  </p>
                )}
                {tx.description && (
                  <p className="text-xs text-slate-400 line-clamp-2" title={tx.description}>
                    <span className="text-slate-500 font-medium">Desc:</span> {tx.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {nodes.length === 0 && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020b09]/80 backdrop-blur-sm z-0 pointer-events-none">
           <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
           </svg>
           <p className="text-slate-400 font-semibold">No Relationships Found</p>
           <p className="text-xs text-slate-500 mt-2">Try adjusting your filters or selecting different files.</p>
         </div>
      )}
      
      {nodes.length > 0 && edges.length === 0 && transactions.length === 0 && (
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 z-0 pointer-events-none">
           No transactions match the selected filters.
         </div>
      )}
      
      {nodes.length > 1 && edges.length === 0 && transactions.length > 0 && (
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 z-0 pointer-events-none">
           No transaction relationships found between the selected statements for the current filters.
         </div>
      )}
    </div>
  );
}
