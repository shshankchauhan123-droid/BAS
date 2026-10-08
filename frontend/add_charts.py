filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\pages\user\reports\CounterpartyIntelligenceReport.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = "import * as echarts from 'echarts';\nimport { useRef } from 'react';\n" + text

# Add the effect to render charts
chart_effect = '''
  const singleChartRef = useRef(null);
  const multiChartRef = useRef(null);
  
  useEffect(() => {
    if (analysisData && counterparties.length > 0) {
      if (!isMultiFile && singleChartRef.current) {
        const chart = echarts.init(singleChartRef.current);
        const top10 = [...counterparties].sort((a,b) => b.total_transactions - a.total_transactions).slice(0, 10);
        
        const option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: { type: 'value' },
          yAxis: { 
            type: 'category', 
            data: top10.map(c => c.counterparty_name).reverse(),
            axisLabel: { color: '#94a3b8' }
          },
          series: [
            {
              name: 'Transactions',
              type: 'bar',
              data: top10.map(c => c.total_transactions).reverse(),
              itemStyle: { color: '#34d399' }
            }
          ]
        };
        chart.setOption(option);
        
        const resize = () => chart.resize();
        window.addEventListener('resize', resize);
        return () => {
            window.removeEventListener('resize', resize);
            chart.dispose();
        };
      }
      
      if (isMultiFile && multiChartRef.current) {
        const chart = echarts.init(multiChartRef.current);
        const commonCp = counterparties.filter(c => c.file_count >= 2).slice(0, 10);
        
        const option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: { type: 'value' },
          yAxis: { 
            type: 'category', 
            data: commonCp.map(c => c.counterparty_name).reverse(),
            axisLabel: { color: '#94a3b8' }
          },
          series: [
            {
              name: 'Statements Appeared In',
              type: 'bar',
              data: commonCp.map(c => c.file_count).reverse(),
              itemStyle: { color: '#34d399' }
            }
          ]
        };
        chart.setOption(option);
        
        const resize = () => chart.resize();
        window.addEventListener('resize', resize);
        return () => {
            window.removeEventListener('resize', resize);
            chart.dispose();
        };
      }
    }
  }, [analysisData, counterparties, isMultiFile]);
'''

text = text.replace('  const topActive = [...counterparties]', chart_effect + '\n  const topActive = [...counterparties]')

# Add chart divs
chart_div = '''            
            <div className="mt-8 bg-[#020b09] border border-emerald-500/20 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                {isMultiFile ? "Top Common Counterparties" : "Top Counterparties (by Transactions)"}
              </h2>
              {isMultiFile ? (
                  <div ref={multiChartRef} style={{ width: '100%', height: '300px' }}></div>
              ) : (
                  <div ref={singleChartRef} style={{ width: '100%', height: '300px' }}></div>
              )}
            </div>
'''

text = text.replace('{/* Counterparty Table */}', chart_div + '\n            {/* Counterparty Table */}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Added charts")
