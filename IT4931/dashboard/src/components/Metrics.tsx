import React from 'react';
import type { LiveCandleDTO } from '../types/candle';
import { formatPrice, formatCompactNumber } from '../utils/format';

interface MetricsProps {
  data: LiveCandleDTO | null;
  isLoading?: boolean;
}

const Metrics: React.FC<MetricsProps> = ({ data, isLoading }) => {
  const items = [
    { label: 'Open', value: formatPrice(data?.open), color: 'text-white' },
    { label: 'High', value: formatPrice(data?.high), color: 'text-emerald-500' },
    { label: 'Low', value: formatPrice(data?.low), color: 'text-rose-500' },
    { label: 'Close', value: formatPrice(data?.close), color: 'text-white' },
    { label: 'Volume', value: data?.volume ? formatCompactNumber(data.volume) : '---', color: 'text-blue-500' },
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
            <p className={`text-lg font-mono font-bold tabular-nums ${item.color}`}>
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
