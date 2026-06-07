import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { CandleData, LiveCandleDTO } from '../types/candle';

interface LiveChartProps {
  symbol: string;
  latestCandle: LiveCandleDTO | null;
}

const LiveChart: React.FC<LiveChartProps> = ({ symbol, latestCandle }) => {
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

    const candleSeries = chart.addCandlestickSeries({
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

  // Handle symbol change - clear data
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
  }, [symbol]);

  // Handle incoming data
  useEffect(() => {
    if (latestCandle && candleSeriesRef.current) {
      const time = Math.floor(new Date(latestCandle.timestamp).getTime() / 1000);
      
      const update: CandleData = {
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
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
          <span className="text-white font-black text-xs tracking-widest uppercase">{symbol} 1M</span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveChart;
