import type { CandleData, FetchResult } from "./finnhub-server";
import { fetchDailyCandles as fetchFinnhubDailyCandles } from "./finnhub-server";

/**
 * Daily-candle fetcher backed by Yahoo Finance's unofficial chart endpoint.
 *
 *   GET https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}
 *       ?interval=1d&period1={fromUnix}&period2={toUnix}
 *
 * No API key. Same JSON path that the `yfinance` Python library uses, so
 * stability has been good for years — but it's an undocumented API. If Yahoo
 * restructures the response, the parser will break loudly (parseYahoo... will
 * return `no_data`) rather than silently emit corrupt closes.
 *
 * Adopted because Finnhub free-tier dropped /stock/candle behind paywall in
 * 2024Q3. Quotes still hit Finnhub via `fetchQuoteServer`. To opt back into
 * Finnhub for candles (paid tier), set `CANDLE_SOURCE=finnhub` in env — see
 * `pickCandleFetcher()` below.
 *
 * Returns the same tagged-result shape as `fetchDailyCandles` in
 * finnhub-server.ts, so callers in scan.ts treat both sources uniformly.
 */

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo blocks default Node fetch user agents on some IPs. A browser-like UA
// plus an Accept header is the de-facto contract documented by yfinance.
const YAHOO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta?: { symbol?: string; regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }> | null;
    error: { code?: string; description?: string } | null;
  };
}

export function parseYahooChartResponse(
  json: unknown,
  ticker: string,
): FetchResult<CandleData> {
  const r = json as YahooChartResponse;
  if (!r || !r.chart) {
    return { ok: false, reason: "no_data", detail: "missing chart envelope" };
  }
  if (r.chart.error) {
    return {
      ok: false,
      reason: "no_data",
      detail: r.chart.error.description ?? r.chart.error.code ?? "yahoo error",
    };
  }
  const result = r.chart.result?.[0];
  if (!result) {
    return { ok: false, reason: "no_data", detail: "empty chart.result" };
  }
  const ts = result.timestamp ?? [];
  // Prefer adjclose so dividend/split adjustments don't fake breakouts; fall
  // back to raw close if Yahoo omits adjclose for this ticker.
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const raw = result.indicators?.quote?.[0]?.close;
  const series = adj && adj.length === ts.length ? adj : raw;
  if (!series || series.length !== ts.length) {
    return { ok: false, reason: "no_data", detail: "timestamp/close length mismatch" };
  }
  const closes: Array<[number, number]> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = series[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      closes.push([ts[i], c]);
    }
  }
  if (closes.length === 0) {
    return { ok: false, reason: "no_data", detail: "all closes null/non-finite" };
  }
  closes.sort((a, b) => a[0] - b[0]);
  return { ok: true, data: { ticker, closes } };
}

export async function fetchYahooDailyCandles(
  ticker: string,
  fromUnix: number,
  toUnix: number,
): Promise<FetchResult<CandleData>> {
  const url =
    `${YAHOO_BASE}/${encodeURIComponent(ticker)}?interval=1d` +
    `&period1=${fromUnix}&period2=${toUnix}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", headers: YAHOO_HEADERS });
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
  return parseYahooChartResponse(json, ticker);
}

export type CandleFetcher = (
  ticker: string,
  fromUnix: number,
  toUnix: number,
) => Promise<FetchResult<CandleData>>;

/**
 * Picks the candle source based on env. Defaults to Yahoo because Finnhub
 * free tier no longer covers /stock/candle. Set `CANDLE_SOURCE=finnhub` to
 * route candles through the Finnhub server fetcher instead — only useful on
 * a paid Finnhub key.
 */
export function pickCandleFetcher(): CandleFetcher {
  return process.env.CANDLE_SOURCE === "finnhub"
    ? fetchFinnhubDailyCandles
    : fetchYahooDailyCandles;
}
