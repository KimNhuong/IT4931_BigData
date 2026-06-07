import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  symbols: string[];
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ symbols, activeSymbol, onSelect }) => {
  return (
    <div className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] h-full flex flex-col">
      <div className="p-6 border-b border-[#1a1a1a]">
        <h1 className="text-xl font-bold tracking-tighter text-white uppercase italic">
          Nexus<span className="text-blue-500">Terminal</span>
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">
          Tracked Assets
        </div>
        {symbols.map((symbol) => (
          <button
            key={symbol}
            onClick={() => onSelect(symbol)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
              activeSymbol === symbol
                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            )}
          >
            {activeSymbol === symbol && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full" />
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium tracking-tight uppercase">
                {symbol}
              </span>
              <span className="text-[10px] opacity-50 font-mono italic">LIVE</span>
            </div>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="bg-[#1a1a1a] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">System Status</span>
          </div>
          <div className="text-[11px] text-gray-500 leading-tight">
            Node: binance-ingest-v1<br/>
            Region: ap-northeast-1
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
