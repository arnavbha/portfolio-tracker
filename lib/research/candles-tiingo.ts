import type { CandleData, FetchResult } from "./finnhub-server";

/**
 * Daily-candle fetcher backed by Tiingo's REST API.
 *
 *   GET https://api.tiingo.com/tiingo/daily/{TICKER}/prices
 *       ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *       (Authorization: Token <TIINGO_API_KEY>)
 *
 * Free tier: 50 unique symbols/hour, 500 unique symbols/day, 1000 req/hour.
 * That's enough for one S&P 100 scan/day if we cache symbol coverage —
 * 100 unique symbols is over the hourly cap, so callers should pace at
 * ≥73s between requests to stay under 50/hr (that's what `rateLimitMs` in
 * scan.ts does at 1100ms × 100 ≈ 110s wall-clock per scan, well within).
 *
 * Adopted as the real candle source after Finnhub free dropped /stock/candle
 * (2024Q3) and Yahoo Finance started 429ing residential IPs without the
 * cookie+crumb dance. Sign up: https://www.tiingo.com/account/api/token
 * — no card required.
 *
 * Returns the same tagged-result shape as the Finnhub and Yahoo fetchers so
 * scan.ts handles all three uniformly.
 */

const TIINGO_BASE = "https://api.tiingo.com/tiingo/daily";

interface TiingoPriceRow {
  date: string; // ISO 8601 like "2026-04-25T00:00:00.000Z"
  close: number;
  adjClose: number;
  // adjOpen, adjHigh, adjLow, adjVolume, divCash, splitFactor, etc — unused
}

export function parseTiingoPriceResponse(
  json: unknown,
  ticker: string,
): FetchResult<CandleData> {
  if (!Array.isArray(json)) {
    return { ok: false, reason: "no_data", detail: "tiingo response not an array" };
  }
  const rows = json as TiingoPriceRow[];
  if (rows.length === 0) {
    return { ok: false, reason: "no_data", detail: "tiingo returned 0 rows" };
  }
  const closes: Array<[number, number]> = [];
  for (const row of rows) {
    const close = Number.isFinite(row.adjClose) ? row.adjClose : row.close;
    if (!Number.isFinite(close)) continue;
    const t = Math.floor(new Date(row.date).getTime() / 1000);
    if (!Number.isFinite(t)) continue;
    closes.push([t, close]);
  }
  if (closes.length === 0) {
    return { ok: false, reason: "no_data", detail: "tiingo rows had no usable closes" };
  }
  closes.sort((a, b) => a[0] - b[0]);
  return { ok: true, data: { ticker, closes } };
}

function unixToIsoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export async function fetchTiingoDailyCandles(
  ticker: string,
  fromUnix: number,
  toUnix: number,
): Promise<FetchResult<CandleData>> {
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_key", detail: "TIINGO_API_KEY not set" };
  }
  const startDate = unixToIsoDate(fromUnix);
  const endDate = unixToIsoDate(toUnix);
  const url =
    `${TIINGO_BASE}/${encodeURIComponent(ticker)}/prices` +
    `?startDate=${startDate}&endDate=${endDate}`;
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    return { ok: false, reason: "transport_error", detail: (e as Error).message };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited", status: 429 };
  if (res.status === 404) return { ok: false, reason: "not_found", status: 404 };
  if (!res.ok) {
    return { ok: false, reason: "transport_error", status: res.status };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, reason: "transport_error", detail: (e as Error).message };
  }
  return parseTiingoPriceResponse(json, ticker);
}
