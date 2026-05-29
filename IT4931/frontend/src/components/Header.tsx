import React from 'react';
import { Activity, Radio, RefreshCw } from 'lucide-react';

interface HeaderProps {
  wsConnected: boolean;
  isConnecting: boolean;
  onReconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({ wsConnected, isConnecting, onReconnect }) => {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          <div>
            <h1 className="brand-title" style={{ fontSize: '20px', margin: 0, padding: 0 }}>
              Binance Big Data Platform
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Real-time Processing & Storage Dashboard
            </p>
          </div>
          <span className="brand-tag">Nest.js + Kafka + ES</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className={`status-indicator`}>
            <span className={`dot ${wsConnected ? 'up' : 'down'}`} />
            <span style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={14} className={wsConnected ? 'price-up' : 'price-down'} />
              Live Socket: {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {!wsConnected && (
            <button
              onClick={onReconnect}
              disabled={isConnecting}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <RefreshCw size={12} className={isConnecting ? 'spinner' : ''} />
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
