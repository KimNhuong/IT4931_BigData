import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import type { LiveCandleDTO } from '../types/candle';

interface LiveChartProps {
  symbol: string;
  latestCandle: LiveCandleDTO | null;
  historicalData: LiveCandleDTO[];
  isLoading: boolean;
}

const LiveChart: React.FC<LiveChartProps> = ({ symbol, latestCandle, historicalData, isLoading }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#555',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#3b82f6', labelBackgroundColor: '#3b82f6' },
        horzLine: { color: '#3b82f6', labelBackgroundColor: '#3b82f6' },
      },
      timeScale: {
        borderColor: '#1a1a1a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1a1a1a',
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Handle historical data hydration
  useEffect(() => {
    if (candleSeriesRef.current && historicalData.length > 0) {
      const formattedData = historicalData.map(item => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000) as Time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));
      candleSeriesRef.current.setData(formattedData);
    } else if (candleSeriesRef.current) {
        candleSeriesRef.current.setData([]);
    }
  }, [historicalData]);

  // Handle incoming live data
  useEffect(() => {
    if (latestCandle && candleSeriesRef.current) {
      const time = Math.floor(new Date(latestCandle.timestamp).getTime() / 1000) as Time;
      
      const update = {
        time,
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
      };

      candleSeriesRef.current.update(update);
    }
  }, [latestCandle]);

  return (
    <div className="w-full h-full relative group">
      {/* Loading Overlay / Shimmer */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest animate-pulse">Hydrating Chart...</span>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
          <span className="text-white font-black text-xs tracking-widest uppercase">{symbol} 1M</span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveChart;
