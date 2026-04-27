/**
 * Server-side Finnhub fetchers for the scan pipeline.
 *
 * Eng-review CQ 2B: fetchers MUST return a tagged-result `{ ok, ... }` shape so
 * the orchestrator can distinguish between "data unavailable" (skip ticker),
 * "rate limited" (back off), and "transport error" (retry once). The
 * client-side lib/finnhub.ts swallows errors with `null` returns, which is
 * fine for an interactive UI but loses signal for batch scans.
 *
 * Free-tier limits are tight (60 req/min). Caller is responsible for spacing
 * — we expose `sleep()` and surface 429 explicitly so the orchestrator can
 * apply backoff.
 */

const BASE_URL = "https://finnhub.io/api/v1";

export type FetchOk<T> = { ok: true; data: T };
export type FetchErr = {
  ok: false;
  reason: "rate_limited" | "not_found" | "no_data" | "transport_error" | "missing_key";
  status?: number;
  detail?: string;
};
export type FetchResult<T> = FetchOk<T> | FetchErr;

export interface QuoteData {
  ticker: string;
  current: number;
  dailyChange: number;
  dailyChangePct: number;
  previousClose: number;
  open: number;
  fetchedAt: number;
}

interface FinnhubQuoteResponse {
  c: number;
  d: number;
  dp: number;
  pc: number;
  o: number;
}

export async function fetchQuoteServer(ticker: string): Promise<FetchResult<QuoteData>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_key", detail: "FINNHUB_API_KEY (server) not set" };
  }
  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: "transport_error", detail: (e as Error).message };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited", status: 429 };
  if (res.status === 404) return { ok: false, reason: "not_found", status: 404 };
  if (!res.ok) return { ok: false, reason: "transport_error", status: res.status };

  const json = (await res.json()) as FinnhubQuoteResponse;
  if (!json || !json.c || json.c === 0) {
    return { ok: false, reason: "no_data", detail: "Finnhub returned zero/empty quote" };
  }
  return {
    ok: true,
    data: {
      ticker,
      current: json.c,
      dailyChange: json.d,
      dailyChangePct: json.dp,
      previousClose: json.pc,
      open: json.o,
      fetchedAt: Date.now(),
    },
  };
}

export interface CandleData {
  ticker: string;
  // Each tuple is [unixSec, close]. Sorted ascending. Length depends on resolution + window.
  closes: Array<[number, number]>;
}

interface FinnhubCandleResponse {
  s: "ok" | "no_data";
  c: number[];
  t: number[];
}

/**
 * Daily candles. Used to compute the 6-month price-history floor (rule
 * `min-history`) and forward-return windows.
 *
 * `from` and `to` are unix seconds. Finnhub free tier supports 1y of history
 * for US tickers, more than enough for our 6-month floor.
 */
export async function fetchDailyCandles(
  ticker: string,
  from: number,
  to: number,
): Promise<FetchResult<CandleData>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_key", detail: "FINNHUB_API_KEY (server) not set" };
  }
  const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: "transport_error", detail: (e as Error).message };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited", status: 429 };
  if (res.status === 404) return { ok: false, reason: "not_found", status: 404 };
  if (!res.ok) return { ok: false, reason: "transport_error", status: res.status };

  const json = (await res.json()) as FinnhubCandleResponse;
  if (json.s !== "ok" || !json.c?.length) {
    return { ok: false, reason: "no_data" };
  }
  const closes: Array<[number, number]> = json.t.map((t, i) => [t, json.c[i]]);
  closes.sort((a, b) => a[0] - b[0]);
  return { ok: true, data: { ticker, closes } };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
