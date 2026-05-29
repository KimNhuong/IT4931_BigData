import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface OhlcCandle {
  symbol: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  startTime: string | number;
  endTime: string | number;
  '@timestamp'?: string;
}

export interface HistoricalResponse {
  data: OhlcCandle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  services: {
    elasticsearch: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

// REST API functions
export async function getHistoricalCandles(
  symbol: string,
  page = 1,
  limit = 100,
  from?: number,
  to?: number
): Promise<HistoricalResponse> {
  const url = new URL(`${API_BASE_URL}/elastic-search/historical/${symbol.toUpperCase()}`);
  url.searchParams.append('page', page.toString());
  url.searchParams.append('limit', limit.toString());
  if (from) url.searchParams.append('from', from.toString());
  if (to) url.searchParams.append('to', to.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch historical candles: ${res.statusText}`);
  }
  return res.json();
}

export async function getSystemHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok && res.status !== 503) {
    throw new Error(`Failed to check system health: ${res.statusText}`);
  }
  return res.json();
}

// WebSocket setup
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

export function subscribeToSymbol(symbol: string): void {
  const s = getSocket();
  s.emit('subscribe', symbol.toUpperCase());
}

export function unsubscribeFromSymbol(symbol: string): void {
  const s = getSocket();
  s.emit('unsubscribe', symbol.toUpperCase());
}
