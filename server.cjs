const express = require('express');
const { WebSocketServer } = require('ws');
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

// Crear estado inicial de movimiento direccional
function createDirectionalState() {
  return {
    currentRun: {
      direction: null,
      startPrice: 0,
      extremePrice: 0,
      startTime: 0,
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
        },
      };
    }
    return state;
  }

  // Actualizar extremo si el precio sigue en la dirección del run
  let newExtremePrice = extremePrice;
  if (direction === 'up' && price > extremePrice) {
    newExtremePrice = price;
  } else if (direction === 'down' && price < extremePrice) {
    newExtremePrice = price;
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
    
    const movePercent = (moveAmount / startPrice) * 100;
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
    const newUpRuns = direction === 'up' ? [...state.upRuns, completedRun] : state.upRuns;
    const newDownRuns = direction === 'down' ? [...state.downRuns, completedRun] : state.downRuns;

    // Calcular nuevas estadísticas
    const newStats = calculateStats(newUpRuns, newDownRuns);

    // Iniciar nuevo run en dirección contraria
    return {
      ...state,
      currentRun: {
        direction: direction === 'up' ? 'down' : 'up',
        startPrice: price,
        extremePrice: price,
        startTime: now,
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

  const maxDownMove = downRuns.length > 0
    ? Math.max(...downRuns.map(r => r.movePercent))
    : 0;

  const minUpMove = upRuns.length > 0
    ? Math.min(...upRuns.map(r => r.movePercent))
    : Infinity;

  const minDownMove = downRuns.length > 0
    ? Math.min(...downRuns.map(r => r.movePercent))
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

// Estado del servidor
let serverState = {
  appStartTime: Date.now(),
  currentPrice: 0,
  priceChange24h: 0,
  priceChangePercent24h: 0,
  isConnected: false,
  lastUpdate: new Date().toISOString(),
  directionalState: createDirectionalState(),
};

// Cargar datos desde archivo
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      serverState = { ...serverState, ...data };
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

// Obtener precio de Binance
async function fetchPrice() {
  try {
    const response = await fetch(`${BINANCE_API}/ticker/price?symbol=ETHUSDT`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('Error obteniendo precio:', error);
    return null;
  }
}

// Obtener ticker 24h
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

  // Actualizar estado direccional
  serverState.directionalState = updateDirectionalState(serverState.directionalState, price, now);

  // Notificar a todos los clientes WebSocket
  broadcastUpdate();
}

// Enviar actualización a todos los clientes
function broadcastUpdate() {
  const message = JSON.stringify(serverState);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// API endpoint para obtener estado actual
app.get('/api/state', (req, res) => {
  res.json(serverState);
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

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('🔗 Cliente conectado');
  
  // Enviar estado actual al nuevo cliente
  ws.send(JSON.stringify(serverState));

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
    // Obtener precio inicial
    const price = await fetchPrice();
    if (price > 0) {
      serverState.currentPrice = price;
      serverState.directionalState = updateDirectionalState(
        serverState.directionalState, 
        price, 
        Date.now()
      );
    }
  }

  // Iniciar polling de precios (cada 1 segundo)
  setInterval(async () => {
    const price = await fetchPrice();
    if (price) {
      await processPrice(price);
    }
  }, 1000);

  // Actualizar ticker 24h cada 30 segundos
  setInterval(fetch24hTicker, 30000);
  await fetch24hTicker();

  // Guardar datos cada 10 segundos
  setInterval(saveData, 10000);

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
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  saveData();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Iniciar
startServer().catch(console.error);
