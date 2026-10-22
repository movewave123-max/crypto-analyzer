const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'dist')));

const BINANCE_API = 'https://fapi.binance.com/fapi/v1';
const DATA_FILE = path.join(__dirname, 'server-data.json');
const REVERSAL_THRESHOLD = 0.4; // 0.4%
// Retener solo los movimientos recientes para acotar memoria, persistencia y tráfico WebSocket.
const MAX_RUNS_PER_DIRECTION = 1000;
const MAX_STRATEGY_JOURNAL = 500;
const TAKE_PROFIT_RETRACE_PERCENT = REVERSAL_THRESHOLD;
const PRICE_HISTORY_INTERVAL_MS = 100;
const PRICE_HISTORY_WINDOW_MS = 15 * 60 * 1000;
const MAX_PRICE_HISTORY_SAMPLES = PRICE_HISTORY_WINDOW_MS / PRICE_HISTORY_INTERVAL_MS;

// Crear estado inicial de movimiento direccional
function createDirectionalState() {
  return {
    currentRun: {
      direction: null,
      startPrice: 0,
      extremePrice: 0,
      startTime: 0,
      extremeTime: 0,
    },
    upRuns: [],
    downRuns: [],
    stats: {
      avgUpMove: 0,
      avgDownMove: 0,
      maxUpMove: 0,
      maxDownMove: 0,
      minUpMove: Infinity,
      minDownMove: Infinity,
      totalUpRuns: 0,
      totalDownRuns: 0,
      avgUpDuration: 0,
      avgDownDuration: 0,
    },
    reversalThreshold: REVERSAL_THRESHOLD,
  };
}

// Actualizar estado direccional con nuevo precio
function updateDirectionalState(state, price, now) {
  // Inicializar si es el primer precio
  if (state.currentRun.direction === null && state.currentRun.startPrice === 0) {
    return {
      ...state,
      currentRun: {
        direction: null,
        startPrice: price,
        extremePrice: price,
        startTime: now,
        extremeTime: now,
      },
    };
  }

  const { currentRun, reversalThreshold } = state;
  const { direction, startPrice, extremePrice, startTime } = currentRun;

  // Si aún no hay dirección establecida, esperar a ver si sube o baja
  if (direction === null) {
    const changeFromStart = ((price - startPrice) / startPrice) * 100;
    
    if (Math.abs(changeFromStart) >= 0.01) { // Umbral mínimo para establecer dirección
      return {
        ...state,
        currentRun: {
          direction: changeFromStart > 0 ? 'up' : 'down',
          startPrice,
          extremePrice: price,
          startTime,
          extremeTime: now,
        },
      };
    }
    return state;
  }

  // Actualizar extremo si el precio sigue en la dirección del run
  let newExtremePrice = extremePrice;
  let newExtremeTime = currentRun.extremeTime || startTime;
  if (direction === 'up' && price > extremePrice) {
    newExtremePrice = price;
    newExtremeTime = now;
  } else if (direction === 'down' && price < extremePrice) {
    newExtremePrice = price;
    newExtremeTime = now;
  }

  // Calcular retroceso desde el extremo
  let reversalPercent = 0;
  if (direction === 'up') {
    reversalPercent = ((newExtremePrice - price) / newExtremePrice) * 100;
  } else {
    reversalPercent = ((price - newExtremePrice) / newExtremePrice) * 100;
  }

  // Si el retroceso alcanza el umbral, completar el run
  if (reversalPercent >= reversalThreshold) {
    const moveAmount = direction === 'up' 
      ? newExtremePrice - startPrice
      : startPrice - newExtremePrice;
    
    // Para movimientos bajistas, el porcentaje debe ser negativo
    const movePercent = direction === 'up'
      ? (moveAmount / startPrice) * 100
      : -(moveAmount / startPrice) * 100;
    
    const duration = now - startTime;

    const completedRun = {
      id: `${now}-${direction}`,
      direction,
      startPrice,
      endPrice: price,
      extremePrice: newExtremePrice,
      movePercent,
      moveAmount,
      startTime,
      endTime: now,
      duration,
    };

    // Actualizar listas de runs
    const newUpRuns = direction === 'up' ? [...state.upRuns, completedRun].slice(-MAX_RUNS_PER_DIRECTION) : state.upRuns;
    const newDownRuns = direction === 'down' ? [...state.downRuns, completedRun].slice(-MAX_RUNS_PER_DIRECTION) : state.downRuns;

    // Calcular nuevas estadísticas
    const newStats = calculateStats(newUpRuns, newDownRuns);

    // Iniciar nuevo run en dirección contraria
    return {
      ...state,
      currentRun: {
        direction: direction === 'up' ? 'down' : 'up',
        startPrice: newExtremePrice,
        extremePrice: price,
        startTime: newExtremeTime,
        extremeTime: now,
      },
      upRuns: newUpRuns,
      downRuns: newDownRuns,
      stats: newStats,
    };
  }

  // Si no hay reversa significativa, solo actualizar el extremo
  return {
    ...state,
    currentRun: {
      ...currentRun,
      extremePrice: newExtremePrice,
      extremeTime: newExtremeTime,
    },
  };
}

