import { useState } from 'react';
import { useBinanceData } from './hooks/useBinanceData';
import PriceHeader from './components/PriceHeader';
import DirectionalDisplay from './components/DirectionalDisplay';
import { formatDuration } from './utils/directionalMovement';

export default function App() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const {
    currentPrice,
    priceChange24h,
    priceChangePercent24h,
    directionalState,
    isConnected,
    lastUpdate,
    appStartTime,
    initialized,
    resetData,
  } = useBinanceData();

  const handleReset = async () => {
    await resetData();
    setShowResetConfirm(false);
  };

  const elapsedSinceStart = appStartTime > 0 ? Date.now() - appStartTime : 0;

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Conectando con Binance Futures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black"></div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* Title */}
        <div className="text-center mb-2">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Análisis de Movimiento Direccional
          </h1>
          <p className="text-sm text-gray-500 mt-1">ETHUSDT Perpetual • Binance Futures</p>
          {appStartTime > 0 && (
            <div className="flex items-center justify-center gap-3 mt-1">
              <p className="text-xs text-gray-600">
                Tiempo desde inicio: {formatDuration(elapsedSinceStart)}
              </p>
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors underline"
                  title="Reiniciar todos los datos"
                >
                  Reiniciar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">¿Seguro?</span>
                  <button
                    onClick={handleReset}
                    className="text-xs px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="text-xs px-2 py-0.5 bg-gray-700/50 border border-gray-600/50 rounded text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Price Header */}
        <PriceHeader
          currentPrice={currentPrice}
          priceChange24h={priceChange24h}
          priceChangePercent24h={priceChangePercent24h}
          isConnected={isConnected}
          lastUpdate={lastUpdate}
        />

        {/* Directional Movement Display */}
        <DirectionalDisplay state={directionalState} currentPrice={currentPrice} appStartTime={appStartTime} />

        {/* Footer */}
        <div className="text-center py-4 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
            <p className="text-xs text-gray-500">
              Datos guardados automáticamente en tu navegador
            </p>
          </div>
          <p className="text-xs text-gray-600">
            Datos en tiempo real de Binance Futures • No constituye asesoramiento financiero
          </p>
        </div>
      </div>
    </div>
  );
}
