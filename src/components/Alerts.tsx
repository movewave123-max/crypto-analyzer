import { useState, useEffect } from 'react';
import { DirectionalState, DirectionalRun } from '../utils/directionalMovement';
import AlertCard from './AlertCard';
import { playAlertSound } from '../utils/alertSound';

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
            <AlertCard key={alert.id} run={alert.run} timestamp={alert.timestamp} onDismiss={() => dismissAlert(alert.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