function calculateStats(upRuns, downRuns) {
  const avgUpMove = upRuns.length > 0
    ? upRuns.reduce((sum, r) => sum + r.movePercent, 0) / upRuns.length
    : 0;

  const avgDownMove = downRuns.length > 0
    ? downRuns.reduce((sum, r) => sum + r.movePercent, 0) / downRuns.length
    : 0;

  const maxUpMove = upRuns.length > 0
    ? Math.max(...upRuns.map(r => r.movePercent))
    : 0;

  // Para bajistas, usar valores absolutos (todos son negativos)
  const maxDownMove = downRuns.length > 0
    ? Math.max(...downRuns.map(r => Math.abs(r.movePercent)))
    : 0;

  const minUpMove = upRuns.length > 0
    ? Math.min(...upRuns.map(r => r.movePercent))
    : Infinity;

  const minDownMove = downRuns.length > 0
    ? Math.min(...downRuns.map(r => Math.abs(r.movePercent)))
    : Infinity;

  const avgUpDuration = upRuns.length > 0
    ? upRuns.reduce((sum, r) => sum + r.duration, 0) / upRuns.length
    : 0;

  const avgDownDuration = downRuns.length > 0
    ? downRuns.reduce((sum, r) => sum + r.duration, 0) / downRuns.length
    : 0;

  return {
    avgUpMove,
    avgDownMove,
    maxUpMove,
    maxDownMove,
    minUpMove,
    minDownMove,
    totalUpRuns: upRuns.length,
    totalDownRuns: downRuns.length,
    avgUpDuration,
    avgDownDuration,
  };
}

function createStrategyState() {
  const initialCapital = 10000;
  return {
    running: false,
    config: {
      initialCapital,
      initialOrderPercent: 1,
      levels: 4,
      stopLossPercent: 2,
    },
    account: { initialCapital, realizedPnl: 0, equity: initialCapital, unrealizedPnl: 0 },
    position: null,
    journal: [],
    activeRunKey: null,
    ignoreRunKey: null,
    stoppedRunKey: null,
    lastMessage: 'Configura la simulación y pulsa Iniciar.',
  };
}

function positionPnl(position, price) {
  if (!position || !position.quantity) return 0;
  return position.side === 'long'
    ? position.quantity * price - position.notional
    : position.notional - position.quantity * price;
}

function recordPositionExcursion(position, price) {
  const unrealizedPnl = positionPnl(position, price);
  position.maxFavorablePnl = Math.max(position.maxFavorablePnl || 0, unrealizedPnl);
  position.maxAdversePnl = Math.min(position.maxAdversePnl || 0, unrealizedPnl);
}

function refreshStrategyAccount(strategy, price) {
  strategy.account.unrealizedPnl = positionPnl(strategy.position, price);
  strategy.account.equity = strategy.account.initialCapital + strategy.account.realizedPnl + strategy.account.unrealizedPnl;
}

