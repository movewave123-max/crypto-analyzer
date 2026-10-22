import { useMemo, useState } from 'react';
import { DEFAULT_PAPER_STRATEGY_CONFIG, PaperStrategyConfig, PaperJournalEntry } from '../utils/paperTrading';

interface BacktestResult {
  symbol: string;
  interval: string;
  days: number;
  startTime: number;
  endTime: number;
  candleCount: number;
  config: PaperStrategyConfig;
  summary: {
    initialCapital: number;
    finalEquity: number;
    netPnl: number;
    returnPercent: number;
    maxDrawdownPercent: number;
    tradeCount: number;
    winRatePercent: number;
    profitFactor: number | null;
  };
  movementStats: {
    up: { count: number; averagePercent: number; minPercent: number | null; maxPercent: number };
    down: { count: number; averagePercent: number; minPercent: number | null; maxPercent: number };
  };
  priceSeries: { time: number; price: number }[];
  trades: PaperJournalEntry[];
  assumptions: string;
}

interface BacktestTabProps {
  defaultConfig?: PaperStrategyConfig;
}

const money = (value: number) => `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

interface BacktestMarker {
  time: number;
  price: number;
  tradeId: string;
  type: 'entry' | 'average' | 'exit';
  level?: number;
}

function BacktestPriceChart({ result, onSelectTrade }: { result: BacktestResult; onSelectTrade: (trade: PaperJournalEntry) => void }) {
  const [hoveredMarker, setHoveredMarker] = useState<BacktestMarker | null>(null);
  const width = 1000;
  const height = 360;
  const padding = { top: 24, right: 24, bottom: 48, left: 78 };
  const markers = useMemo<BacktestMarker[]>(() => result.trades.flatMap((trade) => [
    ...trade.entries.map((entry, index) => ({
      time: entry.timestamp,
      price: entry.fillPrice,
      tradeId: trade.id,
      type: index === 0 ? 'entry' as const : 'average' as const,
      level: entry.level,
    })),
    { time: trade.closedAt, price: trade.exitPrice, tradeId: trade.id, type: 'exit' as const },
  ]), [result.trades]);
  const chart = useMemo(() => {
    const series = result.priceSeries || [];
    if (!series.length) return null;
    const allPrices = [...series.map((point) => point.price), ...markers.map((marker) => marker.price)];
    const lowest = Math.min(...allPrices);
    const highest = Math.max(...allPrices);
    const range = highest - lowest || highest * 0.001 || 1;
    const minPrice = lowest - range * 0.06;
    const maxPrice = highest + range * 0.06;
    const minTime = result.startTime;
    const maxTime = result.endTime;
    const timeRange = maxTime - minTime || 1;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const x = (time: number) => padding.left + ((time - minTime) / timeRange) * plotWidth;
    const y = (price: number) => padding.top + ((maxPrice - price) / (maxPrice - minPrice)) * plotHeight;
    return {
      minPrice, maxPrice, minTime, maxTime, plotWidth, plotHeight, x, y,
      line: series.map((point) => `${x(point.time)},${y(point.price)}`).join(' '),
    };
  }, [markers, result]);

  const openTrade = (marker: BacktestMarker) => {
    const trade = result.trades.find((item) => item.id === marker.tradeId);
    if (trade) onSelectTrade(trade);
  };
  const markerLabel = (marker: BacktestMarker) => marker.type === 'exit'
    ? 'Salida'
    : marker.type === 'entry' ? 'Primera entrada' : `Promediado · nivel ${marker.level}`;

  return <section className="mt-4 rounded border border-gray-800 bg-gray-950/70 p-4">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="font-semibold text-white">Precio y operaciones</h4><p className="mt-1 text-xs text-gray-500">Pulsa cualquier marcador para abrir el detalle de la operación.</p></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400" aria-label="Leyenda del gráfico">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-green-400" />Primera entrada</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" />Promediado</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-400" />Salida</span>
      </div>
    </div>
    <div className="relative overflow-hidden rounded border border-gray-800 bg-gray-950">
      {chart ? <>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-64 w-full md:h-80" role="img" aria-label={`Precio ETHUSDT durante el backtest, con ${markers.length} marcadores de entrada, promediado y salida`}>
          {[0, 1, 2, 3, 4].map((step) => {
            const y = padding.top + (step / 4) * chart.plotHeight;
            const price = chart.maxPrice - (step / 4) * (chart.maxPrice - chart.minPrice);
            return <g key={step}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#374151" strokeDasharray="4 6" /><text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#9CA3AF" fontSize="12">{price.toFixed(2)}</text></g>;
          })}
          <polyline points={chart.line} fill="none" stroke="#60A5FA" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {markers.map((marker, index) => {
            const colors = marker.type === 'entry' ? { fill: '#34D399', stroke: '#064E3B' }
              : marker.type === 'average' ? { fill: '#FBBF24', stroke: '#78350F' }
                : { fill: '#F87171', stroke: '#7F1D1D' };
            const label = markerLabel(marker);
            return <circle key={`${marker.tradeId}-${marker.type}-${marker.level ?? index}`} cx={chart.x(marker.time)} cy={chart.y(marker.price)} r={marker.type === 'exit' ? 6 : 5.5} fill={colors.fill} stroke={colors.stroke} strokeWidth="2" className="cursor-pointer" role="button" tabIndex={0} aria-label={`${label}, ${new Date(marker.time).toLocaleString()}, ${marker.price.toFixed(2)} USDT. Abrir operación.`} onClick={() => openTrade(marker)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTrade(marker); } }} onPointerEnter={() => setHoveredMarker(marker)} onPointerLeave={() => setHoveredMarker(null)}><title>{label} · {new Date(marker.time).toLocaleString()} · {marker.price.toFixed(2)} USDT · pulsa para ver operación</title></circle>;
          })}
          {[0, 1, 2, 3, 4].map((step) => {
            const time = chart.minTime + (step / 4) * (chart.maxTime - chart.minTime);
            const label = chart.maxTime - chart.minTime >= 48 * 60 * 60 * 1000
              ? new Date(time).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
              : new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return <text key={step} x={padding.left + (step / 4) * chart.plotWidth} y={height - 18} textAnchor={step === 0 ? 'start' : step === 4 ? 'end' : 'middle'} fill="#9CA3AF" fontSize="12">{label}</text>;
          })}
        </svg>
        {hoveredMarker && <div className="pointer-events-none absolute left-3 top-3 rounded border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-lg">
          <p className="text-xs font-semibold text-white">{markerLabel(hoveredMarker)}</p><p className="mt-0.5 font-mono text-sm text-blue-200">{hoveredMarker.price.toFixed(2)} USDT</p><p className="text-[11px] text-gray-400">{new Date(hoveredMarker.time).toLocaleString()}</p>
        </div>}
      </> : <div className="flex h-64 items-center justify-center text-sm text-gray-500">No hay precios disponibles para dibujar el gráfico.</div>}
    </div>
    <p className="mt-2 text-[11px] text-gray-500">La línea muestra cierres de vela muestreados para mantener el gráfico ágil. Los marcadores usan los precios y horas de ejecución simulados.</p>
  </section>;
}

function EquityCurve({ result }: { result: BacktestResult }) {
  const points = useMemo(() => {
    let balance = result.summary.initialCapital;
    const values = [balance, ...result.trades.map((trade) => (balance += trade.pnl))];
    if (values.length === 1) values.push(balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || Math.max(1, max * 0.01);
    return values.map((value, index) => `${(index / (values.length - 1)) * 100},${94 - ((value - min) / spread) * 84}`).join(' ');
  }, [result]);

  return (
    <div className="mt-4 rounded border border-gray-800 bg-gray-950/70 p-3">
      <div className="mb-2 flex justify-between text-xs text-gray-500"><span>Capital por operación cerrada</span><span>Solo PnL realizado</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Curva de equity del backtest">
        <line x1="0" y1="94" x2="100" y2="94" stroke="#374151" strokeDasharray="1 2" />
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function BacktestTab({ defaultConfig = DEFAULT_PAPER_STRATEGY_CONFIG }: BacktestTabProps) {
  const [config, setConfig] = useState<PaperStrategyConfig>(defaultConfig);
  const [interval, setInterval] = useState('1m');
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<PaperJournalEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const diagnostics = useMemo(() => {
    if (!result) return null;
    const summarizeSide = (side: 'long' | 'short') => {
      const sideTrades = result.trades.filter((trade) => trade.side === side);
      const wins = sideTrades.filter((trade) => trade.pnl > 0).length;
      return {
        count: sideTrades.length,
        netPnl: sideTrades.reduce((sum, trade) => sum + trade.pnl, 0),
        winRate: sideTrades.length ? (wins / sideTrades.length) * 100 : 0,
      };
    };
    const trades = result.trades;
    return {
      averageDuration: trades.length ? trades.reduce((sum, trade) => sum + trade.closedAt - trade.openedAt, 0) / trades.length : 0,
      averageFavorablePnl: trades.length ? trades.reduce((sum, trade) => sum + (trade.maxFavorablePnl || 0), 0) / trades.length : 0,
      averageAdversePnl: trades.length ? trades.reduce((sum, trade) => sum + (trade.maxAdversePnl || 0), 0) / trades.length : 0,
      long: summarizeSide('long'),
      short: summarizeSide('short'),
    };
  }, [result]);

  const runBacktest = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, days, config }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo completar el backtest.');
      setResult(data as BacktestResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Error al ejecutar el backtest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-purple-700/50 bg-gradient-to-br from-purple-900/20 to-gray-900 p-6">
        <h2 className="text-2xl font-bold text-white">Backtesting histórico</h2>
        <p className="mt-2 text-sm text-gray-300">Simula la misma estrategia virtual sobre velas históricas de ETHUSDT Perpetual de Binance Futures. El resultado no modifica la cuenta ni el diario de la simulación en vivo.</p>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Periodo y parámetros</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-gray-400">Intervalo de vela
            <select value={interval} onChange={(event) => setInterval(event.target.value)} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white">
              <option value="1m">1 minuto · más detalle</option><option value="5m">5 minutos</option><option value="15m">15 minutos</option><option value="1h">1 hora</option>
            </select>
          </label>
          <label className="text-xs text-gray-400">Días históricos
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white">
            <option value={1}>1 día</option><option value={7}>7 días</option><option value={30}>30 días</option><option value={90} disabled={interval === '1m'}>90 días{interval === '1m' ? ' (elige un intervalo mayor)' : ''}</option>
            </select>
          </label>
          <label className="text-xs text-gray-400">Capital inicial (USDT)
            <input type="number" min="1" step="100" value={config.initialCapital} onChange={(event) => setConfig({ ...config, initialCapital: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Primera orden (% del capital)
            <input type="number" min="0.01" max="20" step="0.1" value={config.initialOrderPercent} onChange={(event) => setConfig({ ...config, initialOrderPercent: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Número de niveles (1–10)
            <input type="number" min="1" max="10" step="1" value={config.levels} onChange={(event) => setConfig({ ...config, levels: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white" />
          </label>
          <label className="text-xs text-gray-400">Stop loss (% del capital virtual)
            <input type="number" min="0.01" max="100" step="0.1" value={config.stopLossPercent} onChange={(event) => setConfig({ ...config, stopLossPercent: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white" />
          </label>
        </div>
        <button type="button" disabled={loading} onClick={() => void runBacktest()} className="mt-5 rounded bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50">
          {loading ? 'Descargando velas y simulando…' : 'Ejecutar backtest'}
        </button>
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      </section>

      {result && <>
        <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-white">Resultados</h3><p className="mt-1 text-xs text-gray-500">{new Date(result.startTime).toLocaleString()} – {new Date(result.endTime).toLocaleString()} · {result.candleCount.toLocaleString()} velas de {result.interval}</p></div>
            <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">ETHUSDT Perpetual</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded border border-gray-800 bg-gray-950/70 p-3"><p className="text-xs text-gray-500">PnL neto bruto</p><p className={`mt-1 font-bold ${result.summary.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(result.summary.netPnl)}</p><p className="text-xs text-gray-500">{result.summary.returnPercent.toFixed(2)}%</p></div>
            <div className="rounded border border-gray-800 bg-gray-950/70 p-3"><p className="text-xs text-gray-500">Equity final</p><p className="mt-1 font-bold text-white">{money(result.summary.finalEquity)}</p></div>
            <div className="rounded border border-gray-800 bg-gray-950/70 p-3"><p className="text-xs text-gray-500">Máximo drawdown</p><p className="mt-1 font-bold text-red-300">{result.summary.maxDrawdownPercent.toFixed(2)}%</p></div>
            <div className="rounded border border-gray-800 bg-gray-950/70 p-3"><p className="text-xs text-gray-500">Operaciones · acierto</p><p className="mt-1 font-bold text-white">{result.summary.tradeCount} · {result.summary.winRatePercent.toFixed(1)}%</p><p className="text-xs text-gray-500">Profit factor: {result.summary.profitFactor === null ? '∞' : result.summary.profitFactor.toFixed(2)}</p></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-gray-800 bg-gray-950/70 p-4">
              <h4 className="font-semibold text-white">Resultados por dirección</h4>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(['long', 'short'] as const).map((side) => {
                  const stats = diagnostics?.[side];
                  return <div key={side} className="rounded border border-gray-800 p-3"><p className={`text-sm font-semibold ${side === 'long' ? 'text-green-300' : 'text-red-300'}`}>{side.toUpperCase()}</p><p className={`mt-1 font-semibold ${stats && stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(stats?.netPnl || 0)}</p><p className="mt-1 text-xs text-gray-500">{stats?.count || 0} operaciones · acierto {stats?.winRate.toFixed(1) || '0.0'}%</p></div>;
                })}
              </div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-950/70 p-4">
              <h4 className="font-semibold text-white">Comportamiento medio por operación</h4>
              <p className="mt-1 text-xs text-gray-500">Beneficio/pérdida flotante máximos antes del cierre; se miden en USDT.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><p className="text-xs text-gray-500">Duración media</p><p className="mt-1 text-sm font-semibold text-white">{formatDuration(diagnostics?.averageDuration || 0)}</p></div>
                <div><p className="text-xs text-gray-500">Beneficio flotante máx.</p><p className="mt-1 text-sm font-semibold text-green-400">{money(diagnostics?.averageFavorablePnl || 0)}</p></div>
                <div><p className="text-xs text-gray-500">Pérdida flotante máx.</p><p className="mt-1 text-sm font-semibold text-red-400">{money(diagnostics?.averageAdversePnl || 0)}</p></div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded border border-gray-800 bg-gray-950/70 p-4">
            <h4 className="font-semibold text-white">Movimientos usados para calcular los niveles</h4>
            <p className="mt-1 text-xs text-gray-500">Tramos completados durante el periodo. Al iniciar cada nuevo tramo, la estrategia calcula su promedio con los tramos anteriores disponibles, sin usar datos futuros.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-green-900/70 bg-green-950/20 p-3">
                <p className="text-sm font-semibold text-green-300">Alcistas · {result.movementStats.up.count} tramos</p>
                <p className="mt-1 text-xs text-gray-300">Promedio {result.movementStats.up.averagePercent.toFixed(3)}% · mínimo {result.movementStats.up.minPercent === null ? '—' : `${result.movementStats.up.minPercent.toFixed(3)}%`} · máximo {result.movementStats.up.maxPercent.toFixed(3)}%</p>
              </div>
              <div className="rounded border border-red-900/70 bg-red-950/20 p-3">
                <p className="text-sm font-semibold text-red-300">Bajistas · {result.movementStats.down.count} tramos</p>
                <p className="mt-1 text-xs text-gray-300">Promedio {result.movementStats.down.averagePercent.toFixed(3)}% · mínimo {result.movementStats.down.minPercent === null ? '—' : `${result.movementStats.down.minPercent.toFixed(3)}%`} · máximo {result.movementStats.down.maxPercent.toFixed(3)}%</p>
              </div>
            </div>
          </div>
          <BacktestPriceChart result={result} onSelectTrade={setSelectedTrade} />
          <EquityCurve result={result} />
          <p className="mt-3 text-xs text-amber-300/80">{result.assumptions}</p>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold text-white">Operaciones del backtest</h3><p className="text-xs text-gray-500">{result.trades.length} cierres</p></div>
          {result.trades.length ? <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="sticky top-0 bg-gray-900 text-gray-500"><tr><th className="p-2" title="Momento en que se ejecutó la primera orden de la posición">Primera ejecución</th><th>Cierre</th><th>Duración</th><th>Lado</th><th>Órdenes</th><th>Precio medio</th><th>Salida</th><th>PnL bruto</th><th>Motivo</th><th>Detalles</th></tr></thead><tbody>{[...result.trades].reverse().map((trade) => <tr key={trade.id} className="border-t border-gray-800 text-gray-300"><td className="p-2" title="Las órdenes de promediado posteriores pueden ejecutarse en otros momentos">{new Date(trade.openedAt).toLocaleString()}</td><td>{new Date(trade.closedAt).toLocaleString()}</td><td>{formatDuration(trade.closedAt - trade.openedAt)}</td><td className={trade.side === 'long' ? 'text-green-400' : 'text-red-400'}>{trade.side.toUpperCase()}</td><td>{trade.orderCount}</td><td>{trade.averageEntryPrice.toFixed(2)}</td><td>{trade.exitPrice.toFixed(2)}</td><td className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{money(trade.pnl)}</td><td>{trade.reason === 'take_profit' ? 'Retroceso 0,4%' : trade.reason === 'stop_loss' ? 'Stop loss' : 'Fin del periodo'}</td><td><button type="button" onClick={() => setSelectedTrade(trade)} className="rounded border border-gray-700 px-2 py-1 text-blue-300 hover:bg-gray-800">Ver</button></td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-gray-500">No hubo operaciones cerradas en este periodo.</p>}
        </section>
      </>}
      {selectedTrade && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrade(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="trade-details-title" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><h3 id="trade-details-title" className="text-lg font-semibold text-white">Detalle de la operación · {selectedTrade.side.toUpperCase()}</h3><p className="mt-1 text-xs text-gray-400">Primera ejecución: {new Date(selectedTrade.openedAt).toLocaleString()} · Cierre: {new Date(selectedTrade.closedAt).toLocaleString()}</p></div><button type="button" onClick={() => setSelectedTrade(null)} aria-label="Cerrar detalle" className="rounded px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white">✕</button></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Precio medio</p><p className="mt-1 text-sm text-white">{selectedTrade.averageEntryPrice.toFixed(2)} USDT</p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Precio de salida</p><p className="mt-1 text-sm text-white">{selectedTrade.exitPrice.toFixed(2)} USDT</p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">PnL bruto</p><p className={`mt-1 text-sm ${selectedTrade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(selectedTrade.pnl)}</p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Duración</p><p className="mt-1 text-sm text-white">{formatDuration(selectedTrade.closedAt - selectedTrade.openedAt)}</p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Máx. beneficio flotante</p><p className="mt-1 text-sm text-green-400">{money(selectedTrade.maxFavorablePnl || 0)} <span className="text-xs">({(selectedTrade.maxFavorablePercent || 0).toFixed(2)}%)</span></p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Máx. pérdida flotante</p><p className="mt-1 text-sm text-red-400">{money(selectedTrade.maxAdversePnl || 0)} <span className="text-xs">({(selectedTrade.maxAdversePercent || 0).toFixed(2)}%)</span></p></div><div className="rounded border border-gray-800 p-3"><p className="text-xs text-gray-500">Movimiento promedio usado</p><p className="mt-1 text-sm text-white">{selectedTrade.averageMovePercent.toFixed(3)}%</p></div></div>
          <h4 className="mb-2 mt-5 font-semibold text-white">Entradas ejecutadas</h4>
          {selectedTrade.entries.length ? <div className="overflow-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-gray-950 text-gray-500"><tr><th className="p-2">Nivel</th><th>Ejecución</th><th>Precio</th><th>Objetivo del tramo</th><th>Notional</th><th>Cantidad</th></tr></thead><tbody>{selectedTrade.entries.map((entry) => <tr key={`${selectedTrade.id}-${entry.level}`} className="border-t border-gray-800 text-gray-300"><td className="p-2">{entry.level}</td><td>{new Date(entry.timestamp).toLocaleString()}</td><td>{entry.fillPrice.toFixed(2)} USDT</td><td>{entry.targetMovePercent.toFixed(3)}%</td><td>{money(entry.notional)}</td><td>{entry.quantity.toFixed(6)} ETH</td></tr>)}</tbody></table></div> : <p className="text-sm text-gray-400">No hay entradas registradas.</p>}
          <div className="mt-4 flex justify-end"><button type="button" onClick={() => setSelectedTrade(null)} className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600">Cerrar</button></div>
        </section>
      </div>}
    </div>
  );
}
