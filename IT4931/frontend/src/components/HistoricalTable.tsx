import React, { useState } from 'react';
import type { OhlcCandle } from '../services/api';
import { Calendar, ChevronLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';

interface HistoricalTableProps {
  candles: OhlcCandle[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onFilterChange: (from?: number, to?: number) => void;
}

export const HistoricalTable: React.FC<HistoricalTableProps> = ({
  candles,
  total,
  page,
  limit,
  onPageChange,
  onFilterChange,
}) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const totalPages = Math.ceil(total / limit);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const fromTimestamp = fromDate ? new Date(fromDate).getTime() : undefined;
    const toTimestamp = toDate ? new Date(toDate).getTime() : undefined;
    onFilterChange(fromTimestamp, toTimestamp);
  };

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
    onFilterChange(undefined, undefined);
  };

  const formatPrice = (val: string | number) => {
    const num = parseFloat(val.toString());
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (val: string | number) => {
    const date = typeof val === 'string' ? new Date(val) : new Date(val);
    return date.toLocaleString();
  };

  return (
    <div className="card historical-panel">
      <div className="panel-header">
        <span className="panel-title">Historical OHLC Records (Elasticsearch)</span>
        
        <form onSubmit={handleApplyFilter} className="filters">
          <div className="input-group">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <label htmlFor="from">From:</label>
            <input
              type="datetime-local"
              id="from"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <label htmlFor="to">To:</label>
            <input
              type="datetime-local"
              id="to"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Filter size={14} />
            Filter
          </button>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
        </form>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {candles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No historical records found.
                </td>
              </tr>
            ) : (
              candles.map((candle, idx) => {
                const o = parseFloat(candle.open.toString());
                const c = parseFloat(candle.close.toString());
                const diff = c - o;
                const change = o > 0 ? (diff / o) * 100 : 0;
                const isUp = change >= 0;

                return (
                  <tr key={idx}>
                    <td>{formatDate(candle.startTime)}</td>
                    <td>{formatDate(candle.endTime)}</td>
                    <td>${formatPrice(candle.open)}</td>
                    <td className="price-up">${formatPrice(candle.high)}</td>
                    <td className="price-down">${formatPrice(candle.low)}</td>
                    <td className={isUp ? 'price-up' : 'price-down'}>${formatPrice(candle.close)}</td>
                    <td className={isUp ? 'price-up' : 'price-down'}>
                      {isUp ? '+' : ''}
                      {change.toFixed(2)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div>
          Showing {candles.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
          {Math.min(page * limit, total)} of {total} records
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="btn btn-secondary"
              style={{ padding: '4px 8px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="btn btn-secondary"
              style={{ padding: '4px 8px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
