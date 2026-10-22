import { DirectionalRun } from '../utils/directionalMovement';

interface AlertCardProps {
  run: DirectionalRun;
  timestamp: number;
  onDismiss?: () => void;
}

export default function AlertCard({ run, timestamp, onDismiss }: AlertCardProps) {
  const isUp = run.direction === 'up';
  return (
    <div className={`rounded-lg border-2 p-4 ${isUp ? 'border-green-500/50 bg-green-900/20' : 'border-red-500/50 bg-red-900/20'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">{isUp ? '📈' : '📉'}</span>
            <div>
              <p className={`text-lg font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? 'ALCISTA' : 'BAJISTA'} IMPORTANTE</p>
              <p className="text-xs text-gray-500">{new Date(timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-gray-500">Movimiento</p><p className={`text-xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{run.movePercent.toFixed(2)}%</p></div>
            <div><p className="text-xs text-gray-500">Duración</p><p className="text-xl font-bold text-blue-400">{formatDuration(run.duration)}</p></div>
            <div><p className="text-xs text-gray-500">Precio inicio</p><p className="font-mono text-sm text-white">${run.startPrice.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">{isUp ? 'Máximo' : 'Mínimo'}</p><p className={`font-mono text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>${run.extremePrice.toFixed(2)}</p></div>
          </div>
        </div>
        {onDismiss && <button type="button" onClick={onDismiss} aria-label="Descartar alerta" className="ml-4 text-gray-500 hover:text-white">✕</button>}
      </div>
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
