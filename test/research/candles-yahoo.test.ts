import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fetchYahooDailyCandles,
  parseYahooChartResponse,
  pickCandleFetcher,
} from "@/lib/research/candles-yahoo";
import { fetchDailyCandles } from "@/lib/research/finnhub-server";

const VALID_FIXTURE = {
  chart: {
    result: [
      {
        meta: { symbol: "AAPL", regularMarketPrice: 200 },
        timestamp: [1730000000, 1730086400, 1730172800],
        indicators: {
          quote: [{ close: [180.0, 181.5, 182.0] }],
          adjclose: [{ adjclose: [179.5, 181.0, 181.7] }],
        },
      },
    ],
    error: null,
  },
};

describe("parseYahooChartResponse", () => {
  it("prefers adjclose over raw close, sorted ascending", () => {
    const r = parseYahooChartResponse(VALID_FIXTURE, "AAPL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.ticker).toBe("AAPL");
    expect(r.data.closes).toEqual([
      [1730000000, 179.5],
      [1730086400, 181.0],
      [1730172800, 181.7],
    ]);
  });

  it("falls back to raw close when adjclose is missing", () => {
    const fixture = {
      chart: {
        result: [
          {
            timestamp: [1, 2],
            indicators: { quote: [{ close: [10, 11] }] },
          },
        ],
        error: null,
      },
    };
    const r = parseYahooChartResponse(fixture, "AAPL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.closes).toEqual([
      [1, 10],
      [2, 11],
    ]);
  });

  it("filters null/non-finite closes mid-array", () => {
    const fixture = {
      chart: {
        result: [
          {
            timestamp: [1, 2, 3, 4],
            indicators: {
              quote: [{ close: [10, null, NaN, 14] as Array<number | null> }],
            },
          },
        ],
        error: null,
      },
    };
    const r = parseYahooChartResponse(fixture, "AAPL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.closes.map(([, c]) => c)).toEqual([10, 14]);
  });

  it("returns no_data when chart.error is set", () => {
    const r = parseYahooChartResponse(
      { chart: { result: null, error: { code: "Not Found", description: "no data" } } },
      "BOGUS",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
    expect(r.detail).toContain("no data");
  });

  it("returns no_data when result is empty", () => {
    const r = parseYahooChartResponse({ chart: { result: [], error: null } }, "X");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
  });

  it("returns no_data when timestamp/close lengths disagree", () => {
    const fixture = {
      chart: {
        result: [
          {
            timestamp: [1, 2, 3],
            indicators: { quote: [{ close: [10, 11] }] },
          },
        ],
        error: null,
      },
    };
    const r = parseYahooChartResponse(fixture, "X");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
  });

  it("returns no_data when every close is null", () => {
    const fixture = {
      chart: {
        result: [
          {
            timestamp: [1, 2],
            indicators: { quote: [{ close: [null, null] as Array<number | null> }] },
          },
        ],
        error: null,
      },
    };
    const r = parseYahooChartResponse(fixture, "X");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
  });
});

describe("fetchYahooDailyCandles transport errors", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = (() =>
      Promise.reject(new Error("simulated network failure"))) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns transport_error when fetch rejects", async () => {
    const r = await fetchYahooDailyCandles("AAPL", 0, 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("transport_error");
    expect(r.detail).toContain("simulated network failure");
  });
});

describe("pickCandleFetcher", () => {
  const PRIOR_SRC = process.env.CANDLE_SOURCE;
  const PRIOR_TIINGO = process.env.TIINGO_API_KEY;
  afterEach(() => {
    if (PRIOR_SRC === undefined) delete process.env.CANDLE_SOURCE;
    else process.env.CANDLE_SOURCE = PRIOR_SRC;
    if (PRIOR_TIINGO === undefined) delete process.env.TIINGO_API_KEY;
    else process.env.TIINGO_API_KEY = PRIOR_TIINGO;
  });

  it("auto: returns Yahoo when no Tiingo key is set", () => {
    delete process.env.CANDLE_SOURCE;
    delete process.env.TIINGO_API_KEY;
    expect(pickCandleFetcher()).toBe(fetchYahooDailyCandles);
  });

  it("auto: returns Tiingo when TIINGO_API_KEY is set", async () => {
    delete process.env.CANDLE_SOURCE;
    process.env.TIINGO_API_KEY = "test-tiingo-key";
    const { fetchTiingoDailyCandles } = await import(
      "@/lib/research/candles-tiingo"
    );
    expect(pickCandleFetcher()).toBe(fetchTiingoDailyCandles);
  });

  it("returns the Finnhub fetcher when CANDLE_SOURCE=finnhub", () => {
    process.env.CANDLE_SOURCE = "finnhub";
    expect(pickCandleFetcher()).toBe(fetchDailyCandles);
  });

  it("returns Yahoo explicitly when CANDLE_SOURCE=yahoo even with Tiingo key", () => {
    process.env.CANDLE_SOURCE = "yahoo";
    process.env.TIINGO_API_KEY = "test-tiingo-key";
    expect(pickCandleFetcher()).toBe(fetchYahooDailyCandles);
  });

  it("returns Tiingo when CANDLE_SOURCE=tiingo", async () => {
    process.env.CANDLE_SOURCE = "tiingo";
    const { fetchTiingoDailyCandles } = await import(
      "@/lib/research/candles-tiingo"
    );
    expect(pickCandleFetcher()).toBe(fetchTiingoDailyCandles);
  });
});
