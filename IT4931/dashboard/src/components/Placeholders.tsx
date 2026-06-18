import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { format, addDays } from 'date-fns';
import { formatCurrency } from '../utils/format';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PlaceholderCard: React.FC<{ title: string; badge?: string }> = ({ title, badge = "Coming Soon" }) => (
  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-tighter">
        {badge}
      </span>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-3/4 bg-[#1a1a1a] rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-[#1a1a1a] rounded animate-pulse opacity-50" />
      <div className="h-20 w-full border border-dashed border-[#1a1a1a] rounded-lg flex items-center justify-center">
        <span className="text-[10px] text-gray-600 font-mono italic">awaiting_data_stream...</span>
      </div>
    </div>
  </div>
);

const BacktestPanel: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strategy, setStrategy] = useState('MA Crossover');
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'DONE' | 'FAILED'>('IDLE');
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('backtest-finished', (data: any) => {
      console.log('Backtest finished:', data);
      if (data.status === 'DONE') {
        setMetrics(data.metrics);
        setStatus('DONE');
      } else {
        setStatus('FAILED');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const runBacktest = async () => {
    setStatus('PENDING');
    setMetrics(null);
    try {
      const res = await fetch(`${API_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy, timeRange: '2024-2026' }),
      });
      if (!res.ok) throw new Error('Network response was not ok');
    } catch (err) {
      console.error(err);
      setStatus('FAILED');
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Backtest Engine</h3>
        <span className="text-[8px] font-black bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase tracking-tighter">
          Premium
        </span>
      </div>

      <div className="space-y-4 text-sm flex-1">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase mb-1">Symbol</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full bg-black border border-[#1a1a1a] text-white p-2 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="ETHUSDT">ETHUSDT</option>
            <option value="SOLUSDT">SOLUSDT</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase mb-1">Strategy</label>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
            className="w-full bg-black border border-[#1a1a1a] text-white p-2 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="MA Crossover">MA Crossover</option>
            <option value="RSI Divergence">RSI Divergence</option>
          </select>
        </div>

        {status === 'PENDING' && (
          <div className="text-center text-blue-500 text-xs animate-pulse py-2">
            Running distributed backtest...
          </div>
        )}

        {status === 'DONE' && metrics && (
          <div className="bg-black/50 p-3 rounded border border-[#1a1a1a] space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-500 uppercase">Total Profit</span>
              <span className={`font-mono text-xs ${metrics.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(metrics.totalProfit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-500 uppercase">RMSE (MLlib)</span>
              <span className="font-mono text-xs text-amber-500">{metrics.rmse?.toFixed(2) || 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={runBacktest}
        disabled={status === 'PENDING'}
        className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest py-2 rounded transition-colors"
      >
        {status === 'PENDING' ? 'Processing...' : 'Run Backtest'}
      </button>
    </div>
  );
};

const WhaleAlerts: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Whale Alerts</h3>
        <span className="text-[8px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-tighter">
          Live Stream
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[250px]">
        {alerts.length === 0 ? (
          <div className="h-full flex items-center justify-center border border-dashed border-[#1a1a1a] rounded-lg">
            <span className="text-[10px] text-gray-600 font-mono italic">waiting_for_whales...</span>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div key={idx} className="bg-black/50 p-2 border border-[#1a1a1a] rounded text-[11px] animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-1">
                <span className="text-amber-500 font-bold">🐳 WHALE ALERT</span>
                <span className="text-gray-600 text-[9px]">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-gray-300">
                <span className={alert.isMaker ? "text-red-400" : "text-green-400"}>
                  {alert.isMaker ? "SELL" : "BUY"}
                </span> {alert.volume.toFixed(4)} {alert.symbol.replace('USDT', '')}
              </div>
              <div className="text-gray-500 font-mono text-[10px]">
                Total: {formatCurrency(alert.price * alert.volume)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface PlaceholdersProps {
  whaleAlerts?: any[];
}

const HydrationPanel: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [startDate, setStartDate] = useState(format(addDays(new Date(), -1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), -1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  const startHydration = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/binance/hydrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, startDate, endDate }),
      });
      alert('Hydration started in background! Check terminal/logs for progress.');
    } catch (err) {
      console.error(err);
      alert('Failed to start hydration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data Hydration</h3>
        <span className="text-[8px] font-black bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-tighter">
          Zero-Disk ETL
        </span>
      </div>

      <div className="space-y-4 text-sm flex-1">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase mb-1">Symbol</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full bg-black border border-[#1a1a1a] text-white p-2 rounded text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="ETHUSDT">ETHUSDT</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-black border border-[#1a1a1a] text-white p-1 rounded text-[10px] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-black border border-[#1a1a1a] text-white p-1 rounded text-[10px] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <button
        onClick={startHydration}
        disabled={loading}
        className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded transition-colors"
      >
        {loading ? 'Starting...' : 'Hydrate History'}
      </button>
    </div>
  );
};

const Placeholders: React.FC<PlaceholdersProps> = ({ whaleAlerts = [] }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-[#050505]">
      <HydrationPanel />
      <WhaleAlerts alerts={whaleAlerts} />
      <BacktestPanel />
    </div>
  );
};

export default Placeholders;
