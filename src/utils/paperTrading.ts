export interface PaperStrategyConfig {
  initialCapital: number;
  initialOrderPercent: number;
  levels: number;
  stopLossPercent: number;
}

export interface PaperEntry {
  level: number;
  targetMovePercent: number;
  fillPrice: number;
  notional: number;
  quantity: number;
  timestamp: number;
}

export interface PaperPosition {
  side: 'long' | 'short';
  direction: 'up' | 'down';
  openedAt: number;
  entries: PaperEntry[];
  quantity: number;
  notional: number;
  extremePrice: number;
  capitalBasis: number;
  averageMovePercent: number;
}

export interface PaperJournalEntry {
  id: string;
  side: 'long' | 'short';
  direction: 'up' | 'down';
  openedAt: number;
  closedAt: number;
  averageEntryPrice: number;
  exitPrice: number;
  notional: number;
  quantity: number;
  orderCount: number;
  entries: PaperEntry[];
  pnl: number;
  pnlPercent: number;
  maxFavorablePnl?: number;
  maxAdversePnl?: number;
  maxFavorablePercent?: number;
  maxAdversePercent?: number;
  reason: 'take_profit' | 'stop_loss' | 'manual_stop';
  averageMovePercent: number;
}

export interface PaperStrategyState {
  running: boolean;
  config: PaperStrategyConfig;
  account: {
    initialCapital: number;
    realizedPnl: number;
    equity: number;
    unrealizedPnl: number;
  };
  position: PaperPosition | null;
  journal: PaperJournalEntry[];
  activeRunKey: string | null;
  ignoreRunKey: string | null;
  stoppedRunKey: string | null;
  runPlan?: {
    direction: 'up' | 'down';
    startPrice: number;
    startTime: number;
    averageMovePercent: number;
    capitalBasis: number;
  };
  lastMessage: string;
}

export const DEFAULT_PAPER_STRATEGY_CONFIG: PaperStrategyConfig = {
  initialCapital: 10000,
  initialOrderPercent: 1,
  levels: 4,
  stopLossPercent: 2,
};
