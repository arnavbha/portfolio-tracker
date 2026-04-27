import { describe, it, expect } from "vitest";
import { SP100_UNIVERSE, isInUniverse, universeSize } from "@/lib/research/universe";

describe("S&P 100 universe", () => {
  it("has roughly 100 tickers", () => {
    expect(SP100_UNIVERSE.length).toBeGreaterThanOrEqual(95);
    expect(SP100_UNIVERSE.length).toBeLessThanOrEqual(110);
  });

  it("has no duplicates", () => {
    expect(new Set(SP100_UNIVERSE).size).toBe(SP100_UNIVERSE.length);
  });

  it("tickers are uppercase letters with optional . class suffix", () => {
    for (const t of SP100_UNIVERSE) {
      expect(t).toMatch(/^[A-Z]+(\.[A-Z])?$/);
    }
  });

  it("isInUniverse matches the array", () => {
    expect(isInUniverse("AAPL")).toBe(true);
    expect(isInUniverse("ZZZZZ")).toBe(false);
  });

  it("universeSize matches the array length", () => {
    expect(universeSize()).toBe(SP100_UNIVERSE.length);
  });
});
