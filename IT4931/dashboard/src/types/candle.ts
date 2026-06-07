export interface LiveCandleDTO {
  symbol: string;
  timestamp: string; // ISO string or timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleData {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}
