import { DirectionalState, DirectionalRun, formatDuration } from '../utils/directionalMovement';

interface DirectionalDisplayProps {
  state: DirectionalState;
  currentPrice: number;
  appStartTime: number;
}

export default function DirectionalDisplay({ state, currentPrice, appStartTime }: DirectionalDisplayProps) {
  const { currentRun, upRuns, downRuns, stats, reversalThreshold } = state;

  // Calcular el movimiento actual en progreso
  const currentMovePercent = currentRun.direction && currentRun.startPrice > 0
    ? currentRun.direction === 'up'
      ? ((currentRun.extremePrice - currentRun.startPrice) / currentRun.startPrice) * 100
      : ((currentRun.startPrice - currentRun.extremePrice) / currentRun.startPrice) * 100
    : 0;

  const currentReversalPercent = currentRun.direction && currentRun.extremePrice > 0
    ? currentRun.direction === 'up'
      ? ((currentRun.extremePrice - currentPrice) / currentRun.extremePrice) * 100
      : ((currentPrice - currentRun.extremePrice) / currentRun.extremePrice) * 100
    : 0;

  const currentDuration = currentRun.startTime > 0 ? Date.now() - currentRun.startTime : 0;

  // Últimos 10 runs (mezclados y ordenados por tiempo)
  const recentRuns = [...upRuns, ...downRuns]
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          📊 Análisis de Movimiento Direccional
        </h2>
        <p className="text-sm text-gray-400">
          Mide cuánto se mueve el precio en una dirección antes de retroceder {reversalThreshold}%
        </p>
        {appStartTime > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            ⏱️ Tiempo transcurrido: {formatDuration(Date.now() - appStartTime)}
          </p>
        )}
      </div>

      {/* Run actual en progreso */}
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${
            currentRun.direction === 'up' ? 'bg-green-500 animate-pulse' :
            currentRun.direction === 'down' ? 'bg-red-500 animate-pulse' :
            'bg-gray-500'
          }`}></span>
          Movimiento Actual en Progreso
        </h3>

        {currentRun.direction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Dirección</p>
                <p className={`text-xl font-bold ${
                  currentRun.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currentRun.direction === 'up' ? '📈 ALCISTA' : '📉 BAJISTA'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Movimiento</p>
                <p className={`text-xl font-bold ${
                  currentRun.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  +{currentMovePercent.toFixed(3)}%
                </p>
                <p className="text-xs text-gray-500">
                  ${Math.abs(currentRun.extremePrice - currentRun.startPrice).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Retroceso</p>
                <p className="text-xl font-bold text-yellow-400">
                  {currentReversalPercent.toFixed(3)}%
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((currentReversalPercent / reversalThreshold) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Umbral: {reversalThreshold}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Duración</p>
                <p className="text-xl font-bold text-blue-400">
                  {formatDuration(currentDuration)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
              <div>
                <p className="text-xs text-gray-500 mb-1">Precio de inicio</p>
                <p className="text-sm font-mono text-white">${currentRun.startPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  {currentRun.direction === 'up' ? 'Máximo alcanzado' : 'Mínimo alcanzado'}
                </p>
                <p className={`text-sm font-mono ${
                  currentRun.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${currentRun.extremePrice.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">Esperando primer movimiento...</p>
            <p className="text-sm">El análisis comenzará cuando el precio se mueva</p>
          </div>
        )}
      </div>

      {/* Estadísticas comparativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Estadísticas alcistas */}
        <div className="rounded-lg bg-gradient-to-br from-green-900/20 to-gray-900 border border-green-700/50 p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            📈 Movimientos Alcistas
          </h3>
          
          {stats.totalUpRuns > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total de runs</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUpRuns}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Movimiento promedio</p>
                  <p className="text-2xl font-bold text-green-400">
                    +{stats.avgUpMove.toFixed(3)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Máximo</p>
                  <p className="text-lg font-bold text-green-400">
                    +{stats.maxUpMove.toFixed(3)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mínimo</p>
                  <p className="text-lg font-bold text-green-400">
                    +{stats.minUpMove === Infinity ? '0.000' : stats.minUpMove.toFixed(3)}%
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Duración promedio</p>
                <p className="text-lg font-bold text-blue-400">
                  {formatDuration(stats.avgUpDuration)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Sin datos aún</p>
            </div>
          )}
        </div>

        {/* Estadísticas bajistas */}
        <div className="rounded-lg bg-gradient-to-br from-red-900/20 to-gray-900 border border-red-700/50 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            📉 Movimientos Bajistas
          </h3>
          
          {stats.totalDownRuns > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total de runs</p>
                  <p className="text-2xl font-bold text-white">{stats.totalDownRuns}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Movimiento promedio</p>
                  <p className="text-2xl font-bold text-red-400">
                    -{stats.avgDownMove.toFixed(3)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Máximo</p>
                  <p className="text-lg font-bold text-red-400">
                    -{stats.maxDownMove.toFixed(3)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mínimo</p>
                  <p className="text-lg font-bold text-red-400">
                    -{stats.minDownMove === Infinity ? '0.000' : stats.minDownMove.toFixed(3)}%
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Duración promedio</p>
                <p className="text-lg font-bold text-blue-400">
                  {formatDuration(stats.avgDownDuration)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Sin datos aún</p>
            </div>
          )}
        </div>
      </div>

      {/* Historial de runs recientes */}
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📜 Historial de Movimientos Recientes
        </h3>

        {recentRuns.length > 0 ? (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className={`flex items-center justify-between p-3 rounded border ${
                  run.direction === 'up'
                    ? 'bg-green-900/10 border-green-700/30'
                    : 'bg-red-900/10 border-red-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {run.direction === 'up' ? '📈' : '📉'}
                  </span>
                  <div>
                    <p className={`text-sm font-bold ${
                      run.direction === 'up' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {run.direction === 'up' ? 'ALCISTA' : 'BAJISTA'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(run.startTime).toLocaleTimeString()} - {new Date(run.endTime).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    run.direction === 'up' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {run.direction === 'up' ? '+' : '-'}{run.movePercent.toFixed(3)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    ${run.moveAmount.toFixed(2)} • {formatDuration(run.duration)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No hay movimientos completados aún</p>
            <p className="text-xs mt-1">
              Los movimientos aparecerán aquí cuando se complete un ciclo (movimiento + retroceso de {reversalThreshold}%)
            </p>
          </div>
        )}
      </div>

      {/* Explicación */}
      <div className="rounded-lg bg-gradient-to-br from-blue-900/20 to-gray-900 border border-blue-700/50 p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3">
          💡 ¿Cómo funciona este análisis?
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <strong className="text-white">1. Detección de dirección:</strong> Cuando el precio comienza a moverse significativamente en una dirección (alcista o bajista), se inicia un "run".
          </p>
          <p>
            <strong className="text-white">2. Seguimiento del extremo:</strong> Se trackea el máximo (en runs alcistas) o mínimo (en runs bajistas) alcanzado durante el movimiento.
          </p>
          <p>
            <strong className="text-white">3. Detección de reversa:</strong> Cuando el precio retrocede {reversalThreshold}% desde el extremo, se considera que el run ha terminado.
          </p>
          <p>
            <strong className="text-white">4. Registro:</strong> Se guarda cuánto se movió el precio en esa dirección antes del retroceso, junto con la duración del movimiento.
          </p>
          <p>
            <strong className="text-white">5. Estadísticas:</strong> Se calculan promedios, máximos y mínimos de todos los runs completados en cada dirección.
          </p>
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Ejemplo:</strong> Si el precio sube de $2,500 a $2,530 (+1.2%) y luego retrocede a $2,520 (-0.4% desde el máximo), se registra un movimiento alcista de +1.2% con duración de X segundos/minutos.
          </p>
        </div>
      </div>
    </div>
  );
}
