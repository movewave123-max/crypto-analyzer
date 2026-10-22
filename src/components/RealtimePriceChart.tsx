import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

interface PriceSample {
  time: number;
  price: number;
}

interface RealtimePriceChartProps {
  currentPrice: number;
  isConnected: boolean;
}

const SAMPLE_INTERVAL_MS = 100;
const WINDOWS = [60, 300, 900] as const;
const MAX_WINDOW_SECONDS = Math.max(...WINDOWS);

export default function RealtimePriceChart({ currentPrice, isConnected }: RealtimePriceChartProps) {
  const [windowSeconds, setWindowSeconds] = useState<number>(60);
  const [samples, setSamples] = useState<PriceSample[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; sample: PriceSample } | null>(null);
  const latestPrice = useRef(currentPrice);
  latestPrice.current = currentPrice;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/price-history')
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo recuperar el historial de precios.');
        return response.json() as Promise<{ samples?: PriceSample[] }>;
      })
      .then((data) => {
        if (!cancelled) setSamples(Array.isArray(data.samples) ? data.samples : []);
      })
      .catch(() => {
        // Aunque no se recupere el historial, la gráfica debe seguir muestreando precios nuevos.
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    const addSample = () => {
      const price = latestPrice.current;
      if (!(price > 0)) return;
      const time = Date.now();
      // Conservar siempre el máximo historial disponible; el selector solo cambia
      // el tramo visible y no debe borrar muestras al pasar temporalmente a 1m o 5m.
      const cutoff = time - MAX_WINDOW_SECONDS * 1000;
      setSamples((previous) => [...previous.filter((sample) => sample.time >= cutoff), { time, price }]);
    };

    addSample();
    const timer = window.setInterval(addSample, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [historyLoaded]);

  const chart = useMemo(() => {
    const cutoff = Date.now() - windowSeconds * 1000;
    const visible = samples.filter((sample) => sample.time >= cutoff);
    if (!visible.length) return null;

    const low = Math.min(...visible.map((sample) => sample.price));
    const high = Math.max(...visible.map((sample) => sample.price));
    const spread = high - low || high * 0.0002 || 1;
    const min = low - spread * 0.12;
    const max = high + spread * 0.12;
    const points = visible.map((sample, index) => {
      const x = visible.length === 1 ? 1000 : (index / (visible.length - 1)) * 1000;
      const y = 270 - ((sample.price - min) / (max - min)) * 240;
      return { x, y, sample };
    });
    return {
      low,
      high,
      current: visible[visible.length - 1].price,
      polyline: points.map(({ x, y }) => `${x},${y}`).join(' '),
      points,
      lastPoint: points[points.length - 1],
      min,
      max,
    };
  }, [samples, windowSeconds]);

  const timeLabel = windowSeconds < 60 ? `${windowSeconds}s` : `${windowSeconds / 60} min`;

  const inspectPoint = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart || chart.points.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const index = Math.round(ratio * (chart.points.length - 1));
    setHoveredPoint(chart.points[index]);
  };

  return (
    <section className="rounded-lg border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-5 md:p-6" aria-label="Gráfico del precio en tiempo real">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Precio en tiempo real</h2>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} aria-label={isConnected ? 'Conectado' : 'Desconectado'} />
          </div>
          <p className="mt-1 text-xs text-gray-500">ETHUSDT · Último precio negociado · muestreo visual cada 100 ms</p>
        </div>
        <div className="flex items-end gap-4">
          {chart && <div className="text-right"><p className="font-mono text-xl font-bold text-white">{chart.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">USDT</p></div>}
          <div className="flex rounded border border-gray-700 p-0.5" role="group" aria-label="Ventana temporal del gráfico">
            {WINDOWS.map((seconds) => <button key={seconds} type="button" onClick={() => { setWindowSeconds(seconds); setHoveredPoint(null); }} aria-pressed={windowSeconds === seconds} className={`rounded px-2 py-1 text-xs transition-colors ${windowSeconds === seconds ? 'bg-blue-500/20 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</button>)}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded border border-gray-700 bg-gray-950/70">
        {chart ? (
          <svg
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            className="h-56 w-full touch-pan-y md:h-72"
            role="img"
            aria-label={`Precio ETHUSDT durante los últimos ${timeLabel}: mínimo ${chart.low.toFixed(2)}, máximo ${chart.high.toFixed(2)} USDT. Mueve el cursor por el gráfico para consultar el precio.`}
            onPointerMove={inspectPoint}
            onPointerLeave={() => setHoveredPoint(null)}
          >
            {[0, 1, 2, 3].map((line) => {
              const y = 30 + line * 80;
              const value = chart.max - ((y - 30) / 240) * (chart.max - chart.min);
              return <g key={line}><line x1="0" x2="1000" y1={y} y2={y} stroke="#374151" strokeDasharray="4 6" /><text x="8" y={y - 5} fill="#6B7280" fontSize="13">{value.toFixed(2)}</text></g>;
            })}
            <polyline points={chart.polyline} fill="none" stroke="#60A5FA" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {hoveredPoint && <>
              <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1="30" y2="270" stroke="#9CA3AF" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#F9FAFB" stroke="#3B82F6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>}
            <circle cx={chart.lastPoint.x} cy={chart.lastPoint.y} r="4" fill="#93C5FD" />
          </svg>
        ) : (
          <div className="flex h-56 items-center justify-center text-sm text-gray-500 md:h-72">{historyLoaded ? 'Esperando el primer precio de Binance…' : 'Recuperando historial del servidor…'}</div>
        )}
        {hoveredPoint && chart && <div className="pointer-events-none absolute right-3 top-3 rounded border border-gray-700 bg-gray-900/95 px-3 py-2 text-right shadow-lg">
          <p className="font-mono text-sm font-semibold text-white">{hoveredPoint.sample.price.toFixed(2)} USDT</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{new Date(hoveredPoint.sample.time).toLocaleTimeString()}</p>
        </div>}
      </div>
      <div className="mt-3 flex justify-between text-xs text-gray-500"><span>Ventana: {timeLabel}</span>{chart && <span>Mín. {chart.low.toFixed(2)} · Máx. {chart.high.toFixed(2)} USDT</span>}</div>
    </section>
  );
}
