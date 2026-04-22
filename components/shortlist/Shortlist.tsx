"use client";

import { useState } from "react";
import { WatchlistItem, StockQuote } from "@/types";
import { PriceCell } from "@/components/shared/PriceCell";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddShortlistModal } from "./AddShortlistModal";
import { formatCurrency } from "@/lib/calculations";

interface ShortlistProps {
  items: WatchlistItem[];
  quotes: Record<string, StockQuote>;
  loading: boolean;
  apiKey: string;
  onAdd: (symbol: string) => void;
  onRemove: (id: string) => void;
}

export function Shortlist({ items, quotes, loading, apiKey, onAdd, onRemove }: ShortlistProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Shortlist</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Stocks on your radar</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> Add
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="👀"
          title="Nothing here yet"
          description="Add stocks you want to keep an eye on"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left pb-3 font-medium">Symbol</th>
                <th className="text-right pb-3 font-medium">Price</th>
                <th className="text-right pb-3 font-medium">Change</th>
                <th className="text-right pb-3 font-medium">Prev Close</th>
                <th className="text-right pb-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => {
                const quote = quotes[item.symbol];
                return (
                  <tr key={item.id} className="group">
                    <td className="py-3">
                      <span className="font-mono font-semibold text-white">{item.symbol}</span>
                    </td>
                    <td className="py-3 text-right">
                      {quote ? (
                        <span className="font-mono text-white">{formatCurrency(quote.currentPrice)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {quote ? (
                        <div className={`font-mono text-xs ${quote.dailyChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          <div>{quote.dailyChange >= 0 ? "+" : ""}{formatCurrency(quote.dailyChange)}</div>
                          <div>{quote.dailyChangePct >= 0 ? "+" : ""}{quote.dailyChangePct.toFixed(2)}%</div>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {quote ? (
                        <span className="font-mono text-zinc-400">{formatCurrency(quote.previousClose)}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onRemove(item.id)}
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
        <AddShortlistModal
          apiKey={apiKey}
          onAdd={onAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
