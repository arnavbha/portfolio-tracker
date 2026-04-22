"use client";

import { useState } from "react";
import { SymbolSearch } from "@/components/shared/SymbolSearch";

interface AddShortlistModalProps {
  apiKey: string;
  onAdd: (symbol: string) => void;
  onClose: () => void;
}

export function AddShortlistModal({ apiKey, onAdd, onClose }: AddShortlistModalProps) {
  const [symbol, setSymbol] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    onAdd(symbol.toUpperCase().trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Add to Shortlist</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Symbol</label>
            <SymbolSearch
              apiKey={apiKey}
              onSelect={setSymbol}
              value={symbol}
              onChange={setSymbol}
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
              disabled={!symbol.trim()}
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
