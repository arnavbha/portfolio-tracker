export interface StockQuote {
  symbol: string;
  currentPrice: number;
  dailyChange: number;
  dailyChangePct: number;
  previousClose: number;
  lastUpdated: number;
}

export interface ActualHolding {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number; // per share, average cost
  addedAt: number;
}

export interface SoftHolding {
  id: string;
  symbol: string;
  hypotheticalShares: number;
  entryPrice: number;
  entryDate: string; // ISO date string "YYYY-MM-DD"
  addedAt: number;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  addedAt: number;
}

export interface PortfolioStore {
  actualHoldings: ActualHolding[];
  softHoldings: SoftHolding[];
  watchlist: WatchlistItem[];
  apiKey?: string;
}

export interface SymbolSearchResult {
  symbol: string;
  description: string;
  type: string;
}
