interface PriceHeaderProps {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  isConnected: boolean;
  lastUpdate: Date;
}

export default function PriceHeader({
  currentPrice,
  priceChange24h,
  priceChangePercent24h,
  isConnected,
  lastUpdate,
}: PriceHeaderProps) {
  const isPositive = priceChange24h >= 0;

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
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{isConnected ? 'En vivo (actualización cada 1s)' : 'Desconectado'}</span>
        </div>
        <div>
          Última actualización: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
