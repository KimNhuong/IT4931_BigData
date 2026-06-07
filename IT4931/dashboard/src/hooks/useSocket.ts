import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { LiveCandleDTO } from '../types/candle';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export const useSocket = (symbol: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [latestCandle, setLatestCandle] = useState<LiveCandleDTO | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      socket.emit('joinSymbol', symbol);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    socket.on('candle-update', (data: LiveCandleDTO) => {
      setLatestCandle(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socketRef.current && isConnected) {
      console.log(`Switching to symbol: ${symbol}`);
      socketRef.current.emit('joinSymbol', symbol);
    }
  }, [symbol, isConnected]);

  return { latestCandle, isConnected };
};
