import { useState } from 'react';
import AlertCard from './AlertCard';
import { DirectionalRun } from '../utils/directionalMovement';
import { AdminAlertSound, playAdminAlertSound } from '../utils/alertSound';

interface AdminPanelProps {
  currentPrice: number;
}

interface SimulatedAlert {
  run: DirectionalRun;
  timestamp: number;
}

export default function AdminPanel({ currentPrice }: AdminPanelProps) {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [sound, setSound] = useState<AdminAlertSound>('classic');
  const [alert, setAlert] = useState<SimulatedAlert | null>(null);

  const simulateAlert = () => {
    if (!(currentPrice > 0)) return;
    const now = Date.now();
    const movePercent = direction === 'up' ? 2.5 : -2.5;
    const startPrice = direction === 'up'
      ? currentPrice / (1 + movePercent / 100)
      : currentPrice / (1 + movePercent / 100);
    const run: DirectionalRun = {
      id: `admin-test-${now}`,
      direction,
      startPrice,
      endPrice: currentPrice,
      extremePrice: currentPrice,
      movePercent,
      moveAmount: Math.abs(currentPrice - startPrice),
      startTime: now - 45000,
      endTime: now,
      duration: 45000,
    };
    setAlert({ run, timestamp: now });
    playAdminAlertSound(direction, sound);
  };

  return <section className="rounded-lg border border-amber-700/50 bg-gradient-to-br from-amber-900/15 to-gray-900 p-6">
    <div className="flex items-center gap-2"><span aria-hidden="true">⚙️</span><h2 className="text-2xl font-bold text-white">Panel de administración</h2></div>
    <p className="mt-2 text-sm text-gray-400">Herramientas locales de prueba. No se requiere contraseña.</p>

    <div className="mt-5 max-w-xl rounded-lg border border-gray-700 bg-gray-950/60 p-4">
      <h3 className="font-semibold text-white">Simular alerta de movimiento importante</h3>
      <p className="mt-1 text-xs text-gray-500">Prueba el mismo aviso visual y el mismo sonido de las alertas reales. No modifica el análisis ni genera un movimiento de mercado.</p>
      <label className="mt-4 block text-xs text-gray-400">Dirección de la alerta
        <select value={direction} onChange={(event) => setDirection(event.target.value as 'up' | 'down')} className="mt-1 block w-full rounded border border-gray-700 bg-gray-900 p-2 text-white">
          <option value="up">Alcista</option>
          <option value="down">Bajista</option>
        </select>
      </label>
      <label className="mt-3 block text-xs text-gray-400">Sonido de prueba
        <select value={sound} onChange={(event) => setSound(event.target.value as AdminAlertSound)} className="mt-1 block w-full rounded border border-gray-700 bg-gray-900 p-2 text-white">
          <option value="classic">Pitido clásico actual</option>
          <option value="ascending">Dos notas ascendentes</option>
          <option value="descending">Dos notas descendentes</option>
          <option value="triple">Tres pitidos rápidos</option>
        </select>
      </label>
      <button type="button" onClick={simulateAlert} disabled={!(currentPrice > 0)} className="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">Simular alerta con sonido</button>
      {!(currentPrice > 0) && <p className="mt-2 text-xs text-gray-500">Esperando un precio válido de Binance.</p>}
    </div>

    {alert && <div className="mt-5 max-w-2xl"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Vista previa de la alerta simulada</p><AlertCard run={alert.run} timestamp={alert.timestamp} onDismiss={() => setAlert(null)} /></div>}
  </section>;
}