function closeStrategyPosition(strategy, price, now, reason, persist = true) {
  const position = strategy.position;
  if (!position) return;
  recordPositionExcursion(position, price);
  const pnl = positionPnl(position, price);
  strategy.account.realizedPnl += pnl;
  strategy.journal.unshift({
    id: `${now}-${position.side}`,
    side: position.side,
    direction: position.direction,
    openedAt: position.openedAt,
    closedAt: now,
    averageEntryPrice: position.notional / position.quantity,
    exitPrice: price,
    notional: position.notional,
    quantity: position.quantity,
    orderCount: position.entries.length,
    entries: position.entries,
    pnl,
    pnlPercent: position.capitalBasis > 0 ? (pnl / position.capitalBasis) * 100 : 0,
    maxFavorablePnl: position.maxFavorablePnl || 0,
    maxAdversePnl: position.maxAdversePnl || 0,
    maxFavorablePercent: position.capitalBasis > 0 ? ((position.maxFavorablePnl || 0) / position.capitalBasis) * 100 : 0,
    maxAdversePercent: position.capitalBasis > 0 ? ((position.maxAdversePnl || 0) / position.capitalBasis) * 100 : 0,
    reason,
    averageMovePercent: position.averageMovePercent,
  });
  strategy.journal = strategy.journal.slice(0, MAX_STRATEGY_JOURNAL);
  strategy.position = null;
  refreshStrategyAccount(strategy, price);
  if (persist) saveData();
}

function startStrategy(config) {
  const strategy = serverState.strategy;
  if (strategy.running) return { error: 'La estrategia ya está activa.' };
  if (!serverState.isConnected || Date.now() - new Date(serverState.lastUpdate).getTime() > 10000) {
    return { error: 'No se puede iniciar: el precio de Binance no está actualizado.' };
  }
  const levels = Number(config.levels);
  const initialOrderPercent = Number(config.initialOrderPercent);
  const stopLossPercent = Number(config.stopLossPercent);
  const initialCapital = Number(config.initialCapital);
  if (!Number.isInteger(levels) || levels < 1 || levels > 10) return { error: 'El número de niveles debe estar entre 1 y 10.' };
  if (!(initialOrderPercent > 0 && initialOrderPercent <= 20)) return { error: 'El tamaño inicial debe ser mayor que 0 y como máximo 20%.' };
  if (!(stopLossPercent > 0 && stopLossPercent <= 100)) return { error: 'El stop loss debe estar entre 0 y 100%.' };
  if (!(initialCapital > 0 && initialCapital <= 100000000)) return { error: 'El capital virtual debe ser mayor que 0 USDT.' };
  if (strategy.journal.length && initialCapital !== strategy.account.initialCapital) {
    return { error: 'Para cambiar el capital inicial, reinicia primero la cuenta virtual y su diario.' };
  }
  strategy.config = { initialCapital, initialOrderPercent, levels, stopLossPercent };
  strategy.account.initialCapital = initialCapital;
  strategy.running = true;
  const run = serverState.directionalState.currentRun;
  strategy.ignoreRunKey = run.direction ? `${run.direction}:${run.startTime}` : (run.startTime ? `none:${run.startTime}` : null);
  strategy.activeRunKey = null;
  strategy.stoppedRunKey = null;
  strategy.lastMessage = 'Activa; esperando el siguiente tramo para no entrar tarde.';
  refreshStrategyAccount(strategy, serverState.currentPrice);
  return { success: true };
}

