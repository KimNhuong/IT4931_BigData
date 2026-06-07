import React, { useEffect, useState, useRef } from 'react';
import { formatPrice } from '../utils/format';

interface HeaderProps {
  symbol: string;
  price: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  onRetry: () => void;
}

const Header: React.FC<HeaderProps> = ({ symbol, price, isConnected, isConnecting, onRetry }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (price !== null && prevPriceRef.current !== null) {
      if (price > prevPriceRef.current) {
        setFlash('up');
      } else if (price < prevPriceRef.current) {
        setFlash('down');
      }
      
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <header className="h-20 border-b border-[#1a1a1a] bg-black/50 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
            {symbol}
            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 tracking-widest font-bold">LIVE</span>
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold tracking-widest uppercase">
            <span>Binance Spot</span>
            <span>•</span>
            <span>1m Interval</span>
          </div>
        </div>

        <div className={`px-4 py-2 rounded-xl transition-all duration-300 border ${
          flash === 'up' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
          flash === 'down' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
          'bg-white/5 border-white/5 text-white'
        }`}>
          <span className="text-2xl font-mono font-bold tabular-nums">
            {formatPrice(price)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Connection Status</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${
              isConnected ? 'text-emerald-500' : isConnecting ? 'text-amber-500' : 'text-rose-500'
            }`}>
              {isConnected ? 'Stable' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div className="relative flex h-3 w-3">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              isConnected ? 'bg-emerald-500' : isConnecting ? 'bg-amber-500' : 'bg-rose-500'
            }`}></span>
          </div>
        </div>

        {!isConnected && !isConnecting && (
          <button 
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
          >
            Retry Connection
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
