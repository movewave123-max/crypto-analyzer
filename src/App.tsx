import { useState } from 'react';
import { useBinanceData } from './hooks/useBinanceData';
import PriceHeader from './components/PriceHeader';
import DirectionalDisplay from './components/DirectionalDisplay';
import EquityChart from './components/EquityChart';
import Alerts from './components/Alerts';
import TemporalComparison from './components/TemporalComparison';
import StrategyTab from './components/StrategyTab';
import BacktestTab from './components/BacktestTab';
import RealtimePriceChart from './components/RealtimePriceChart';
import AdminPanel from './components/AdminPanel';
import { formatDuration } from './utils/directionalMovement';

export default function App() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'strategy' | 'backtest' | 'admin'>('analysis');

  const {
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
    startStrategy,
    stopStrategy,
    resetStrategy,
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
          <p className="text-gray-400">Conectando con el servidor y Binance Futures...</p>
          <p className="text-xs text-gray-600 mt-2">Si tarda, comprueba que el servidor local esté en marcha.</p>
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
              {strategy.running ? (
                <span className="text-xs text-gray-600">Detén la estrategia antes de reiniciar el análisis</span>
              ) : !showResetConfirm ? (
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
          isServerConnected={isServerConnected}
          lastUpdate={lastUpdate}
        />

        <RealtimePriceChart currentPrice={currentPrice} isConnected={isConnected} />

        <div role="tablist" aria-label="Secciones de la aplicación" className="flex gap-2 border-b border-gray-800">
          <button role="tab" aria-selected={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'analysis' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            Análisis de mercado
          </button>
          <button role="tab" aria-selected={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'strategy' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            Estrategia virtual
          </button>
          <button role="tab" aria-selected={activeTab === 'backtest'} onClick={() => setActiveTab('backtest')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'backtest' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            Backtesting
          </button>
          <button role="tab" aria-selected={activeTab === 'admin'} onClick={() => setActiveTab('admin')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'admin' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            Administración
          </button>
        </div>

        {activeTab === 'analysis' ? (
          <>
            <DirectionalDisplay state={directionalState} currentPrice={currentPrice} appStartTime={appStartTime} />
            <EquityChart state={directionalState} />
            <Alerts state={directionalState} threshold={2.0} />
            <TemporalComparison state={directionalState} />
          </>
        ) : activeTab === 'strategy' ? (
          <StrategyTab
            state={strategy}
            directionalState={directionalState}
            currentPrice={currentPrice}
            isConnected={isConnected}
            onStart={startStrategy}
            onStop={stopStrategy}
            onReset={resetStrategy}
          />
        ) : activeTab === 'backtest' ? (
          <BacktestTab defaultConfig={strategy.config} />
        ) : (
          <AdminPanel currentPrice={currentPrice} />
        )}

        {/* Footer */}
        <div className="text-center py-4 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
            <p className="text-xs text-gray-500">
              Estadísticas guardadas automáticamente por el servidor local en server-data.json
            </p>
          </div>
          <p className="text-xs text-gray-600">
            ETHUSDT Perpetual · Binance Futures · Métrica descriptiva, no es una señal ni asesoramiento financiero
          </p>
          <p className="pt-1 text-xs font-medium tracking-wide text-gray-500">Versión V1.1</p>
        </div>
      </div>
    </div>
  );
}
