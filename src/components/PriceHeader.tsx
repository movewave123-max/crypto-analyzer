import { useEffect, useState } from 'react';

interface PriceHeaderProps {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  isConnected: boolean;
  isServerConnected: boolean;
  lastUpdate: Date;
}

export default function PriceHeader({
  currentPrice,
  priceChange24h,
  priceChangePercent24h,
  isConnected,
  isServerConnected,
  lastUpdate,
}: PriceHeaderProps) {
  const isPositive = priceChange24h >= 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const ageSeconds = Math.max(0, Math.floor((now - lastUpdate.getTime()) / 1000));
  const feedIsFresh = isServerConnected && isConnected && Number.isFinite(ageSeconds) && ageSeconds < 10;
  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">ETH/USDT</h1>
          <p className="text-sm text-gray-400">Binance Futures</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-white">
            ${currentPrice.toFixed(2)}
          </div>
          <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{priceChange24h.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent24h.toFixed(2)}%)
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2" role="status" aria-label={isServerConnected ? 'Servidor activo' : 'Servidor inactivo'}>
            <div className={`h-2 w-2 rounded-full ${isServerConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={isServerConnected ? 'text-green-400' : 'text-red-400'}>{isServerConnected ? 'Servidor activo' : 'Servidor inactivo'}</span>
          </div>
          <div className="flex items-center gap-2" role="status" aria-label={feedIsFresh ? 'Binance en vivo' : isConnected ? 'Binance sin datos recientes' : 'Binance desconectado'}>
            <div className={`h-2 w-2 rounded-full ${feedIsFresh ? 'bg-green-500' : isServerConnected ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <span className={feedIsFresh ? 'text-green-400' : isServerConnected ? 'text-yellow-400' : 'text-red-400'}>
              {feedIsFresh ? 'Binance en vivo' : isConnected ? `Binance sin datos recientes${ageSeconds >= 10 ? ` · último dato hace ${ageSeconds}s` : ''}` : 'Binance desconectado'}
            </span>
          </div>
        </div>
        <div>
          {lastUpdate.getTime() > 0 ? `Último precio: ${lastUpdate.toLocaleTimeString()}` : 'Esperando primer precio'}
        </div>
      </div>
      {!feedIsFresh && (
        <p className="mt-3 text-xs text-yellow-300" role="status">
          El precio puede estar desactualizado. Comprueba la conexión a internet y el servidor local.
        </p>
      )}
    </div>
  );
}
