import React, { useEffect, useState, useRef } from 'react';
import type { LiveCandleDTO, LiveTickDTO } from '../types/candle';
import { formatPrice, formatCompactNumber } from '../utils/format';

interface MetricsProps {
  candle: LiveCandleDTO | null;
  tick: LiveTickDTO | null;
  isLoading?: boolean;
}

const Metrics: React.FC<MetricsProps> = ({ candle, tick, isLoading }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const currentPrice = tick?.price || candle?.close;
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentPrice !== undefined && prevPriceRef.current !== null) {
      if (currentPrice > prevPriceRef.current) {
        setFlash('up');
      } else if (currentPrice < prevPriceRef.current) {
        setFlash('down');
      }
      
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
    if (currentPrice !== undefined) {
      prevPriceRef.current = currentPrice;
    }
  }, [currentPrice]);

  const priceColor = flash === 'up' ? 'text-emerald-500' : flash === 'down' ? 'text-rose-500' : 'text-white';

  const items = [
    { label: 'Live Price', value: formatPrice(currentPrice), color: priceColor },
    { label: 'High (1m)', value: formatPrice(candle?.high), color: 'text-emerald-500' },
    { label: 'Low (1m)', value: formatPrice(candle?.low), color: 'text-rose-500' },
    { label: 'VWAP', value: formatPrice(candle?.vwap), color: 'text-amber-500' },
    { label: 'Volume', value: candle?.volume ? formatCompactNumber(candle.volume) : '---', color: 'text-blue-500' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 bg-black/40 backdrop-blur-md p-6 border-b border-[#1a1a1a]">
      {items.map((item) => (
        <div key={item.label} className="group cursor-default relative overflow-hidden">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 group-hover:text-gray-400 transition-colors">
            {item.label}
          </p>
          
          {isLoading ? (
            <div className="h-7 w-24 bg-white/5 rounded-md animate-pulse mt-1" />
          ) : (
            <p className={`text-lg font-mono font-bold tabular-nums transition-colors duration-300 ${item.color}`}>
              {item.value}
            </p>
          )}
          
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
        </div>
      ))}
    </div>
  );
};

export default Metrics;
