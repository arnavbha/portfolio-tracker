"use client";

import { useState } from "react";
import { SymbolSearch } from "@/components/shared/SymbolSearch";
import { SoftHolding } from "@/types";

interface AddSoftModalProps {
  apiKey: string;
  onAdd: (holding: Omit<SoftHolding, "id" | "addedAt">) => void;
  onClose: () => void;
}

export function AddSoftModal({ apiKey, onAdd, onClose }: AddSoftModalProps) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !shares || !entryPrice || !entryDate) return;
    onAdd({
      symbol: symbol.toUpperCase().trim(),
      hypotheticalShares: parseFloat(shares),
      entryPrice: parseFloat(entryPrice),
      entryDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">Add to Soft Portfolio</h2>
        <p className="text-xs text-zinc-500 mb-4">Track hypothetical performance without buying</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Symbol</label>
            <SymbolSearch
              apiKey={apiKey}
              onSelect={setSymbol}
              value={symbol}
              onChange={setSymbol}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Hypothetical Shares</label>
              <input
                type="number"
                step="any"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Entry Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-6 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Entry Date (hypothetical buy date)</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!symbol.trim() || !shares || !entryPrice || !entryDate}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
