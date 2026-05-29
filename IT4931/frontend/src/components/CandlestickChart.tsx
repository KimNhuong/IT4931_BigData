import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { OhlcCandle } from '../services/api';

interface CandlestickChartProps {
  symbol: string;
  candles: OhlcCandle[];
  loading: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({ symbol, candles, loading }) => {
  const chartRef = useRef<any>(null);

  // Parse and sort candles chronologically (oldest to newest)
  const sortedCandles = [...candles].sort((a, b) => {
    const timeA = typeof a.startTime === 'string' ? new Date(a.startTime).getTime() : a.startTime;
    const timeB = typeof b.startTime === 'string' ? new Date(b.startTime).getTime() : b.startTime;
    return timeA - timeB;
  });

  const categoryData = sortedCandles.map((c) => {
    const date = typeof c.startTime === 'string' ? new Date(c.startTime) : new Date(c.startTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const values = sortedCandles.map((c) => [
    parseFloat(c.open.toString()),
    parseFloat(c.close.toString()),
    parseFloat(c.low.toString()),
    parseFloat(c.high.toString()),
  ]);

  const getOption = () => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: `${symbol} 1m OHLC Candlestick`,
        left: 20,
        top: 10,
        textStyle: {
          color: '#f8fafc',
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'Outfit, sans-serif',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#3b82f6',
            width: 1,
            type: 'dashed',
          },
        },
        backgroundColor: '#151b2a',
        borderColor: '#222d46',
        textStyle: {
          color: '#f8fafc',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
        },
        formatter: (params: any) => {
          const p = params[0];
          if (!p || !p.data) return '';
          
          // ECharts candlestick data index:
          // index 0: X axis (category name)
          // index 1: Open
          // index 2: Close
          // index 3: Low
          // index 4: High
          const dataIndex = p.dataIndex;
          const candle = sortedCandles[dataIndex];
          if (!candle) return '';

          const timeStr = typeof candle.startTime === 'string' 
            ? new Date(candle.startTime).toLocaleString() 
            : new Date(candle.startTime).toLocaleString();
          
          const open = parseFloat(candle.open.toString()).toFixed(2);
          const high = parseFloat(candle.high.toString()).toFixed(2);
          const low = parseFloat(candle.low.toString()).toFixed(2);
          const close = parseFloat(candle.close.toString()).toFixed(2);
          
          const diff = parseFloat(close) - parseFloat(open);
          const change = ((diff / parseFloat(open)) * 100).toFixed(2);
          const colorClass = diff >= 0 ? 'color: #10b981' : 'color: #ef4444';

          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${timeStr}</div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div>O: <span style="font-weight: 500">${open}</span></div>
              <div>H: <span style="font-weight: 500">${high}</span></div>
              <div>L: <span style="font-weight: 500">${low}</span></div>
              <div>C: <span style="font-weight: 500">${close}</span></div>
              <div style="${colorClass}; font-weight: 600;">Chg: ${diff >= 0 ? '+' : ''}${change}%</div>
            </div>
          `;
        },
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '15%',
        top: '15%',
      },
      xAxis: {
        type: 'category',
        data: categoryData,
        scale: true,
        boundaryGap: true,
        axisLine: { onZero: false, lineStyle: { color: '#222d46' } },
        splitLine: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontFamily: 'Outfit, sans-serif',
        },
      },
      yAxis: {
        scale: true,
        splitArea: {
          show: false,
        },
        axisLine: { lineStyle: { color: '#222d46' } },
        splitLine: {
          lineStyle: {
            color: 'rgba(34, 45, 70, 0.5)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: '#94a3b8',
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        },
      },
      dataZoom: [
        {
          type: 'inside',
          start: Math.max(0, 100 - (30 / Math.max(1, values.length)) * 100),
          end: 100,
        },
        {
          show: true,
          type: 'slider',
          top: '90%',
          start: Math.max(0, 100 - (30 / Math.max(1, values.length)) * 100),
          end: 100,
          backgroundColor: '#0f131e',
          borderColor: '#222d46',
          fillerColor: 'rgba(59, 130, 246, 0.15)',
          handleStyle: {
            color: '#3b82f6',
            borderColor: '#3b82f6',
          },
          textStyle: {
            color: '#94a3b8',
          },
        },
      ],
      series: [
        {
          name: 'Candlestick',
          type: 'candlestick',
          data: values,
          itemStyle: {
            color: '#10b981', // Up
            color0: '#ef4444', // Down
            borderColor: '#10b981',
            borderColor0: '#ef4444',
          },
        },
      ],
    };
  };

  useEffect(() => {
    // Resize chart when window changes
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.getEchartsInstance().resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      {loading && candles.length === 0 ? (
        <div className="spinner-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)' }}>Loading chart data...</p>
        </div>
      ) : candles.length === 0 ? (
        <div className="spinner-container">
          <p style={{ color: 'var(--text-muted)' }}>No historical data found for {symbol}</p>
        </div>
      ) : (
        <div className="chart-container">
          <ReactECharts
            ref={chartRef}
            option={getOption()}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        </div>
      )}
    </div>
  );
};
