import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MarketOverview, type TickerState } from './components/MarketOverview';
import { CandlestickChart } from './components/CandlestickChart';
import { HistoricalTable } from './components/HistoricalTable';
import { HealthStatus } from './components/HealthStatus';
import {
  getHistoricalCandles,
  getSocket,
  subscribeToSymbol,
  unsubscribeFromSymbol,
  type OhlcCandle,
} from './services/api';
import { AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2 } from 'lucide-react';

function App() {
  const [activeSymbol, setActiveSymbol] = useState<string>('ADAUSDT');
  const [tickers, setTickers] = useState<Record<string, TickerState>>({});
  const [historicalCandles, setHistoricalCandles] = useState<OhlcCandle[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);

  // Filters
  const [fromTime, setFromTime] = useState<number | undefined>(undefined);
  const [toTime, setToTime] = useState<number | undefined>(undefined);

  // Status
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Establish WebSocket connection
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setWsConnected(true);
      setIsConnecting(false);
      setError(null);
      // Subscribe to active symbol on connect/reconnect
      subscribeToSymbol(activeSymbol);
    };

    const handleDisconnect = () => {
      setWsConnected(false);
    };

    const handleConnectError = () => {
      setIsConnecting(false);
      setWsConnected(false);
    };

    // Live candle from specific symbol subscription room
    const handleLiveCandle = (candle: OhlcCandle) => {
      if (candle.symbol.toUpperCase() === activeSymbol.toUpperCase()) {
        setHistoricalCandles((prev) => {
          const next = [...prev];
          const matchIndex = next.findIndex(
            (c) => c.startTime === candle.startTime
          );
          if (matchIndex >= 0) {
            next[matchIndex] = candle;
          } else {
            next.unshift(candle);
          }
          return next;
        });
      }
    };

    // Global update event for all symbols to update sidebar tickers
    const handleAllCandles = (candle: OhlcCandle) => {
      setTickers((prev) => {
        const symbol = candle.symbol.toUpperCase();
        const prevTicker = prev[symbol];
        const prevClose = prevTicker ? parseFloat(prevTicker.candle.close.toString()) : 0;
        const newClose = parseFloat(candle.close.toString());

        let flash: 'up' | 'down' | null = null;
        if (prevClose > 0) {
          if (newClose > prevClose) flash = 'up';
          else if (newClose < prevClose) flash = 'down';
        }

        return {
          ...prev,
          [symbol]: {
            candle,
            prevClose: prevClose || newClose,
            flash,
          },
        };
      });

      // Clear the flash status after 800ms so it doesn't flash infinitely
      setTimeout(() => {
        setTickers((prev) => {
          const symbol = candle.symbol.toUpperCase();
          if (!prev[symbol] || prev[symbol].flash === null) return prev;
          return {
            ...prev,
            [symbol]: {
              ...prev[symbol],
              flash: null,
            },
          };
        });
      }, 800);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('candle.live', handleLiveCandle);
    socket.on('candle.all', handleAllCandles);

    // Initial trigger if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('candle.live', handleLiveCandle);
      socket.off('candle.all', handleAllCandles);
    };
  }, [activeSymbol]);

  // Handle symbol change
  const handleSelectSymbol = (symbol: string) => {
    if (symbol === activeSymbol) return;

    // Unsubscribe old, subscribe new
    unsubscribeFromSymbol(activeSymbol);
    setActiveSymbol(symbol);
    subscribeToSymbol(symbol);

    // Reset pagination and filters
    setPage(1);
    setFromTime(undefined);
    setToTime(undefined);
  };

  // Fetch historical data
  useEffect(() => {
    const loadHistorical = async () => {
      setLoading(true);
      try {
        const response = await getHistoricalCandles(activeSymbol, page, limit, fromTime, toTime);
        setHistoricalCandles(response.data);
        setTotalRecords(response.total);
        setError(null);
      } catch (err: any) {
        setError('Failed to fetch historical candles from Elasticsearch.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadHistorical();
  }, [activeSymbol, page, limit, fromTime, toTime]);

  const handleReconnect = () => {
    setIsConnecting(true);
    const socket = getSocket();
    socket.connect();
  };

  const handleFilterChange = (from?: number, to?: number) => {
    setFromTime(from);
    setToTime(to);
    setPage(1);
  };

  // Format pricing values
  const getStats = () => {
    const activeTicker = tickers[activeSymbol];
    if (!activeTicker) {
      return {
        open: '---',
        high: '---',
        low: '---',
        close: '---',
        change: '0.00%',
        isUp: true,
      };
    }

    const o = parseFloat(activeTicker.candle.open.toString());
    const h = parseFloat(activeTicker.candle.high.toString());
    const l = parseFloat(activeTicker.candle.low.toString());
    const c = parseFloat(activeTicker.candle.close.toString());
    const diff = c - o;
    const change = o > 0 ? (diff / o) * 100 : 0;

    return {
      open: o.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      high: h.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      low: l.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      close: c.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
      isUp: change >= 0,
    };
  };

  const stats = getStats();

  return (
    <div className="app-container">
      <Header
        wsConnected={wsConnected}
        isConnecting={isConnecting}
        onReconnect={handleReconnect}
      />

      <main className="main-content">
        {error && (
          <div className="error-container">
            <AlertCircle size={24} />
            <h3 style={{ fontWeight: 600 }}>Connection Error</h3>
            <p style={{ fontSize: '14px', maxWidth: '500px' }}>{error}</p>
            <button
              onClick={() => {
                setPage(1);
                setFromTime(undefined);
                setToTime(undefined);
                setActiveSymbol(activeSymbol); // trigger refetch
              }}
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
            >
              <RefreshCw size={14} />
              Retry Fetching
            </button>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="sidebar-panel">
            <MarketOverview
              tickers={tickers}
              activeSymbol={activeSymbol}
              onSelectSymbol={handleSelectSymbol}
            />

            <HealthStatus />
          </div>

          <div className="display-panel">
            {/* Stats Summary Bar */}
            <div className="stats-row">
              <div className="stat-box">
                <span className="stat-label">Last Price</span>
                <span className={`stat-value ${stats.isUp ? 'price-up' : 'price-down'}`}>
                  ${stats.close}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">24h Change</span>
                <span className={`stat-value ${stats.isUp ? 'price-up' : 'price-down'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {stats.isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {stats.change}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Open Price</span>
                <span className="stat-value">${stats.open}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">High</span>
                <span className="stat-value price-up">${stats.high}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Low</span>
                <span className="stat-value price-down">${stats.low}</span>
              </div>
            </div>

            {/* Candlestick Chart */}
            <CandlestickChart
              symbol={activeSymbol}
              candles={historicalCandles}
              loading={loading}
            />

            {/* Historical Log list */}
            <HistoricalTable
              candles={historicalCandles}
              total={totalRecords}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <BarChart2 size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>IT4931 Big Data Analytics Project</span>
        </div>
        <p>© 2026 - Real-time Binance Tick Data Stream Processor & Visualizer.</p>
      </footer>
    </div>
  );
}

export default App;
