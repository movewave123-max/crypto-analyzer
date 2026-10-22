import { useEffect, useState } from 'react';
import { DirectionalState } from '../utils/directionalMovement';
import { DEFAULT_PAPER_STRATEGY_CONFIG, PaperStrategyConfig, PaperStrategyState } from '../utils/paperTrading';

interface StrategyTabProps {
  state: PaperStrategyState;
  directionalState: DirectionalState;
  currentPrice: number;
  isConnected: boolean;
  onStart: (config: PaperStrategyConfig) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onReset: () => Promise<unknown>;
}

const money = (value: number) => `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

export default function StrategyTab({ state, directionalState, currentPrice, isConnected, onStart, onStop, onReset }: StrategyTabProps) {
  const [config, setConfig] = useState<PaperStrategyConfig>(DEFAULT_PAPER_STRATEGY_CONFIG);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfig({
      initialCapital: state.config.initialCapital,
      initialOrderPercent: state.config.initialOrderPercent,
      levels: state.config.levels,
      stopLossPercent: state.config.stopLossPercent,
    });
  }, [state.config.initialCapital, state.config.initialOrderPercent, state.config.levels, state.config.stopLossPercent]);

  const position = state.position;
  const unrealizedPnl = position
    ? position.side === 'long'
      ? position.quantity * currentPrice - position.notional
      : position.notional - position.quantity * currentPrice
    : 0;
  const tpPrice = position ? position.extremePrice * (position.side === 'long' ? 1 + 0.004 : 1 - 0.004) : 0;
  const stopLossAmount = position ? position.capitalBasis * state.config.stopLossPercent / 100 : 0;
  const stopPrice = position
    ? position.side === 'long'
      ? Math.max(0, (position.notional - stopLossAmount) / position.quantity)
      : (position.notional + stopLossAmount) / position.quantity
    : 0;

  const runAction = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo completar la acción.');
    } finally {
      setWorking(false);
    }
  };

  const resetAccount = () => {
    if (window.confirm('¿Reiniciar el capital virtual y borrar el diario de esta simulación?')) {
      void runAction(onReset);
    }
  };

  const avgDown = Math.abs(directionalState.stats.avgDownMove);
  const avgUp = Math.abs(directionalState.stats.avgUpMove);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-blue-700/50 bg-gradient-to-br from-blue-900/20 to-gray-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Simulación de estrategia</h2>
            <p className="mt-2 text-sm text-gray-300">Promedia una posición larga durante los tramos bajistas y una corta durante los alcistas. Cierra al retroceder 0,4% desde el extremo.</p>
          </div>
          <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">SOLO SIMULACIÓN · SIN ÓRDENES REALES</span>
        </div>
        <p className="mt-3 text-xs text-gray-400">PnL bruto estimado: no descuenta comisiones, financiación, deslizamiento ni requisitos de margen. Una toma de beneficios por retroceso puede cerrar con pérdida si las entradas no compensan el movimiento previo.</p>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Configuración de la cuenta virtual</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-gray-400">Capital inicial (USDT)
            <input type="number" min="1" step="100" value={config.initialCapital} disabled={state.running || state.journal.length > 0} onChange={(event) => setConfig({ ...config, initialCapital: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white disabled:opacity-50" />
          </label>
          <label className="text-xs text-gray-400">Primera orden (% del capital)
            <input type="number" min="0.01" max="20" step="0.1" value={config.initialOrderPercent} disabled={state.running} onChange={(event) => setConfig({ ...config, initialOrderPercent: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white disabled:opacity-50" />
          </label>
          <label className="text-xs text-gray-400">Número de niveles (1–10)
            <input type="number" min="1" max="10" step="1" value={config.levels} disabled={state.running} onChange={(event) => setConfig({ ...config, levels: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white disabled:opacity-50" />
          </label>
          <label className="text-xs text-gray-400">Stop loss (% del capital virtual)
            <input type="number" min="0.01" max="100" step="0.1" value={config.stopLossPercent} disabled={state.running} onChange={(event) => setConfig({ ...config, stopLossPercent: Number(event.target.value) })} className="mt-1 block w-full rounded border border-gray-700 bg-gray-950 p-2 text-white disabled:opacity-50" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!state.running ? (
            <button type="button" disabled={working || !isConnected || currentPrice <= 0} onClick={() => void runAction(() => onStart(config))} className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40">{working ? 'Iniciando…' : 'Iniciar estrategia'}</button>
          ) : (
            <button type="button" disabled={working} onClick={() => void runAction(onStop)} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40">{working ? 'Deteniendo…' : 'Detener y cerrar posición'}</button>
          )}
          <button type="button" disabled={working || state.running} onClick={resetAccount} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40">Reiniciar cuenta y diario</button>
          {!isConnected && <p className="text-xs text-yellow-300">Necesitas una conexión activa a Binance para iniciar.</p>}
          {state.journal.length > 0 && !state.running && <p className="text-xs text-gray-500">Para cambiar el capital inicial, reinicia antes la cuenta y el diario.</p>}
        </div>
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
        <p className="mt-3 text-xs text-gray-500" role="status">{state.lastMessage}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-4"><p className="text-xs text-gray-500">Capital inicial</p><p className="mt-1 text-lg font-bold text-white">{money(state.account.initialCapital)}</p></div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-4"><p className="text-xs text-gray-500">Equity virtual</p><p className="mt-1 text-lg font-bold text-white">{money(state.account.equity)}</p></div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-4"><p className="text-xs text-gray-500">PnL realizado</p><p className={`mt-1 text-lg font-bold ${state.account.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(state.account.realizedPnl)}</p></div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-4"><p className="text-xs text-gray-500">PnL no realizado</p><p className={`mt-1 text-lg font-bold ${state.account.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(state.account.unrealizedPnl)}</p></div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Posición simulada</h3>
        {position ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><p className="text-xs text-gray-500">Lado</p><p className={`text-lg font-bold ${position.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>{position.side === 'long' ? 'LONG · compra' : 'SHORT · venta'}</p></div>
              <div><p className="text-xs text-gray-500">Precio medio</p><p className="font-mono text-white">{(position.notional / position.quantity).toFixed(2)} USDT</p></div>
              <div><p className="text-xs text-gray-500">Exposición simulada</p><p className="font-mono text-white">{money(position.notional)}</p></div>
              <div><p className="text-xs text-gray-500">Órdenes ejecutadas</p><p className="font-mono text-white">{position.entries.length} / {state.config.levels}</p></div>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><p className="text-xs text-gray-500">PnL flotante</p><p className={`font-semibold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(unrealizedPnl)}</p></div>
              <div><p className="text-xs text-gray-500">Extremo desde entrada</p><p className="font-mono text-white">{position.extremePrice.toFixed(2)} USDT</p></div>
              <div><p className="text-xs text-gray-500">Take profit estimado</p><p className="font-mono text-green-300">{tpPrice.toFixed(2)} USDT</p></div>
              <div><p className="text-xs text-gray-500">Nivel de stop estimado</p><p className="font-mono text-red-300">{stopPrice.toFixed(2)} USDT</p></div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-gray-500"><tr><th className="py-2">Nivel</th><th>Desplazamiento objetivo</th><th>Importe</th><th>Precio ejecutado</th><th>Estado</th></tr></thead><tbody>{Array.from({ length: state.config.levels }, (_, i) => {
              const fraction = state.config.levels === 1 ? 0.25 : 0.25 + (0.75 * i) / (state.config.levels - 1);
              const target = position.averageMovePercent * fraction;
              const notional = position.capitalBasis * state.config.initialOrderPercent / 100 * (2 ** i);
              const entry = position.entries.find((item) => item.level === i + 1);
              return <tr key={i} className="border-t border-gray-800 text-gray-300"><td className="py-2">{i + 1}</td><td>{target.toFixed(3)}%</td><td>{money(notional)}</td><td>{entry ? `${entry.fillPrice.toFixed(2)} USDT` : '—'}</td><td>{entry ? 'Ejecutada' : 'Pendiente'}</td></tr>;
            })}</tbody></table></div>
          </>
        ) : (
          <div className="space-y-2 text-sm text-gray-400">
            <p>{state.running ? 'No hay una posición abierta. La simulación espera el siguiente tramo nuevo y sus niveles de entrada.' : 'No hay una posición abierta. Inicia la simulación para que el servidor gestione las próximas entradas.'}</p>
            <p>Promedio histórico disponible: bajista {avgDown.toFixed(3)}% ({directionalState.downRuns.length} tramos), alcista {avgUp.toFixed(3)}% ({directionalState.upRuns.length} tramos).</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/80 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">Diario de operaciones simuladas</h3>
          <p className="text-xs text-gray-500">{state.journal.length} cierres · se conservan los últimos 500</p>
        </div>
        {state.journal.length ? (
          <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-gray-900 text-gray-500"><tr><th className="p-2">Cierre</th><th>Lado</th><th>Órdenes</th><th>Precio medio</th><th>Salida</th><th>PnL bruto</th><th>Resultado</th></tr></thead><tbody>{state.journal.map((trade) => <tr key={trade.id} className="border-t border-gray-800 text-gray-300"><td className="p-2">{new Date(trade.closedAt).toLocaleString()}</td><td className={trade.side === 'long' ? 'text-green-400' : 'text-red-400'}>{trade.side.toUpperCase()}</td><td>{trade.orderCount}</td><td>{trade.averageEntryPrice.toFixed(2)}</td><td>{trade.exitPrice.toFixed(2)}</td><td className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{money(trade.pnl)}</td><td>{trade.reason === 'take_profit' ? 'Retroceso 0,4%' : trade.reason === 'stop_loss' ? 'Stop loss' : 'Detención manual'}</td></tr>)}</tbody></table></div>
        ) : <p className="py-8 text-center text-sm text-gray-500">Las operaciones cerradas aparecerán aquí.</p>}
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-5 text-sm text-gray-400">
        <h3 className="mb-2 font-semibold text-gray-200">Reglas de la simulación</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>El servidor toma el promedio histórico de tramos alcistas/bajistas ya completados y fija ese promedio al iniciar cada tramo.</li>
          <li>Los niveles se reparten desde el 25% hasta el 100% del promedio; con cuatro niveles son 25%, 50%, 75% y 100%.</li>
          <li>La primera orden equivale al porcentaje configurado del equity al empezar el tramo; las siguientes duplican el importe.</li>
          <li>El take profit cierra la posición completa al retroceder 0,4% desde el extremo. El stop loss cierra si la pérdida flotante alcanza el porcentaje configurado del capital usado como base del tramo.</li>
          <li>Al detener, cualquier posición abierta se cierra al precio actual. El estado y el diario se guardan en el servidor local.</li>
        </ul>
      </section>
    </div>
  );
}
