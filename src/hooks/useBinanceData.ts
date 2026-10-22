import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DirectionalState,
  createDirectionalState,
  updateDirectionalState,
} from '../utils/directionalMovement';

const BINANCE_FAPI = 'https://fapi.binance.com/fapi/v1';
const STORAGE_KEY = 'directional-movement-data';

export function useBinanceData() {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [directionalState, setDirectionalState] = useState<DirectionalState>(createDirectionalState(0.4));
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [appStartTime, setAppStartTime] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  const directionalStateRef = useRef<DirectionalState>(directionalState);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const priceRef = useRef<number>(0);

  // Load persisted data from localStorage
  const loadPersistedData = useCallback((): DirectionalState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return null;
    }
  }, []);

  // Save data to localStorage
  const savePersistedData = useCallback((state: DirectionalState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving persisted data:', error);
    }
  }, []);

  // Process new price
  const processPrice = useCallback((price: number) => {
    if (price <= 0) return;

    const now = Date.now();
    priceRef.current = price;
    setCurrentPrice(price);
    setLastUpdate(new Date());
    setIsConnected(true);

    // Update directional state
    const updatedState = updateDirectionalState(directionalStateRef.current, price, now);
    directionalStateRef.current = updatedState;
    setDirectionalState(updatedState);

    // Save to localStorage
    savePersistedData(updatedState);
  }, [savePersistedData]);

  // Fetch price from Binance REST API
  const fetchPrice = useCallback(async () => {
    try {
      const response = await fetch(`${BINANCE_FAPI}/ticker/price?symbol=ETHUSDT`);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      const price = parseFloat(data.price);
      processPrice(price);
    } catch (error) {
      console.error('Error fetching price:', error);
      setIsConnected(false);
    }
  }, [processPrice]);

  // Fetch 24h ticker data
  const fetch24hTicker = useCallback(async () => {
    try {
      const response = await fetch(`${BINANCE_FAPI}/ticker/24hr?symbol=ETHUSDT`);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setPriceChange24h(parseFloat(data.priceChange));
      setPriceChangePercent24h(parseFloat(data.priceChangePercent));
    } catch (error) {
      console.error('Error fetching 24h ticker:', error);
    }
  }, []);

  // Initialize the app
  useEffect(() => {
    const init = async () => {
      // Try to load persisted data
      const persisted = loadPersistedData();
      
      if (persisted) {
        directionalStateRef.current = persisted;
        setDirectionalState(persisted);
      }

      // Fetch initial price
      try {
        const response = await fetch(`${BINANCE_FAPI}/ticker/price?symbol=ETHUSDT`);
        const data = await response.json();
        const price = parseFloat(data.price);
        
        if (price > 0) {
          const now = Date.now();
          setAppStartTime(now);
          priceRef.current = price;
          setCurrentPrice(price);
          setLastUpdate(new Date());
          setIsConnected(true);

          // Initialize directional state if not loaded from storage
          if (!persisted) {
            const initialState = createDirectionalState(0.4);
            const updatedState = updateDirectionalState(initialState, price, now);
            directionalStateRef.current = updatedState;
            setDirectionalState(updatedState);
            savePersistedData(updatedState);
          }

          setInitialized(true);

          // Fetch 24h ticker
          fetch24hTicker();
        }
      } catch (error) {
        console.error('Error initializing:', error);
      }
    };

    init();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetch24hTicker, loadPersistedData, savePersistedData]);

  // Start polling after initialization
  useEffect(() => {
    if (!initialized) return;

    // Poll price every 1 second
    pollIntervalRef.current = setInterval(() => {
      fetchPrice();
    }, 1000);

    // Update 24h ticker every 30 seconds
    const tickerInterval = setInterval(() => {
      fetch24hTicker();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearInterval(tickerInterval);
    };
  }, [initialized, fetchPrice, fetch24hTicker]);

  // Reset function
  const resetData = async () => {
    const now = Date.now();
    const price = priceRef.current;
    
    const newState = createDirectionalState(0.4);
    if (price > 0) {
      const updatedState = updateDirectionalState(newState, price, now);
      directionalStateRef.current = updatedState;
      setDirectionalState(updatedState);
      savePersistedData(updatedState);
    } else {
      directionalStateRef.current = newState;
      setDirectionalState(newState);
      savePersistedData(newState);
    }
    
    setAppStartTime(now);
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