function updateStrategy(strategy, previousDirectionalState, directionalState, price, now, persist = true) {
  if (!strategy.running) {
    refreshStrategyAccount(strategy, price);
    return;
  }

  const run = directionalState.currentRun;
  if (!run.direction || run.startPrice <= 0) return;
  const runKey = `${run.direction}:${run.startTime}`;
  if (strategy.ignoreRunKey) {
    if (runKey === strategy.ignoreRunKey) return;
    strategy.ignoreRunKey = null;
  }

  const previousRun = previousDirectionalState.currentRun;
  const runChanged = strategy.activeRunKey && strategy.activeRunKey !== runKey;
  if (runChanged && strategy.position) {
    closeStrategyPosition(strategy, price, now, 'take_profit', persist);
    strategy.lastMessage = `Take profit ejecutado al terminar el tramo ${previousRun.direction === 'down' ? 'bajista' : 'alcista'}.`;
  }

  if (strategy.activeRunKey !== runKey) {
    strategy.activeRunKey = runKey;
    strategy.stoppedRunKey = null;
    const stats = directionalState.stats;
    const averageMovePercent = run.direction === 'down' ? Math.abs(stats.avgDownMove) : Math.abs(stats.avgUpMove);
    strategy.runPlan = {
      direction: run.direction,
      startPrice: run.startPrice,
      startTime: run.startTime,
      averageMovePercent,
      capitalBasis: Math.max(0, strategy.account.equity),
    };
    strategy.lastMessage = averageMovePercent > 0
      ? `Nuevo tramo ${run.direction === 'down' ? 'bajista' : 'alcista'}: niveles basados en promedio ${averageMovePercent.toFixed(3)}%.`
      : 'Esperando movimientos históricos para calcular los niveles.';
  }

  const plan = strategy.runPlan;
  if (!plan || plan.averageMovePercent <= 0 || strategy.stoppedRunKey === runKey) {
    refreshStrategyAccount(strategy, price);
    return;
  }

  const side = run.direction === 'down' ? 'long' : 'short';
  const moveFromStart = run.direction === 'down'
    ? ((plan.startPrice - price) / plan.startPrice) * 100
    : ((price - plan.startPrice) / plan.startPrice) * 100;
  const entries = strategy.position?.entries || [];
  let orderAdded = false;
  for (let i = 0; i < strategy.config.levels; i += 1) {
    const fraction = strategy.config.levels === 1 ? 0.25 : 0.25 + (0.75 * i) / (strategy.config.levels - 1);
    const targetMovePercent = plan.averageMovePercent * fraction;
    if (moveFromStart < targetMovePercent || entries.some((entry) => entry.level === i + 1)) continue;
    const orderNotional = (plan.capitalBasis * strategy.config.initialOrderPercent / 100) * (2 ** i);
    if (orderNotional <= 0 || price <= 0) continue;
    if (!strategy.position) {
      strategy.position = {
        side, direction: run.direction, openedAt: now, entries: [], quantity: 0, notional: 0,
        extremePrice: price, capitalBasis: plan.capitalBasis, averageMovePercent: plan.averageMovePercent,
      };
    }
    const position = strategy.position;
    const quantity = orderNotional / price;
    position.quantity += quantity;
    position.notional += orderNotional;
    position.entries.push({ level: i + 1, targetMovePercent, fillPrice: price, notional: orderNotional, quantity, timestamp: now });
    orderAdded = true;
    strategy.lastMessage = `Orden ${i + 1}/${strategy.config.levels} simulada a ${price.toFixed(2)} USDT.`;
  }
  if (orderAdded && persist) saveData();

  if (strategy.position) {
    const position = strategy.position;
    position.extremePrice = side === 'long' ? Math.min(position.extremePrice, price) : Math.max(position.extremePrice, price);
    recordPositionExcursion(position, price);
    refreshStrategyAccount(strategy, price);
    const stopLossAmount = position.capitalBasis * strategy.config.stopLossPercent / 100;
    if (positionPnl(position, price) <= -stopLossAmount) {
      closeStrategyPosition(strategy, price, now, 'stop_loss', persist);
      strategy.stoppedRunKey = runKey;
      strategy.lastMessage = `Stop loss alcanzado (${strategy.config.stopLossPercent}% del capital virtual).`;
      return;
    }
    const retrace = side === 'long'
      ? ((position.extremePrice > price ? 0 : price - position.extremePrice) / position.extremePrice) * 100
      : ((position.extremePrice < price ? 0 : position.extremePrice - price) / position.extremePrice) * 100;
    if (retrace >= TAKE_PROFIT_RETRACE_PERCENT) {
      closeStrategyPosition(strategy, price, now, 'take_profit', persist);
      strategy.lastMessage = 'Take profit ejecutado al retroceder 0,4% desde el extremo.';
    }
  } else {
    refreshStrategyAccount(strategy, price);
  }
}

