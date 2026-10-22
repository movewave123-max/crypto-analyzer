import { useMemo, useState } from 'react';
import { DirectionalState, formatDuration } from '../utils/directionalMovement';

interface DirectionalDisplayProps {
  state: DirectionalState;
  currentPrice: number;
  appStartTime: number;
}

export default function DirectionalDisplay({ state, currentPrice, appStartTime }: DirectionalDisplayProps) {
  const { currentRun, upRuns, downRuns, stats, reversalThreshold } = state;
  const [directionFilter, setDirectionFilter] = useState<'all' | 'up' | 'down'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minMove, setMinMove] = useState('');
  const [maxMove, setMaxMove] = useState('');

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

  // Movimientos recientes mezclados y ordenados por tiempo.
  const recentRuns = useMemo(() => [...upRuns, ...downRuns].sort((a, b) => b.endTime - a.endTime), [upRuns, downRuns]);
  const filteredRuns = useMemo(() => recentRuns.filter((run) => {
    const move = Math.abs(run.movePercent);
    const startTime = startDate ? new Date(`${startDate}T00:00:00`).getTime() : -Infinity;
    const endTime = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Infinity;
    return (directionFilter === 'all' || run.direction === directionFilter)
      && run.endTime >= startTime && run.endTime <= endTime
      && (!minMove || move >= Number(minMove))
      && (!maxMove || move <= Number(maxMove));
  }), [recentRuns, directionFilter, startDate, endDate, minMove, maxMove]);

  const exportCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ['Dirección', 'Inicio', 'Fin', 'Precio inicio', 'Extremo', 'Precio fin', 'Movimiento %', 'Duración ms'],
      ...filteredRuns.map((run) => [
        run.direction === 'up' ? 'Alcista' : 'Bajista',
        new Date(run.startTime).toISOString(), new Date(run.endTime).toISOString(),
        run.startPrice, run.extremePrice, run.endPrice, run.movePercent, run.duration,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ethusdt-movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          📊 Análisis de Movimiento Direccional
        </h2>
        <p className="text-sm text-gray-400">
          Registra el recorrido desde el inicio hasta el máximo o mínimo alcanzado. El movimiento se da por terminado cuando el precio retrocede {reversalThreshold}% desde ese extremo.
        </p>
        <p className="text-xs text-amber-300 mt-2">Es una estadística descriptiva del precio; no predice el mercado ni constituye una recomendación de trading.</p>
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
                  {currentRun.direction === 'up' ? '+' : '-'}{currentMovePercent.toFixed(3)}%
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
                    {stats.avgDownMove.toFixed(3)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Máximo</p>
                  <p className="text-lg font-bold text-red-400">
                    {stats.maxDownMove.toFixed(3)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mínimo</p>
                  <p className="text-lg font-bold text-red-400">
                    {stats.minDownMove === Infinity ? '0.000' : stats.minDownMove.toFixed(3)}%
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

      <p className="-mt-4 text-xs text-gray-500">
        Las estadísticas y el gráfico usan los movimientos conservados: hasta 1.000 alcistas y 1.000 bajistas más recientes.
      </p>

      {/* Historial de runs recientes */}
      <div className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📜 Historial de Movimientos Recientes
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <label className="text-xs text-gray-400">Dirección
            <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as 'all' | 'up' | 'down')} className="mt-1 block w-full rounded bg-gray-950 border border-gray-700 p-2 text-white">
              <option value="all">Todas</option><option value="up">Alcistas</option><option value="down">Bajistas</option>
            </select>
          </label>
          <label className="text-xs text-gray-400">Desde
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block w-full rounded bg-gray-950 border border-gray-700 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Hasta
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block w-full rounded bg-gray-950 border border-gray-700 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Movimiento mínimo (%)
            <input type="number" min="0" step="0.1" value={minMove} onChange={(event) => setMinMove(event.target.value)} className="mt-1 block w-full rounded bg-gray-950 border border-gray-700 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Movimiento máximo (%)
            <input type="number" min="0" step="0.1" value={maxMove} onChange={(event) => setMaxMove(event.target.value)} className="mt-1 block w-full rounded bg-gray-950 border border-gray-700 p-2 text-white" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-xs text-gray-500">{filteredRuns.length} de {recentRuns.length} movimientos disponibles · se muestran hasta 100</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDirectionFilter('all'); setStartDate(''); setEndDate(''); setMinMove(''); setMaxMove(''); }} className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">Limpiar filtros</button>
            <button type="button" onClick={exportCsv} disabled={filteredRuns.length === 0} className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-40">Exportar CSV</button>
          </div>
        </div>

        {filteredRuns.length > 0 ? (
          <div className="space-y-2">
            {filteredRuns.slice(0, 100).map((run) => (
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
                    {run.movePercent.toFixed(3)}%
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
            <p className="text-sm">{recentRuns.length === 0 ? 'No hay movimientos completados aún' : 'No hay movimientos que coincidan con estos filtros'}</p>
            <p className="text-xs mt-1">
              Prueba a quitar filtros o espera a que se complete un movimiento (recorrido seguido de un retroceso de {reversalThreshold}%).
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
            <strong className="text-white">1. Punto de partida:</strong> se inicia un movimiento cuando el precio se separa al menos un 0,01% del precio de referencia.
          </p>
          <p>
            <strong className="text-white">2. Seguimiento:</strong> se guarda el máximo durante un tramo alcista o el mínimo durante uno bajista.
          </p>
          <p>
            <strong className="text-white">3. Final del tramo:</strong> se cierra cuando el precio retrocede {reversalThreshold}% desde el extremo. El tamaño informado es el recorrido desde el inicio hasta ese máximo o mínimo, no el retroceso.
          </p>
          <p>
            <strong className="text-white">4. Registro:</strong> cada tramo completado incluye dirección, precios, porcentaje de movimiento y duración. Los datos se guardan localmente en el servidor.
          </p>
          <p>
            <strong className="text-white">5. Límites e interpretación:</strong> se conservan como máximo los 1.000 tramos más recientes por dirección. Las estadísticas describen ese conjunto; no incluyen comisiones, financiación ni predicen resultados futuros.
          </p>
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Ejemplo:</strong> si el precio sube de $2.500 a $2.530 (+1,2%) y luego retrocede un 0,4% desde el máximo, se registra el tramo alcista de +1,2%. El retroceso sirve para detectar el cierre; no se resta del recorrido registrado.
          </p>
        </div>
      </div>
    </div>
  );
}
