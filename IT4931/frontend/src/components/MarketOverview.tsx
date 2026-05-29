import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { OhlcCandle } from '../services/api';

export interface TickerState {
  candle: OhlcCandle;
  prevClose: number;
  flash: 'up' | 'down' | null;
}

interface MarketOverviewProps {
  tickers: Record<string, TickerState>;
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  tickers,
  activeSymbol,
  onSelectSymbol,
}) => {
  const symbols = ['ADAUSDT'];

  const getTickerDetails = (symbol: string) => {
    const ticker = tickers[symbol];
    if (!ticker) {
      return {
        price: '---',
        changePercent: '0.00%',
        isUp: true,
        flashClass: '',
      };
    }

    const priceNum = parseFloat(ticker.candle.close.toString());
    const openNum = parseFloat(ticker.candle.open.toString());
    const priceFormatted = priceNum.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const diff = priceNum - openNum;
    const change = openNum > 0 ? (diff / openNum) * 100 : 0;
    const changeFormatted = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const isUp = change >= 0;

    let flashClass = '';
    if (ticker.flash === 'up') flashClass = 'tick-flash-up';
    if (ticker.flash === 'down') flashClass = 'tick-flash-down';

    return {
      price: priceFormatted,
      changePercent: changeFormatted,
      isUp,
      flashClass,
    };
  };

  return (
    <div className="card">
      <div className="card-title">
        <span>Active Markets</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to switch</span>
      </div>

      <div className="market-list">
        {symbols.map((symbol) => {
          const details = getTickerDetails(symbol);
          const isActive = symbol === activeSymbol;

          return (
            <div
              key={symbol}
              className={`market-item ${isActive ? 'active' : ''} ${details.flashClass}`}
              onClick={() => onSelectSymbol(symbol)}
            >
              <div>
                <div className="ticker-symbol">{symbol}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Binance Spot</div>
              </div>

              <div className="ticker-info">
                <div className={`ticker-price ${details.isUp ? 'price-up' : 'price-down'}`}>
                  ${details.price}
                </div>
                <div className={`ticker-change ${details.isUp ? 'price-up' : 'price-down'}`}>
                  {details.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>{details.changePercent}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
