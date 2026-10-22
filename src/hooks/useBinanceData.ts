import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DirectionalState,
  createDirectionalState,
} from '../utils/directionalMovement';
import { DEFAULT_PAPER_STRATEGY_CONFIG, PaperStrategyConfig, PaperStrategyState } from '../utils/paperTrading';

interface ServerState {
  appStartTime: number;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  isConnected: boolean;
  lastUpdate: string;
  directionalState: DirectionalState;
  strategy: PaperStrategyState;
}

export function useBinanceData() {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [directionalState, setDirectionalState] = useState<DirectionalState>(createDirectionalState());
  const [isConnected, setIsConnected] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [appStartTime, setAppStartTime] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);
  const [strategy, setStrategy] = useState<PaperStrategyState>(() => ({
    running: false,
    config: DEFAULT_PAPER_STRATEGY_CONFIG,
    account: { initialCapital: DEFAULT_PAPER_STRATEGY_CONFIG.initialCapital, realizedPnl: 0, equity: DEFAULT_PAPER_STRATEGY_CONFIG.initialCapital, unrealizedPnl: 0 },
    position: null,
    journal: [],
    activeRunKey: null,
    ignoreRunKey: null,
    stoppedRunKey: null,
    lastMessage: 'Conectando con el servidor…',
  }));

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
      setIsServerConnected(true);
      console.log('✅ Conectado al servidor');
    };

    ws.onmessage = (event) => {
      try {
        const state: ServerState = JSON.parse(event.data);
        
        setCurrentPrice(state.currentPrice);
        setPriceChange24h(state.priceChange24h);
        setPriceChangePercent24h(state.priceChangePercent24h);
        setDirectionalState(state.directionalState);
        setStrategy(state.strategy);
        setAppStartTime(state.appStartTime);
        setLastUpdate(new Date(state.lastUpdate));
        setIsConnected(state.isConnected);
        
        // Mostrar la interfaz tras recibir el primer estado, incluso si Binance aún no entrega precios.
        setInitialized(true);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      setIsServerConnected(false);
      setIsConnected(false);
      console.log('❌ Desconectado del servidor, reconectando en 3s...');
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  }, []);

  // If the local server is unavailable, leave the endless spinner and show connection diagnostics.
  useEffect(() => {
    const timer = window.setTimeout(() => setInitialized(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

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

  const postStrategyAction = async (action: 'start' | 'stop' | 'reset', config?: PaperStrategyConfig) => {
    const response = await fetch(`/api/strategy/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: config ? JSON.stringify(config) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la estrategia.');
    return result;
  };

  return {
    currentPrice,
    priceChange24h,
    priceChangePercent24h,
    directionalState,
    isConnected,
    isServerConnected,
    lastUpdate,
    appStartTime,
    initialized,
    resetData,
    strategy,
    startStrategy: (config: PaperStrategyConfig) => postStrategyAction('start', config),
    stopStrategy: () => postStrategyAction('stop'),
    resetStrategy: () => postStrategyAction('reset'),
  };
}
