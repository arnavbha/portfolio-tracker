"use client";

import { useState } from "react";
import { SoftHolding, StockQuote } from "@/types";
import { computeSoftStats, formatCurrency, formatPercent, formatChange } from "@/lib/calculations";
import { PnLCell } from "@/components/shared/PnLCell";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddSoftModal } from "./AddSoftModal";

interface SoftPortfolioProps {
  holdings: SoftHolding[];
  quotes: Record<string, StockQuote>;
  apiKey: string;
  onAdd: (holding: Omit<SoftHolding, "id" | "addedAt">) => void;
  onRemove: (id: string) => void;
}

export function SoftPortfolio({ holdings, quotes, apiKey, onAdd, onRemove }: SoftPortfolioProps) {
  const [showModal, setShowModal] = useState(false);

  const statsAll = holdings.map((h) => computeSoftStats(h, quotes[h.symbol]));
  const totalCurrentValue = statsAll.reduce((s, st) => s + (st?.currentValue ?? 0), 0);
  const totalEntryValue = statsAll.reduce((s, st) => s + (st?.entryValue ?? 0), 0);
  const totalGain = totalCurrentValue - totalEntryValue;
  const totalGainPct = totalEntryValue > 0 ? (totalGain / totalEntryValue) * 100 : 0;
  const hasQuotes = statsAll.some((s) => s !== null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Soft Portfolio</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Hypothetical positions you&apos;re tracking</p>
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
            <div className="text-xs text-zinc-500 mb-1">Hypothetical Value</div>
            <div className="font-mono font-semibold text-white text-lg">{formatCurrency(totalCurrentValue)}</div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Entry Value</div>
            <div className="font-mono font-semibold text-white text-lg">{formatCurrency(totalEntryValue)}</div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Hypothetical Gain</div>
            <div className={`font-mono font-semibold text-lg ${totalGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatChange(totalGain)}
            </div>
            <div className={`font-mono text-xs ${totalGain >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatPercent(totalGainPct)}
            </div>
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <EmptyState
          icon="🧪"
          title="No soft positions"
          description="Add stocks to simulate performance without buying"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left pb-3 font-medium">Symbol</th>
                <th className="text-right pb-3 font-medium">Shares</th>
                <th className="text-right pb-3 font-medium">Entry Price</th>
                <th className="text-right pb-3 font-medium">Current</th>
                <th className="text-right pb-3 font-medium">Entry Value</th>
                <th className="text-right pb-3 font-medium">Current Value</th>
                <th className="text-right pb-3 font-medium">Gain</th>
                <th className="text-right pb-3 font-medium">Days</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {holdings.map((holding) => {
                const quote = quotes[holding.symbol];
                const stats = computeSoftStats(holding, quote);
                return (
                  <tr key={holding.id} className="group">
                    <td className="py-3">
                      <div className="font-mono font-semibold text-white">{holding.symbol}</div>
                      <div className="text-xs text-zinc-500">{holding.entryDate}</div>
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-300">
                      {holding.hypotheticalShares.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-400">
                      {formatCurrency(holding.entryPrice)}
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
                        <span className="font-mono text-zinc-400">{formatCurrency(stats.entryValue)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {stats ? (
                        <span className="font-mono text-white">{formatCurrency(stats.currentValue)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {stats ? (
                        <PnLCell pnl={stats.gain} pnlPct={stats.gainPct} />
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-400 text-xs">
                      {stats ? `${stats.daysHeld}d` : "—"}
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
        <AddSoftModal
          apiKey={apiKey}
          onAdd={onAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
