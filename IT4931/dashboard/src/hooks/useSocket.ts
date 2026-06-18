import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { LiveCandleDTO, LiveTickDTO } from '../types/candle';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export const useSocket = (symbol: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [latestCandle, setLatestCandle] = useState<LiveCandleDTO | null>(null);
  const [latestTick, setLatestTick] = useState<LiveTickDTO | null>(null);
  const [historicalData, setHistoricalData] = useState<LiveCandleDTO[]>([]);
  const [whaleAlerts, setWhaleAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchHistoricalData = async (targetSymbol: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/ohlc-live/${targetSymbol}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const connectSocket = () => {
    if (socketRef.current) return;
    
    setIsConnecting(true);
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      setIsConnecting(false);
      socket.emit('joinSymbol', symbol);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnecting(false);
      setIsConnected(false);
    });

    socket.on('candle-update', (data: LiveCandleDTO) => {
      setLatestCandle(data);
    });

    socket.on('tick-update', (data: LiveTickDTO) => {
      setLatestTick(data);
    });

    socket.on('whale-alert', (data: any) => {
      setWhaleAlerts((prev) => [data, ...prev].slice(0, 50));
    });
  };

  useEffect(() => {
    fetchHistoricalData(symbol);
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (socketRef.current && isConnected) {
      console.log(`Switching to symbol: ${symbol}`);
      fetchHistoricalData(symbol);
      socketRef.current.emit('joinSymbol', symbol);
      setLatestTick(null);
      setLatestCandle(null);
    }
  }, [symbol, isConnected]);

  return { latestCandle, latestTick, historicalData, whaleAlerts, isConnected, isLoading, isConnecting, connectSocket };
};
