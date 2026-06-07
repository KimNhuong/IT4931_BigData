import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LiveChart from './components/LiveChart';
import Metrics from './components/Metrics';
import Placeholders from './components/Placeholders';
import { useSocket } from './hooks/useSocket';

const TRACKED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

function App() {
  const [activeSymbol, setActiveSymbol] = useState(TRACKED_SYMBOLS[0]);
  const { latestCandle, isConnected } = useSocket(activeSymbol);

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      <Sidebar 
        symbols={TRACKED_SYMBOLS} 
        activeSymbol={activeSymbol} 
        onSelect={setActiveSymbol} 
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Header 
          symbol={activeSymbol} 
          price={latestCandle?.close || null} 
          isConnected={isConnected} 
        />
        
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <Metrics data={latestCandle} />
          
          <div className="p-8">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/5">
              <div className="h-[500px]">
                <LiveChart symbol={activeSymbol} latestCandle={latestCandle} />
              </div>
            </div>
          </div>

          <Placeholders />

          <footer className="p-8 border-t border-[#1a1a1a] bg-[#050505] flex justify-between items-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            <div>Nexus Terminal Dashboard © 2026</div>
            <div className="flex gap-4">
              <span>Latency: 12ms</span>
              <span className="text-green-500/50 italic">System Operational</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
