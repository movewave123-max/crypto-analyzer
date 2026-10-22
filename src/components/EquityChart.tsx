import { DirectionalState } from '../utils/directionalMovement';

interface EquityChartProps {
  state: DirectionalState;
}

export default function EquityChart({ state }: EquityChartProps) {
  const { upRuns, downRuns } = state;
  
  // Combinar todos los runs y ordenar por tiempo
  const allRuns = [...upRuns, ...downRuns].sort((a, b) => a.endTime - b.endTime);
  
  if (allRuns.length === 0) {
    return (
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📊 Equity Curve
        </h3>
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">Sin datos aún</p>
          <p className="text-xs mt-1">El gráfico aparecerá cuando se completen movimientos</p>
        </div>
      </div>
    );
  }

  // Calcular equity acumulado
  let cumulativeEquity = 0;
  const equityPoints = allRuns.map(run => {
    cumulativeEquity += run.movePercent;
    return {
      time: run.endTime,
      equity: cumulativeEquity,
      direction: run.direction,
      movePercent: run.movePercent,
    };
  });

  // Calcular estadísticas
  const maxEquity = Math.max(...equityPoints.map(p => p.equity));
  const minEquity = Math.min(...equityPoints.map(p => p.equity));
  const currentEquity = equityPoints[equityPoints.length - 1].equity;
  
  // Calcular max drawdown
  let peak = equityPoints[0].equity;
  let maxDrawdown = 0;
  equityPoints.forEach(point => {
    if (point.equity > peak) peak = point.equity;
    const drawdown = peak - point.equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Generar SVG path
  const width = 800;
  const height = 300;
  const padding = 40;
  
  const minTime = equityPoints[0].time;
  const maxTime = equityPoints[equityPoints.length - 1].time;
  const timeRange = maxTime - minTime || 1;
  
  const equityRange = maxEquity - minEquity || 1;
  
  const points = equityPoints.map(point => {
    const x = padding + ((point.time - minTime) / timeRange) * (width - 2 * padding);
    const y = height - padding - ((point.equity - minEquity) / equityRange) * (height - 2 * padding);
    return { x, y, ...point };
  });

  const pathD = points.map((point, i) => {
    return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ');

  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        📊 Equity Curve
      </h3>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-gray-500 mb-1">Equity Actual</p>
          <p className={`text-xl font-bold ${currentEquity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {currentEquity >= 0 ? '+' : ''}{currentEquity.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Máximo</p>
          <p className="text-xl font-bold text-green-400">
            +{maxEquity.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Mínimo</p>
          <p className="text-xl font-bold text-red-400">
            {minEquity.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Max Drawdown</p>
          <p className="text-xl font-bold text-orange-400">
            -{maxDrawdown.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Gráfico SVG */}
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="border border-gray-700 rounded">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding + ratio * (height - 2 * padding);
            const value = maxEquity - ratio * equityRange;
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
                  {value.toFixed(1)}%
                </text>
              </g>
            );
          })}
          
          {/* Zero line */}
          {minEquity < 0 && maxEquity > 0 && (
            <line
              x1={padding}
              y1={height - padding - ((0 - minEquity) / equityRange) * (height - 2 * padding)}
              x2={width - padding}
              y2={height - padding - ((0 - minEquity) / equityRange) * (height - 2 * padding)}
              stroke="#6B7280"
              strokeWidth="2"
            />
          )}
          
          {/* Equity line */}
          <path
            d={pathD}
            fill="none"
            stroke={currentEquity >= 0 ? '#10B981' : '#EF4444'}
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
        <p>Total de movimientos: {allRuns.length} ({upRuns.length} alcistas, {downRuns.length} bajistas)</p>
      </div>
    </div>
  );
}
