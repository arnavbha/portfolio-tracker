import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fetchTiingoDailyCandles,
  parseTiingoPriceResponse,
} from "@/lib/research/candles-tiingo";

describe("parseTiingoPriceResponse", () => {
  it("parses a daily price array, prefers adjClose, sorts ascending", () => {
    const json = [
      { date: "2026-04-23T00:00:00.000Z", close: 200, adjClose: 199.5 },
      { date: "2026-04-21T00:00:00.000Z", close: 198, adjClose: 197.5 },
      { date: "2026-04-22T00:00:00.000Z", close: 199, adjClose: 198.5 },
    ];
    const r = parseTiingoPriceResponse(json, "AAPL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.ticker).toBe("AAPL");
    expect(r.data.closes.map(([, c]) => c)).toEqual([197.5, 198.5, 199.5]);
    // unix seconds, sorted ascending
    expect(r.data.closes[0][0]).toBeLessThan(r.data.closes[1][0]);
    expect(r.data.closes[1][0]).toBeLessThan(r.data.closes[2][0]);
  });

  it("falls back to raw close when adjClose is non-finite", () => {
    const json = [
      { date: "2026-04-22T00:00:00.000Z", close: 199, adjClose: NaN },
    ];
    const r = parseTiingoPriceResponse(json, "AAPL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.closes[0][1]).toBe(199);
  });

  it("returns no_data on non-array response", () => {
    const r = parseTiingoPriceResponse({ detail: "not found" }, "X");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
  });

  it("returns no_data on empty array", () => {
    const r = parseTiingoPriceResponse([], "X");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_data");
  });

  it("skips rows with non-finite closes and unparseable dates", () => {
    const json = [
      { date: "not a date", close: 1, adjClose: 1 },
      { date: "2026-04-22T00:00:00.000Z", close: NaN, adjClose: NaN },
      { date: "2026-04-23T00:00:00.000Z", close: 200, adjClose: 199.5 },
    ];
    const r = parseTiingoPriceResponse(json, "X");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.closes.length).toBe(1);
    expect(r.data.closes[0][1]).toBe(199.5);
  });
});

describe("fetchTiingoDailyCandles missing-key path", () => {
  const PRIOR = process.env.TIINGO_API_KEY;
  beforeEach(() => {
    delete process.env.TIINGO_API_KEY;
  });
  afterEach(() => {
    if (PRIOR) process.env.TIINGO_API_KEY = PRIOR;
    else delete process.env.TIINGO_API_KEY;
  });

  it("returns missing_key when TIINGO_API_KEY is unset", async () => {
    const r = await fetchTiingoDailyCandles("AAPL", 0, 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("missing_key");
  });
});
