import { DirectionalState } from '../utils/directionalMovement';

interface TemporalComparisonProps {
  state: DirectionalState;
}

export default function TemporalComparison({ state }: TemporalComparisonProps) {
  const { upRuns, downRuns } = state;
  const allRuns = [...upRuns, ...downRuns];
  
  if (allRuns.length < 5) {
    return (
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📈 Comparativa Temporal
        </h3>
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">Datos insuficientes</p>
          <p className="text-xs mt-1">Se necesitan al menos 5 movimientos para el análisis</p>
          <p className="text-xs mt-1">Movimientos actuales: {allRuns.length}</p>
        </div>
      </div>
    );
  }

  const now = Date.now();
  
  // Definir ventanas de tiempo
  const windows = [
    { label: 'Últimos 15 min', ms: 15 * 60 * 1000 },
    { label: 'Última hora', ms: 60 * 60 * 1000 },
    { label: 'Últimas 4 horas', ms: 4 * 60 * 60 * 1000 },
    { label: 'Todo el tiempo', ms: Infinity },
  ];

  // Calcular estadísticas por ventana
  const windowStats = windows.map(window => {
    const runsInWindow = allRuns.filter(run => 
      now - run.endTime <= window.ms
    );
    
    if (runsInWindow.length === 0) {
      return {
        ...window,
        count: 0,
        avgMove: 0,
        avgUpMove: 0,
        avgDownMove: 0,
        volatility: 0,
        upCount: 0,
        downCount: 0,
      };
    }

    const upRunsInWindow = runsInWindow.filter(r => r.direction === 'up');
    const downRunsInWindow = runsInWindow.filter(r => r.direction === 'down');

    const avgMove = runsInWindow.reduce((sum, r) => sum + Math.abs(r.movePercent), 0) / runsInWindow.length;
    const avgUpMove = upRunsInWindow.length > 0 
      ? upRunsInWindow.reduce((sum, r) => sum + r.movePercent, 0) / upRunsInWindow.length 
      : 0;
    const avgDownMove = downRunsInWindow.length > 0
      ? downRunsInWindow.reduce((sum, r) => sum + Math.abs(r.movePercent), 0) / downRunsInWindow.length
      : 0;

    // Calcular volatilidad (desviación estándar de los movimientos)
    const moves = runsInWindow.map(r => Math.abs(r.movePercent));
    const mean = avgMove;
    const variance = moves.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / moves.length;
    const volatility = Math.sqrt(variance);

    return {
      ...window,
      count: runsInWindow.length,
      avgMove,
      avgUpMove,
      avgDownMove,
      volatility,
      upCount: upRunsInWindow.length,
      downCount: downRunsInWindow.length,
    };
  });

  // Detectar tendencia de volatilidad
  const recentVolatility = windowStats[0].volatility; // Últimos 15 min
  const olderVolatility = windowStats[1].volatility; // Última hora
  
  let volatilityTrend = 'stable';
  let trendColor = 'text-gray-400';
  let trendIcon = '➡️';
  
  if (recentVolatility > olderVolatility * 1.2) {
    volatilityTrend = 'increasing';
    trendColor = 'text-red-400';
    trendIcon = '📈';
  } else if (recentVolatility < olderVolatility * 0.8) {
    volatilityTrend = 'decreasing';
    trendColor = 'text-green-400';
    trendIcon = '📉';
  }

  // Detectar sesgo direccional
  const recentRuns = allRuns.filter(r => now - r.endTime <= 60 * 60 * 1000);
  const recentUpCount = recentRuns.filter(r => r.direction === 'up').length;
  const recentDownCount = recentRuns.filter(r => r.direction === 'down').length;
  
  let directionalBias = 'neutral';
  let biasColor = 'text-gray-400';
  let biasIcon = '⚖️';
  
  if (recentUpCount > recentDownCount * 1.5) {
    directionalBias = 'bullish';
    biasColor = 'text-green-400';
    biasIcon = '🐂';
  } else if (recentDownCount > recentUpCount * 1.5) {
    directionalBias = 'bearish';
    biasColor = 'text-red-400';
    biasIcon = '🐻';
  }

  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        📈 Comparativa Temporal
      </h3>

      {/* Indicadores principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Tendencia de Volatilidad</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{trendIcon}</span>
            <div>
              <p className={`text-lg font-bold ${trendColor}`}>
                {volatilityTrend === 'increasing' && 'Aumentando'}
                {volatilityTrend === 'decreasing' && 'Disminuyendo'}
                {volatilityTrend === 'stable' && 'Estable'}
              </p>
              <p className="text-xs text-gray-500">
                {recentVolatility.toFixed(2)}% vs {olderVolatility.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Sesgo Direccional (última hora)</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{biasIcon}</span>
            <div>
              <p className={`text-lg font-bold ${biasColor}`}>
                {directionalBias === 'bullish' && 'Alcista'}
                {directionalBias === 'bearish' && 'Bajista'}
                {directionalBias === 'neutral' && 'Neutral'}
              </p>
              <p className="text-xs text-gray-500">
                {recentUpCount} alcistas / {recentDownCount} bajistas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de ventanas temporales */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase py-3 px-2">Período</th>
              <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2">Movimientos</th>
              <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2">Promedio</th>
              <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2">Alcistas</th>
              <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2">Bajistas</th>
              <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2">Volatilidad</th>
            </tr>
          </thead>
          <tbody>
            {windowStats.map((stat, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                <td className="py-3 px-2">
                  <span className="text-sm font-medium text-white">{stat.label}</span>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-mono text-white">{stat.count}</span>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-mono text-blue-400">
                    {stat.avgMove.toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-mono text-green-400">
                      +{stat.avgUpMove.toFixed(2)}%
                    </span>
                    <span className="text-xs text-gray-500">({stat.upCount})</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-mono text-red-400">
                      -{stat.avgDownMove.toFixed(2)}%
                    </span>
                    <span className="text-xs text-gray-500">({stat.downCount})</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-mono text-orange-400">
                    {stat.volatility.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Análisis detallado */}
      <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-3">📊 Análisis Detallado</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <span className="text-gray-500">Frecuencia:</span>{' '}
            {windowStats[1].count} movimientos en la última hora 
            ({(windowStats[1].count / 1).toFixed(1)}/hora)
          </p>
          <p>
            <span className="text-gray-500">Intensidad:</span>{' '}
            Movimiento promedio de {windowStats[1].avgMove.toFixed(2)}% en la última hora
          </p>
          <p>
            <span className="text-gray-500">Consistencia:</span>{' '}
            {windowStats[1].volatility < 1 
              ? 'Baja volatilidad (movimientos consistentes)' 
              : windowStats[1].volatility < 2 
                ? 'Volatilidad moderada' 
                : 'Alta volatilidad (movimientos impredecibles)'}
          </p>
          <p>
            <span className="text-gray-500">Ratio alcista/bajista:</span>{' '}
            {windowStats[1].upCount + windowStats[1].downCount > 0
              ? `${(windowStats[1].upCount / (windowStats[1].upCount + windowStats[1].downCount) * 100).toFixed(0)}% alcistas`
              : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
