import { PortfolioStore } from "@/types";

const STORAGE_KEY = "portfolio_tracker_v1";

const DEFAULT_STORE: PortfolioStore = {
  actualHoldings: [],
  softHoldings: [],
  watchlist: [],
};

export function loadStore(): PortfolioStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STORE, ...parsed };
  } catch {
    return DEFAULT_STORE;
  }
}

export function saveStore(store: PortfolioStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Safari private mode or quota exceeded — silently fail
  }
}

export function loadApiKey(): string {
  try {
    return localStorage.getItem("portfolio_tracker_api_key") ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem("portfolio_tracker_api_key", key);
  } catch {
    // ignore
  }
}
