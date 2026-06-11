export interface LiveCandleDTO {
  symbol: string;
  timestamp: string; // ISO string or timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export interface LiveTickDTO {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  tradeId: number;
  isMaker: boolean;
}

export interface CandleData {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}
