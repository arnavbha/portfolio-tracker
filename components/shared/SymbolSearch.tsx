"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchSymbols } from "@/lib/finnhub";
import { SymbolSearchResult } from "@/types";

interface SymbolSearchProps {
  apiKey: string;
  onSelect: (symbol: string) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function SymbolSearch({
  apiKey,
  onSelect,
  placeholder = "Search symbol (e.g. AAPL)...",
  value,
  onChange,
}: SymbolSearchProps) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  const handleChange = useCallback(
    (q: string) => {
      setQuery(q);
      onChange?.(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 1) {
        setResults([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const res = await searchSymbols(q, apiKey);
        setResults(res);
        setOpen(res.length > 0);
        setLoading(false);
      }, 400);
    },
    [apiKey, onChange]
  );

  const handleSelect = (symbol: string) => {
    setQuery(symbol);
    setOpen(false);
    onSelect(symbol);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r.symbol)}
              className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors flex items-center justify-between gap-2"
            >
              <span className="font-mono font-semibold text-white text-sm">{r.symbol}</span>
              <span className="text-zinc-400 text-xs truncate">{r.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
