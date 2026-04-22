import { StockQuote, SymbolSearchResult } from "@/types";

const BASE_URL = "https://finnhub.io/api/v1";

interface FinnhubQuoteResponse {
  c: number;  // current price
  d: number;  // daily change
  dp: number; // daily change percent
  pc: number; // previous close
  o: number;  // open
}

interface FinnhubSearchResponse {
  result: Array<{
    symbol: string;
    description: string;
    type: string;
  }>;
}

export async function fetchQuote(symbol: string, apiKey: string): Promise<StockQuote | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    );
    if (!res.ok) return null;
    const data: FinnhubQuoteResponse = await res.json();
    if (!data.c) return null;
    return {
      symbol,
      currentPrice: data.c,
      dailyChange: data.d,
      dailyChangePct: data.dp,
      previousClose: data.pc,
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function searchSymbols(
  query: string,
  apiKey: string
): Promise<SymbolSearchResult[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${apiKey}`
    );
    if (!res.ok) return [];
    const data: FinnhubSearchResponse = await res.json();
    return (data.result ?? [])
      .filter((r) => r.type === "Common Stock" || r.type === "ETP")
      .slice(0, 8)
      .map((r) => ({ symbol: r.symbol, description: r.description, type: r.type }));
  } catch {
    return [];
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
