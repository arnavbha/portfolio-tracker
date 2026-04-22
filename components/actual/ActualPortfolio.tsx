"use client";

import { useState } from "react";
import { ActualHolding, StockQuote } from "@/types";
import { computeActualStats, formatCurrency, formatPercent, formatChange } from "@/lib/calculations";
import { PnLCell } from "@/components/shared/PnLCell";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddActualModal } from "./AddActualModal";

interface ActualPortfolioProps {
  holdings: ActualHolding[];
  quotes: Record<string, StockQuote>;
  apiKey: string;
  onAdd: (holding: Omit<ActualHolding, "id" | "addedAt">) => void;
  onRemove: (id: string) => void;
}

export function ActualPortfolio({ holdings, quotes, apiKey, onAdd, onRemove }: ActualPortfolioProps) {
  const [showModal, setShowModal] = useState(false);

  const statsAll = holdings.map((h) => computeActualStats(h, quotes[h.symbol]));
  const totalValue = statsAll.reduce((s, st) => s + (st?.marketValue ?? 0), 0);
  const totalCost = statsAll.reduce((s, st) => s + (st?.totalCost ?? 0), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const hasQuotes = statsAll.some((s) => s !== null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Portfolio</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Stocks you actually own</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> Add
        </button>
      </div>

      {hasQuotes && holdings.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Total Value</div>
            <div className="font-mono font-semibold text-white text-lg">{formatCurrency(totalValue)}</div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Total Cost</div>
            <div className="font-mono font-semibold text-white text-lg">{formatCurrency(totalCost)}</div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Total P&amp;L</div>
            <div className={`font-mono font-semibold text-lg ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatChange(totalPnl)}
            </div>
            <div className={`font-mono text-xs ${totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatPercent(totalPnlPct)}
            </div>
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No holdings yet"
          description="Add stocks you own to track your portfolio"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left pb-3 font-medium">Symbol</th>
                <th className="text-right pb-3 font-medium">Shares</th>
                <th className="text-right pb-3 font-medium">Avg Cost</th>
                <th className="text-right pb-3 font-medium">Current</th>
                <th className="text-right pb-3 font-medium">Market Value</th>
                <th className="text-right pb-3 font-medium">P&amp;L</th>
                <th className="text-right pb-3 font-medium">Today</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {holdings.map((holding) => {
                const quote = quotes[holding.symbol];
                const stats = computeActualStats(holding, quote);
                return (
                  <tr key={holding.id} className="group">
                    <td className="py-3">
                      <span className="font-mono font-semibold text-white">{holding.symbol}</span>
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-300">
                      {holding.shares.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-400">
                      {formatCurrency(holding.costBasis)}
                    </td>
                    <td className="py-3 text-right">
                      {quote ? (
                        <span className="font-mono text-white">{formatCurrency(quote.currentPrice)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {stats ? (
                        <span className="font-mono text-white">{formatCurrency(stats.marketValue)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {stats ? (
                        <PnLCell pnl={stats.pnl} pnlPct={stats.pnlPct} />
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {quote ? (
                        <div className={`font-mono text-xs ${quote.dailyChangePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {quote.dailyChangePct >= 0 ? "+" : ""}{quote.dailyChangePct.toFixed(2)}%
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onRemove(holding.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddActualModal
          apiKey={apiKey}
          onAdd={onAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
