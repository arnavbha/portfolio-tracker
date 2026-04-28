import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FRAMEWORK_CONFIG } from "@/lib/research/framework-config";
import {
  geminiFactorGrader,
  pickFactorGrader,
  validateAndShape,
} from "@/lib/research/grader";
import { stubFactorGrader, type MarketSignals } from "@/lib/research/scan";
import { _resetGeminiClientForTests } from "@/lib/research/gemini";

const SIGNAL: MarketSignals = {
  ticker: "AAPL",
  current: 200,
  previousClose: 198,
  dailyChangePct: 1.01,
  closes: Array.from({ length: 130 }, (_, i) => [i, 180 + i * 0.1]) as Array<[number, number]>,
};

describe("validateAndShape", () => {
  it("accepts a complete factor list", () => {
    const factors = FRAMEWORK_CONFIG.factors.map((f, i) => ({
      id: f.id,
      score: 3 + (i % 3) * 0.25,
      note: i % 2 === 0 ? "ok" : undefined,
    }));
    const out = validateAndShape({ factors }, "AAPL");
    expect(out.length).toBe(FRAMEWORK_CONFIG.factors.length);
    expect(out.every((f) => f.score >= 0 && f.score <= 5)).toBe(true);
    // notes round-tripped (undefined → null)
    expect(out[1].note).toBeNull();
    expect(out[0].note).toBe("ok");
  });

  it("throws on missing factor", () => {
    const factors = FRAMEWORK_CONFIG.factors
      .slice(1)
      .map((f) => ({ id: f.id, score: 3 }));
    expect(() => validateAndShape({ factors }, "AAPL")).toThrow(/missing factor/);
  });

  it("throws on unknown factor id", () => {
    const factors = FRAMEWORK_CONFIG.factors.map((f) => ({ id: f.id, score: 3 }));
    factors[0] = { id: "totally-bogus-factor-id", score: 3 };
    expect(() => validateAndShape({ factors }, "AAPL")).toThrow(/unknown factor/);
  });

  it("throws on out-of-range score", () => {
    const factors = FRAMEWORK_CONFIG.factors.map((f) => ({ id: f.id, score: 3 }));
    factors[0].score = 7.5;
    expect(() => validateAndShape({ factors }, "AAPL")).toThrow(/out of range/);
  });

  it("throws on duplicate factor id", () => {
    const factors = FRAMEWORK_CONFIG.factors.map((f) => ({ id: f.id, score: 3 }));
    factors[1] = { ...factors[1], id: factors[0].id };
    expect(() => validateAndShape({ factors }, "AAPL")).toThrow(/duplicate factor/);
  });
});

describe("geminiFactorGrader without GEMINI_API_KEY", () => {
  const PRIOR = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    _resetGeminiClientForTests();
  });
  afterEach(() => {
    if (PRIOR) process.env.GEMINI_API_KEY = PRIOR;
    _resetGeminiClientForTests();
  });

  it("throws a useful error when called without an API key", async () => {
    await expect(geminiFactorGrader.grade("AAPL", SIGNAL)).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });
});

describe("pickFactorGrader", () => {
  const PRIOR = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    _resetGeminiClientForTests();
  });
  afterEach(() => {
    if (PRIOR === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = PRIOR;
    _resetGeminiClientForTests();
  });

  it("returns the stub grader when GEMINI_API_KEY is unset", () => {
    delete process.env.GEMINI_API_KEY;
    expect(pickFactorGrader()).toBe(stubFactorGrader);
  });

  it("returns the gemini grader when GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "test-key-for-selector-only";
    expect(pickFactorGrader()).toBe(geminiFactorGrader);
  });
});
