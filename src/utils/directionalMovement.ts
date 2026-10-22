export interface DirectionalRun {
  id: string;
  direction: 'up' | 'down';
  startPrice: number;
  endPrice: number;
  extremePrice: number;
  movePercent: number;
  moveAmount: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface DirectionalState {
  currentRun: {
    direction: 'up' | 'down' | null;
    startPrice: number;
    extremePrice: number;
    startTime: number;
  };
  upRuns: DirectionalRun[];
  downRuns: DirectionalRun[];
  stats: {
    avgUpMove: number;
    avgDownMove: number;
    maxUpMove: number;
    maxDownMove: number;
    minUpMove: number;
    minDownMove: number;
    totalUpRuns: number;
    totalDownRuns: number;
    avgUpDuration: number;
    avgDownDuration: number;
  };
  reversalThreshold: number; // 0.4% por defecto
}

export function createDirectionalState(reversalThreshold: number = 0.4): DirectionalState {
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
    reversalThreshold,
  };
}

export function updateDirectionalState(state: DirectionalState, price: number, now: number): DirectionalState {
  // Inicializar si es el primer precio
  if (state.currentRun.direction === null) {
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

    const completedRun: DirectionalRun = {
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

function calculateStats(upRuns: DirectionalRun[], downRuns: DirectionalRun[]) {
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
