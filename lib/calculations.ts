import { ActualHolding, SoftHolding, StockQuote } from "@/types";

export interface ActualHoldingStats {
  marketValue: number;
  totalCost: number;
  pnl: number;
  pnlPct: number;
}

export interface SoftHoldingStats {
  currentValue: number;
  entryValue: number;
  gain: number;
  gainPct: number;
  daysHeld: number;
}

export function computeActualStats(
  holding: ActualHolding,
  quote: StockQuote | undefined
): ActualHoldingStats | null {
  if (!quote) return null;
  const marketValue = holding.shares * quote.currentPrice;
  const totalCost = holding.shares * holding.costBasis;
  const pnl = marketValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return { marketValue, totalCost, pnl, pnlPct };
}

export function computeSoftStats(
  holding: SoftHolding,
  quote: StockQuote | undefined
): SoftHoldingStats | null {
  if (!quote) return null;
  const currentValue = holding.hypotheticalShares * quote.currentPrice;
  const entryValue = holding.hypotheticalShares * holding.entryPrice;
  const gain = currentValue - entryValue;
  const gainPct = entryValue > 0 ? (gain / entryValue) * 100 : 0;
  const entryMs = new Date(holding.entryDate).getTime();
  const daysHeld = Math.floor((Date.now() - entryMs) / (1000 * 60 * 60 * 24));
  return { currentValue, entryValue, gain, gainPct, daysHeld };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatChange(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value)}`;
}
