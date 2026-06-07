import React from 'react';
import { LiveCandleDTO } from '../types/candle';

interface MetricsProps {
  data: LiveCandleDTO | null;
}

const Metrics: React.FC<MetricsProps> = ({ data }) => {
  const formatNum = (num: number | undefined) => 
    num !== undefined 
      ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) 
      : '---';

  const formatVol = (num: number | undefined) => 
    num !== undefined 
      ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num) 
      : '---';

  const items = [
    { label: 'Open', value: formatNum(data?.open), color: 'text-white' },
    { label: 'High', value: formatNum(data?.high), color: 'text-green-500' },
    { label: 'Low', value: formatNum(data?.low), color: 'text-red-500' },
    { label: 'Close', value: formatNum(data?.close), color: 'text-white' },
    { label: 'Volume', value: formatVol(data?.volume), color: 'text-blue-500' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 bg-[#0a0a0a] p-6 border-b border-[#1a1a1a]">
      {items.map((item) => (
        <div key={item.label} className="group cursor-default">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 group-hover:text-gray-400 transition-colors">
            {item.label}
          </p>
          <p className={`text-lg font-mono font-bold ${item.color}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default Metrics;