// Estado del servidor
let serverState = {
  appStartTime: Date.now(),
  currentPrice: 0,
  priceChange24h: 0,
  priceChangePercent24h: 0,
  isConnected: false,
  lastUpdate: new Date().toISOString(),
  priceHistory: [],
  directionalState: createDirectionalState(),
  strategy: createStrategyState(),
};

// Cargar datos desde archivo
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      serverState = { ...serverState, ...data };
      serverState.strategy = {
        ...createStrategyState(),
        ...(data.strategy || {}),
        config: { ...createStrategyState().config, ...(data.strategy?.config || {}) },
        account: { ...createStrategyState().account, ...(data.strategy?.account || {}) },
        journal: (data.strategy?.journal || []).slice(0, MAX_STRATEGY_JOURNAL),
      };
      serverState.priceHistory = (data.priceHistory || []).slice(-MAX_PRICE_HISTORY_SAMPLES);
      const directionalState = serverState.directionalState;
      directionalState.upRuns = (directionalState.upRuns || []).slice(-MAX_RUNS_PER_DIRECTION);
      directionalState.downRuns = (directionalState.downRuns || []).slice(-MAX_RUNS_PER_DIRECTION);
      directionalState.stats = calculateStats(directionalState.upRuns, directionalState.downRuns);
      console.log('✅ Datos cargados desde archivo');
      return true;
    }
  } catch (error) {
    console.error('Error cargando datos:', error);
  }
  return false;
}

// Guardar datos en archivo
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(serverState, null, 2));
  } catch (error) {
    console.error('Error guardando datos:', error);
  }
}

// WebSocket de Binance para operaciones agregadas en tiempo real
let binanceWs = null;
let reconnectTimeout = null;
let isShuttingDown = false;
let tickerInterval = null;
let persistenceInterval = null;
let priceHistoryInterval = null;

function connectBinanceWebSocket() {
  if (isShuttingDown) return;

  const BINANCE_WS_URL = 'wss://fstream.binance.com/market/ws/ethusdt@aggTrade';
  
  console.log('🔌 Conectando a Binance WebSocket...');
  binanceWs = new WebSocket(BINANCE_WS_URL);
  
  binanceWs.on('open', () => {
    console.log('✅ Conectado a Binance WebSocket (market/aggTrade)');
  });
  
  binanceWs.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // aggTrade agrupa operaciones ejecutadas al mismo precio y envía ese precio en p.
      if (message.e === 'aggTrade') {
        const tradePrice = Number(message.p);

        if (Number.isFinite(tradePrice) && tradePrice > 0) {
          processPrice(tradePrice);
        }
      }
    } catch (error) {
      console.error('Error procesando mensaje de Binance:', error);
    }
  });
  
  binanceWs.on('close', () => {
    console.log('❌ Desconectado de Binance WebSocket');
    if (!isShuttingDown) scheduleReconnect();
  });
  
  binanceWs.on('error', (error) => {
    console.error('Error en WebSocket de Binance:', error);
    if (!isShuttingDown && binanceWs.readyState !== WebSocket.CLOSED) {
      binanceWs.close();
    }
  });
}

function scheduleReconnect() {
  if (isShuttingDown) return;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (isShuttingDown) return;
    console.log('🔄 Intentando reconectar en 5 segundos...');
    connectBinanceWebSocket();
  }, 5000);
}

