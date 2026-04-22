"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchQuote, sleep } from "@/lib/finnhub";
import { StockQuote } from "@/types";

export function useStockPrices(symbols: string[], apiKey: string) {
  const sortedSymbols = [...new Set(symbols)].sort();
  const key = sortedSymbols.join(",");

  return useQuery<Record<string, StockQuote>>({
    queryKey: ["stockPrices", key, apiKey],
    queryFn: async () => {
      if (!apiKey || sortedSymbols.length === 0) return {};
      const results: Record<string, StockQuote> = {};
      for (const symbol of sortedSymbols) {
        const quote = await fetchQuote(symbol, apiKey);
        if (quote) results[symbol] = quote;
        // Stagger requests to stay under 60 req/min
        if (sortedSymbols.length > 1) await sleep(1100);
      }
      return results;
    },
    enabled: !!apiKey && sortedSymbols.length > 0,
    refetchInterval: Math.max(30000, sortedSymbols.length * 1200),
    staleTime: 20000,
    refetchIntervalInBackground: false,
  });
}
