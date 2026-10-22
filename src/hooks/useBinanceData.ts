import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DirectionalState,
  createDirectionalState,
} from '../utils/directionalMovement';

interface ServerState {
  appStartTime: number;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  isConnected: boolean;
  lastUpdate: string;
  directionalState: DirectionalState;
}

export function useBinanceData() {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [directionalState, setDirectionalState] = useState<DirectionalState>(createDirectionalState());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [appStartTime, setAppStartTime] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Connect to server WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Conectado al servidor');
    };

    ws.onmessage = (event) => {
      try {
        const state: ServerState = JSON.parse(event.data);
        
        setCurrentPrice(state.currentPrice);
        setPriceChange24h(state.priceChange24h);
        setPriceChangePercent24h(state.priceChangePercent24h);
        setDirectionalState(state.directionalState);
        setAppStartTime(state.appStartTime);
        setLastUpdate(new Date(state.lastUpdate));
        setIsConnected(state.isConnected);
        
        if (!initialized && state.currentPrice > 0) {
          setInitialized(true);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('❌ Desconectado del servidor, reconectando en 3s...');
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  }, [initialized]);

  // Initialize connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Reset function
  const resetData = async () => {
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        console.log('✅ Datos reseteados en el servidor');
      }
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  };

  return {
    currentPrice,
    priceChange24h,
    priceChangePercent24h,
    directionalState,
    isConnected,
    lastUpdate,
    appStartTime,
    initialized,
    resetData,
  };
}
