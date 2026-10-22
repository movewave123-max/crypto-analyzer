import { useState, useEffect } from 'react';
import { DirectionalState, DirectionalRun } from '../utils/directionalMovement';

interface AlertsProps {
  state: DirectionalState;
  threshold?: number; // Porcentaje mínimo para alertar (default: 2%)
}

interface Alert {
  id: string;
  run: DirectionalRun;
  timestamp: number;
  dismissed: boolean;
}

export default function Alerts({ state, threshold = 2.0 }: AlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const { upRuns, downRuns } = state;
  
  // Detectar nuevos runs importantes
  useEffect(() => {
    const allRuns = [...upRuns, ...downRuns];
    
    // Filtrar runs que superan el threshold
    const importantRuns = allRuns.filter(run => Math.abs(run.movePercent) >= threshold);
    
    // Crear nuevas alertas para runs que no tenemos aún
    const newAlerts: Alert[] = [];
    importantRuns.forEach(run => {
      const existingAlert = alerts.find(a => a.run.id === run.id);
      if (!existingAlert) {
        newAlerts.push({
          id: `alert-${run.id}`,
          run,
          timestamp: Date.now(),
          dismissed: false,
        });
        
        // Reproducir sonido si está habilitado
        if (soundEnabled) {
          playAlertSound(run.direction);
        }
      }
    });
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev]);
    }
  }, [upRuns, downRuns, threshold, soundEnabled]);

  // Función para reproducir sonido de alerta
  const playAlertSound = (direction: 'up' | 'down') => {
    // Crear un beep simple usando Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Diferentes tonos para alcista/bajista
    oscillator.frequency.value = direction === 'up' ? 800 : 400;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Dismiss alert
  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    ));
  };

  // Clear all alerts
  const clearAllAlerts = () => {
    setAlerts([]);
  };

  // Filtrar alertas no dismissadas
  const activeAlerts = alerts.filter(a => !a.dismissed);

  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          🔔 Alertas de Movimientos Importantes
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1 rounded text-sm ${
              soundEnabled 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {soundEnabled ? '🔊 Sonido ON' : '🔇 Sonido OFF'}
          </button>
          {activeAlerts.length > 0 && (
            <button
              onClick={clearAllAlerts}
              className="px-3 py-1 rounded text-sm bg-gray-700 text-gray-400 hover:bg-gray-600"
            >
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-4">
        Umbral de alerta: ≥{threshold}% | Alertas activas: {activeAlerts.length}
      </div>

      {activeAlerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Sin alertas activas</p>
          <p className="text-xs mt-1">
            Se notificará cuando se complete un movimiento ≥{threshold}%
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activeAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-2 ${
                alert.run.direction === 'up'
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-red-900/20 border-red-500/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {alert.run.direction === 'up' ? '📈' : '📉'}
                    </span>
                    <div>
                      <p className={`text-lg font-bold ${
                        alert.run.direction === 'up' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {alert.run.direction === 'up' ? 'ALCISTA' : 'BAJISTA'} IMPORTANTE
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Movimiento</p>
                      <p className={`text-xl font-bold ${
                        alert.run.direction === 'up' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {alert.run.direction === 'up' ? '+' : ''}{alert.run.movePercent.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duración</p>
                      <p className="text-xl font-bold text-blue-400">
                        {formatDuration(alert.run.duration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Precio inicio</p>
                      <p className="text-sm font-mono text-white">
                        ${alert.run.startPrice.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        {alert.run.direction === 'up' ? 'Máximo' : 'Mínimo'}
                      </p>
                      <p className={`text-sm font-mono ${
                        alert.run.direction === 'up' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${alert.run.extremePrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="ml-4 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
