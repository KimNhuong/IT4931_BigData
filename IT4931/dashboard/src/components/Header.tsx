import React, { useEffect, useState } from 'react';

interface HeaderProps {
  symbol: string;
  price: number | null;
  isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ symbol, price, isConnected }) => {
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price && prevPrice) {
      if (price > prevPrice) {
        setFlash('up');
      } else if (price < prevPrice) {
        setFlash('down');
      }
      const timer = setTimeout(() => setFlash(null), 1000);
      return () => clearTimeout(timer);
    }
    setPrevPrice(price);
  }, [price]);

  const formattedPrice = price 
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
    : '---';

  return (
    <header className="h-20 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between px-8">
      <div className="flex items-center gap-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{symbol}</h2>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isConnected ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-[0.2em]">Binance Spot Marketplace</p>
        </div>

        <div className="h-10 w-[1px] bg-[#1a1a1a]" />

        <div>
          <div className={`text-2xl font-mono font-bold transition-colors duration-300 ${
            flash === 'up' ? 'text-green-500' : flash === 'down' ? 'text-red-500' : 'text-white'
          }`}>
            {formattedPrice}
          </div>
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-[0.2em]">Current Window Price (USDT)</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Network latency</p>
          <p className="text-xs font-mono text-white">~12ms</p>
        </div>
        <div className="w-10 h-10 rounded-full border border-[#1a1a1a] flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-black">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        </div>
      </div>
    </header>
  );
};

export default Header;