// Obtener ticker 24h (solo para cambio porcentual)
async function fetch24hTicker() {
  try {
    const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=ETHUSDT`);
    const data = await response.json();
    serverState.priceChange24h = parseFloat(data.priceChange);
    serverState.priceChangePercent24h = parseFloat(data.priceChangePercent);
  } catch (error) {
    console.error('Error obteniendo ticker 24h:', error);
  }
}

// Procesar nuevo precio
async function processPrice(price) {
  if (price <= 0) return;

  const now = Date.now();
  serverState.currentPrice = price;
  serverState.lastUpdate = new Date().toISOString();
  serverState.isConnected = true;

  // Actualizar análisis y simulación virtual en el servidor.
  const previousDirectionalState = serverState.directionalState;
  serverState.directionalState = updateDirectionalState(previousDirectionalState, price, now);
  updateStrategy(serverState.strategy, previousDirectionalState, serverState.directionalState, price, now);

  // Notificar a todos los clientes WebSocket
  broadcastUpdate();
}

// Enviar actualización a todos los clientes
function broadcastUpdate() {
  // El historial se entrega por separado para no transmitir miles de muestras en cada trade.
  const { priceHistory, ...stateWithoutPriceHistory } = serverState;
  const message = JSON.stringify(stateWithoutPriceHistory);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// API endpoint para obtener estado actual
app.get('/api/state', (req, res) => {
  const { priceHistory, ...stateWithoutPriceHistory } = serverState;
  res.json(stateWithoutPriceHistory);
});

app.get('/api/price-history', (req, res) => {
  const cutoff = Date.now() - PRICE_HISTORY_WINDOW_MS;
  res.json({ samples: serverState.priceHistory.filter((sample) => sample.time >= cutoff) });
});

const BACKTEST_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h']);
const MAX_BACKTEST_CANDLES = 50000;

async function fetchBacktestCandles(interval, days) {
  const intervalMs = ({ '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000 })[interval];
  const endTime = Date.now() - 1;
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  if (Math.ceil((endTime - startTime) / intervalMs) > MAX_BACKTEST_CANDLES) {
    throw new Error(`El periodo supera el límite de ${MAX_BACKTEST_CANDLES.toLocaleString()} velas. Elige un intervalo mayor o menos días.`);
  }

  const candles = [];
  let cursor = startTime;
  while (cursor < endTime) {
    const params = new URLSearchParams({ symbol: 'ETHUSDT', interval, startTime: String(cursor), endTime: String(endTime), limit: '1500' });
    const response = await fetch(`${BINANCE_API}/klines?${params}`);
    if (!response.ok) throw new Error(`Binance no pudo devolver el histórico (${response.status}).`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Binance devolvió una respuesta histórica no válida.');
    if (batch.length === 0) break;
    for (const candle of batch) {
      const closeTime = Number(candle[6]);
      if (closeTime < Date.now()) {
        candles.push({ openTime: Number(candle[0]), closeTime, open: Number(candle[1]), high: Number(candle[2]), low: Number(candle[3]), close: Number(candle[4]) });
      }
    }
    const nextCursor = Number(batch[batch.length - 1][0]) + intervalMs;
    if (nextCursor <= cursor) break;
    cursor = nextCursor;
    if (candles.length >= MAX_BACKTEST_CANDLES) break;
  }
  return candles;
}

app.post('/api/backtest', async (req, res) => {
  try {
    const { interval, days, config } = req.body || {};
    const validatedDays = Number(days);
    const levels = Number(config?.levels);
    const initialOrderPercent = Number(config?.initialOrderPercent);
    const stopLossPercent = Number(config?.stopLossPercent);
    const initialCapital = Number(config?.initialCapital);
    if (!BACKTEST_INTERVALS.has(interval)) return res.status(400).json({ error: 'Elige un intervalo válido.' });
    if (!Number.isInteger(validatedDays) || validatedDays < 1 || validatedDays > 365) return res.status(400).json({ error: 'El periodo debe estar entre 1 y 365 días.' });
    if (!Number.isInteger(levels) || levels < 1 || levels > 10) return res.status(400).json({ error: 'El número de niveles debe estar entre 1 y 10.' });
    if (!(initialOrderPercent > 0 && initialOrderPercent <= 20)) return res.status(400).json({ error: 'El tamaño inicial debe ser mayor que 0 y como máximo 20%.' });
    if (!(stopLossPercent > 0 && stopLossPercent <= 100)) return res.status(400).json({ error: 'El stop loss debe estar entre 0 y 100%.' });
    if (!(initialCapital > 0 && initialCapital <= 100000000)) return res.status(400).json({ error: 'El capital inicial debe ser mayor que 0 USDT.' });

    const candles = await fetchBacktestCandles(interval, validatedDays);
    if (candles.length < 2) return res.status(422).json({ error: 'Binance no devolvió suficientes velas cerradas para el periodo elegido.' });

    const configForRun = { initialCapital, initialOrderPercent, levels, stopLossPercent };
    const simulation = createStrategyState();
    simulation.config = configForRun;
    simulation.account = { initialCapital, realizedPnl: 0, equity: initialCapital, unrealizedPnl: 0 };
    simulation.running = true;
    simulation.lastMessage = 'Backtest';
    let directional = createDirectionalState();
    const firstPrice = candles[0].open;
    directional = updateDirectionalState(directional, firstPrice, candles[0].openTime);
    const initialRun = directional.currentRun;
    simulation.ignoreRunKey = initialRun.direction ? `${initialRun.direction}:${initialRun.startTime}` : (initialRun.startTime ? `none:${initialRun.startTime}` : null);

    // OHLC data cannot reveal the exact tick order inside a candle. Use a consistent
    // candle-direction path; intrabar fills are therefore an approximation.
    for (const candle of candles) {
      const risingCandle = candle.close >= candle.open;
      const path = risingCandle
        ? [candle.open, candle.low, candle.high, candle.close]
        : [candle.open, candle.high, candle.low, candle.close];
      for (const price of path) {
        const previous = directional;
        directional = updateDirectionalState(directional, price, candle.closeTime);
        updateStrategy(simulation, previous, directional, price, candle.closeTime, false);
      }
    }
    if (simulation.position) closeStrategyPosition(simulation, candles[candles.length - 1].close, candles[candles.length - 1].closeTime, 'manual_stop', false);
    simulation.running = false;
    const trades = simulation.journal.slice().reverse();
    let equity = initialCapital;
    let peak = initialCapital;
    let maxDrawdownPercent = 0;
    for (const trade of trades) {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, ((peak - equity) / peak) * 100);
    }
    const wins = trades.filter((trade) => trade.pnl > 0);
    const grossProfit = wins.reduce((total, trade) => total + trade.pnl, 0);
    const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((total, trade) => total + trade.pnl, 0));
    // Limitar los puntos para que el gráfico sea ágil incluso al analizar meses de velas de 1 minuto.
    const chartStep = Math.max(1, Math.ceil(candles.length / 1600));
    const priceSeries = candles
      .filter((_, index) => index % chartStep === 0 || index === candles.length - 1)
      .map((candle) => ({ time: candle.closeTime, price: candle.close }));
    res.json({
      symbol: 'ETHUSDT', interval, days: validatedDays,
      startTime: candles[0].openTime, endTime: candles[candles.length - 1].closeTime,
      candleCount: candles.length, config: configForRun, priceSeries,
      summary: {
        initialCapital, finalEquity: initialCapital + simulation.account.realizedPnl,
        netPnl: simulation.account.realizedPnl,
        returnPercent: initialCapital > 0 ? (simulation.account.realizedPnl / initialCapital) * 100 : 0,
        maxDrawdownPercent, tradeCount: trades.length,
        winRatePercent: trades.length ? (wins.length / trades.length) * 100 : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
      },
      movementStats: {
        up: {
          count: directional.upRuns.length,
          averagePercent: directional.stats.avgUpMove,
          minPercent: Number.isFinite(directional.stats.minUpMove) ? directional.stats.minUpMove : null,
          maxPercent: directional.stats.maxUpMove,
        },
        down: {
          count: directional.downRuns.length,
          averagePercent: Math.abs(directional.stats.avgDownMove),
          minPercent: Number.isFinite(directional.stats.minDownMove) ? directional.stats.minDownMove : null,
          maxPercent: directional.stats.maxDownMove,
        },
      },
      trades,
      assumptions: 'Simulación con velas OHLC; el orden intravela es aproximado. No incluye comisiones, financiación ni deslizamiento.',
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo ejecutar el backtest.' });
  }
});

// API endpoint para resetear datos
app.post('/api/reset', (req, res) => {
  serverState.appStartTime = Date.now();
  serverState.directionalState = createDirectionalState();
  
  // Inicializar con precio actual si está disponible
  if (serverState.currentPrice > 0) {
    serverState.directionalState = updateDirectionalState(
      serverState.directionalState, 
      serverState.currentPrice, 
      Date.now()
    );
  }
  
  saveData();
  broadcastUpdate();
  res.json({ success: true });
});

app.post('/api/strategy/start', (req, res) => {
  const result = startStrategy(req.body || {});
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  saveData();
  broadcastUpdate();
  res.json({ success: true, strategy: serverState.strategy });
});

app.post('/api/strategy/stop', (req, res) => {
  const strategy = serverState.strategy;
  if (strategy.position) closeStrategyPosition(strategy, serverState.currentPrice, Date.now(), 'manual_stop');
  strategy.running = false;
  strategy.ignoreRunKey = null;
  strategy.lastMessage = 'Simulación detenida.';
  refreshStrategyAccount(strategy, serverState.currentPrice);
  saveData();
  broadcastUpdate();
  res.json({ success: true, strategy });
});

app.post('/api/strategy/reset', (req, res) => {
  if (serverState.strategy.running) {
    return res.status(400).json({ success: false, error: 'Detén la simulación antes de reiniciar la cuenta virtual.' });
  }
  serverState.strategy = createStrategyState();
  saveData();
  broadcastUpdate();
  res.json({ success: true, strategy: serverState.strategy });
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('🔗 Cliente conectado');
  
  // Enviar estado actual al nuevo cliente
  const { priceHistory, ...stateWithoutPriceHistory } = serverState;
  ws.send(JSON.stringify(stateWithoutPriceHistory));

  ws.on('close', () => {
    console.log('❌ Cliente desconectado');
  });
});

// Inicializar servidor
async function startServer() {
  // Intentar cargar datos existentes
  const loaded = loadData();
  
  if (!loaded) {
    console.log('🆕 Iniciando servidor con datos nuevos');
  }

  // Conectar al WebSocket de Binance para datos en tiempo real
  connectBinanceWebSocket();

  // Actualizar ticker 24h cada 30 segundos
  tickerInterval = setInterval(fetch24hTicker, 30000);
  await fetch24hTicker();

  // Guardar datos cada 10 segundos
  persistenceInterval = setInterval(saveData, 10000);

  // Guardar muestras del precio en el servidor para restaurar la gráfica al recargar la página.
  priceHistoryInterval = setInterval(() => {
    const now = Date.now();
    const lastUpdateTime = new Date(serverState.lastUpdate).getTime();
    if (!serverState.isConnected || !Number.isFinite(lastUpdateTime) || now - lastUpdateTime > 5000 || serverState.currentPrice <= 0) return;
    serverState.priceHistory.push({ time: now, price: serverState.currentPrice });
    const cutoff = now - PRICE_HISTORY_WINDOW_MS;
    serverState.priceHistory = serverState.priceHistory.filter((sample) => sample.time >= cutoff).slice(-MAX_PRICE_HISTORY_SAMPLES);
  }, PRICE_HISTORY_INTERVAL_MS);

  // Iniciar servidor
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Servidor Análisis Movimiento Direccional iniciado   ║
║                                                           ║
║   📡 Puerto: ${PORT}                                         ║
║   🌐 URL: http://localhost:${PORT}                           ║
║   📊 Tiempo de inicio: ${new Date(serverState.appStartTime).toLocaleString()}  ║
║   🎯 Umbral de retroceso: ${REVERSAL_THRESHOLD}%                        ║
║   ⚡ Fuente de datos: Binance WebSocket (market/aggTrade)  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Cierre limpio: evita que el cierre intencionado del WebSocket programe una reconexión.
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Recibida señal ${signal}; cerrando servidor...`);

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (tickerInterval) clearInterval(tickerInterval);
  if (persistenceInterval) clearInterval(persistenceInterval);
  if (priceHistoryInterval) clearInterval(priceHistoryInterval);

  saveData();
  
  if (binanceWs && binanceWs.readyState !== WebSocket.CLOSED) {
    if (binanceWs.readyState === WebSocket.CONNECTING) binanceWs.terminate();
    else binanceWs.close(1000, 'Server shutdown');
  }

  // Desconectar clientes del frontend para que HTTP y WebSocket puedan cerrar.
  wss.clients.forEach((client) => client.terminate());
  wss.close(() => {
    server.close(() => {
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Iniciar
startServer().catch(console.error);
