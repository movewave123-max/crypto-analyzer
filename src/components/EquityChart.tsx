import { DirectionalState } from '../utils/directionalMovement';

interface EquityChartProps {
  state: DirectionalState;
}

const BIAS_WINDOW_SIZE = 30;
const NEUTRAL_BIAS_THRESHOLD_PERCENT = 10;

export default function EquityChart({ state }: EquityChartProps) {
  const { upRuns, downRuns } = state;
  
  // El sesgo se calcula sobre los tramos completados más recientes.
  const allRuns = [...upRuns, ...downRuns].sort((a, b) => a.endTime - b.endTime);
  const recentRuns = allRuns.slice(-BIAS_WINDOW_SIZE);
  
  if (recentRuns.length === 0) {
    return (
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📊 Sesgo de mercado
        </h3>
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">Sin datos aún</p>
          <p className="text-xs mt-1">El indicador aparecerá cuando se completen movimientos</p>
        </div>
      </div>
    );
  }

  const upMoveTotal = recentRuns
    .filter(run => run.direction === 'up')
    .reduce((total, run) => total + Math.abs(run.movePercent), 0);
  const downMoveTotal = recentRuns
    .filter(run => run.direction === 'down')
    .reduce((total, run) => total + Math.abs(run.movePercent), 0);
  const directionalBalance = upMoveTotal - downMoveTotal;
  const totalMovement = upMoveTotal + downMoveTotal;
  const relativeBalancePercent = totalMovement > 0 ? (directionalBalance / totalMovement) * 100 : 0;
  const hasFullWindow = recentRuns.length === BIAS_WINDOW_SIZE;
  const bias = !hasFullWindow
    ? 'collecting'
    : relativeBalancePercent > NEUTRAL_BIAS_THRESHOLD_PERCENT
      ? 'bullish'
      : relativeBalancePercent < -NEUTRAL_BIAS_THRESHOLD_PERCENT
        ? 'bearish'
        : 'neutral';
  const biasLabel = {
    collecting: 'Recopilando datos',
    bullish: 'Alcista',
    bearish: 'Bajista',
    neutral: 'Neutral',
  }[bias];
  const biasColor = {
    collecting: 'text-gray-300',
    bullish: 'text-green-400',
    bearish: 'text-red-400',
    neutral: 'text-yellow-300',
  }[bias];

  // Balance acumulado de amplitudes direccionales, no equity ni PnL de una cuenta.
  let cumulativeBalance = 0;
  const balancePoints = recentRuns.map(run => {
    cumulativeBalance += run.movePercent;
    return {
      time: run.endTime,
      balance: cumulativeBalance,
      direction: run.direction,
      movePercent: run.movePercent,
    };
  });

  const maxBalance = Math.max(0, ...balancePoints.map(point => point.balance));
  const minBalance = Math.min(0, ...balancePoints.map(point => point.balance));
  const currentBalance = balancePoints[balancePoints.length - 1].balance;
  
  // Mayor caída desde un máximo local del balance, incluyendo el punto inicial 0.
  let peak = 0;
  let maxBalancePullback = 0;
  balancePoints.forEach(point => {
    if (point.balance > peak) peak = point.balance;
    const pullback = peak - point.balance;
    if (pullback > maxBalancePullback) maxBalancePullback = pullback;
  });

  // Generar SVG path
  const width = 800;
  const height = 300;
  const padding = 40;
  
  const minTime = balancePoints[0].time;
  const maxTime = balancePoints[balancePoints.length - 1].time;
  const timeRange = maxTime - minTime || 1;
  
  const balanceRange = maxBalance - minBalance || 1;
  
  const points = balancePoints.map(point => {
    const x = padding + ((point.time - minTime) / timeRange) * (width - 2 * padding);
    const y = height - padding - ((point.balance - minBalance) / balanceRange) * (height - 2 * padding);
    return { x, y, ...point };
  });

  const pathD = points.map((point, i) => {
    return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ');

  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        📊 Sesgo de mercado · últimos {recentRuns.length} tramos
      </h3>
      <p className="mb-5 text-xs text-gray-400">
        Compara la amplitud acumulada de los tramos alcistas y bajistas completados. p.p. significa puntos porcentuales: la diferencia entre ambas sumas, no el PnL de la estrategia.
      </p>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-gray-500 mb-1">Sesgo</p>
          <p className={`text-xl font-bold ${biasColor}`}>
            {biasLabel}
          </p>
          {!hasFullWindow && <p className="mt-1 text-xs text-gray-500">Se necesitan {BIAS_WINDOW_SIZE} tramos</p>}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Balance direccional</p>
          <p className={`text-xl font-bold ${directionalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {directionalBalance >= 0 ? '+' : ''}{directionalBalance.toFixed(2)} p.p.
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Movimientos alcistas</p>
          <p className="text-xl font-bold text-green-400">
            +{upMoveTotal.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Movimientos bajistas</p>
          <p className="text-xl font-bold text-red-400">
            -{downMoveTotal.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Gráfico SVG */}
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="border border-gray-700 rounded">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding + ratio * (height - 2 * padding);
            const value = maxBalance - ratio * balanceRange;
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#374151"
                  strokeWidth="1"
                  strokeDasharray="4"
                />
                <text
                  x={padding - 5}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs"
                  fill="#9CA3AF"
                >
                  {value.toFixed(1)} p.p.
                </text>
              </g>
            );
          })}
          
          {/* Zero line */}
          {minBalance < 0 && maxBalance > 0 && (
            <line
              x1={padding}
              y1={height - padding - ((0 - minBalance) / balanceRange) * (height - 2 * padding)}
              x2={width - padding}
              y2={height - padding - ((0 - minBalance) / balanceRange) * (height - 2 * padding)}
              stroke="#6B7280"
              strokeWidth="2"
            />
          )}
          
          {/* Balance line */}
          <path
            d={pathD}
            fill="none"
            stroke={currentBalance >= 0 ? '#10B981' : '#EF4444'}
            strokeWidth="2"
          />
          
          {/* Points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="3"
              fill={point.direction === 'up' ? '#10B981' : '#EF4444'}
            />
          ))}
          
          {/* Time labels */}
          <text
            x={padding}
            y={height - 10}
            textAnchor="start"
            className="text-xs"
            fill="#9CA3AF"
          >
            {new Date(minTime).toLocaleTimeString()}
          </text>
          <text
            x={width - padding}
            y={height - 10}
            textAnchor="end"
            className="text-xs"
            fill="#9CA3AF"
          >
            {new Date(maxTime).toLocaleTimeString()}
          </text>
        </svg>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Balance acumulado de movimientos: {currentBalance >= 0 ? '+' : ''}{currentBalance.toFixed(2)} p.p. · Retroceso máximo del balance: {maxBalancePullback.toFixed(2)} p.p.</p>
        <p className="mt-1">Umbral neutral: ±{NEUTRAL_BIAS_THRESHOLD_PERCENT}% del movimiento total · Ventana: {recentRuns.length}/{BIAS_WINDOW_SIZE} tramos completos</p>
      </div>
    </div>
  );
}
