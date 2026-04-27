import { describe, it, expect } from "vitest";
import { scoreTicker, decideUniverse, type RawFactorInput } from "@/lib/research/score";
import { FRAMEWORK_CONFIG, totalWeight } from "@/lib/research/framework-config";

function fullScores(score: number, overrides: Record<string, number> = {}): RawFactorInput[] {
  return FRAMEWORK_CONFIG.factors.map((f) => ({
    id: f.id,
    score: overrides[f.id] ?? score,
  }));
}

describe("framework weights", () => {
  it("sum to exactly 100 — composite scale lines up with thresholds", () => {
    expect(totalWeight(FRAMEWORK_CONFIG)).toBe(100);
  });
});

describe("scoreTicker", () => {
  it("a perfect 5 across all factors yields composite 100", () => {
    const r = scoreTicker(fullScores(5), FRAMEWORK_CONFIG);
    expect(r.composite).toBe(100);
    expect(r.passedViability).toBe(true);
    expect(r.floorsTripped).toEqual([]);
  });

  it("zero across all factors yields composite 0 and trips every floor that has one", () => {
    const r = scoreTicker(fullScores(0), FRAMEWORK_CONFIG);
    expect(r.composite).toBe(0);
    expect(r.passedViability).toBe(false);
    const floorFactorIds = FRAMEWORK_CONFIG.factors.filter((f) => f.hardFloor !== null).map((f) => f.id);
    expect(r.floorsTripped.sort()).toEqual(floorFactorIds.sort());
  });

  it("a 4 across the board → composite 80, no floors tripped", () => {
    const r = scoreTicker(fullScores(4), FRAMEWORK_CONFIG);
    expect(r.composite).toBe(80);
    expect(r.passedViability).toBe(true);
    expect(r.floorsTripped).toEqual([]);
  });

  it("hard floor disqualifies despite high composite", () => {
    // Strong everywhere but one floor tripped → must NOT pass viability.
    const r = scoreTicker(fullScores(5, { "moat-defensibility": 1 }), FRAMEWORK_CONFIG);
    expect(r.composite).toBeGreaterThan(75);
    expect(r.floorsTripped).toContain("moat-defensibility");
    expect(r.passedViability).toBe(false);
  });

  it("near-miss band is 70-74 inclusive, no floors tripped", () => {
    // 3.5 across the board = 70.
    const r = scoreTicker(fullScores(3.5), FRAMEWORK_CONFIG);
    expect(r.composite).toBe(70);
    expect(r.isNearMiss).toBe(true);
    expect(r.passedViability).toBe(false);
  });

  it("near-miss flag false when a hard floor is tripped, even in the 70-74 band", () => {
    const r = scoreTicker(fullScores(3.5, { "moat-defensibility": 1 }), FRAMEWORK_CONFIG);
    expect(r.isNearMiss).toBe(false);
  });

  it("throws on missing factor", () => {
    const partial = fullScores(4).slice(0, -1);
    expect(() => scoreTicker(partial, FRAMEWORK_CONFIG)).toThrow(/missing factor/);
  });

  it("throws on unknown factor", () => {
    const inputs = [...fullScores(4), { id: "made-up", score: 5 }];
    expect(() => scoreTicker(inputs, FRAMEWORK_CONFIG)).toThrow(/unknown factor/);
  });

  it("throws on duplicate factor", () => {
    const inputs = [...fullScores(4), { id: "moat-defensibility", score: 5 }];
    expect(() => scoreTicker(inputs, FRAMEWORK_CONFIG)).toThrow(/duplicate factor/);
  });

  it("throws on out-of-range score", () => {
    expect(() => scoreTicker(fullScores(4, { "catalysts": 6 }), FRAMEWORK_CONFIG)).toThrow(/out of range/);
    expect(() => scoreTicker(fullScores(4, { "catalysts": -1 }), FRAMEWORK_CONFIG)).toThrow(/out of range/);
  });
});

describe("decideUniverse", () => {
  it("picks the highest passing ticker", () => {
    const scored = [
      { ticker: "AAA", result: scoreTicker(fullScores(4), FRAMEWORK_CONFIG) },
      { ticker: "BBB", result: scoreTicker(fullScores(5), FRAMEWORK_CONFIG) },
      { ticker: "CCC", result: scoreTicker(fullScores(3), FRAMEWORK_CONFIG) },
    ];
    const d = decideUniverse(scored, FRAMEWORK_CONFIG);
    expect(d.pickedTicker).toBe("BBB");
    expect(d.viabilityPassed).toBe(true);
    expect(d.topTicker).toBe("BBB");
    expect(d.topScore).toBe(100);
  });

  it("returns null pick when nothing passes viability", () => {
    const scored = [
      { ticker: "AAA", result: scoreTicker(fullScores(3), FRAMEWORK_CONFIG) },
      { ticker: "BBB", result: scoreTicker(fullScores(2), FRAMEWORK_CONFIG) },
    ];
    const d = decideUniverse(scored, FRAMEWORK_CONFIG);
    expect(d.pickedTicker).toBeNull();
    expect(d.viabilityPassed).toBe(false);
    expect(d.topTicker).toBe("AAA");
  });

  it("collects near-miss tickers in the 70-74 band", () => {
    const scored = [
      { ticker: "AAA", result: scoreTicker(fullScores(3.5), FRAMEWORK_CONFIG) }, // 70
      { ticker: "BBB", result: scoreTicker(fullScores(4), FRAMEWORK_CONFIG) },   // 80, picked
      { ticker: "CCC", result: scoreTicker(fullScores(3), FRAMEWORK_CONFIG) },   // 60, not near-miss
    ];
    const d = decideUniverse(scored, FRAMEWORK_CONFIG);
    expect(d.nearMisses.map((n) => n.ticker)).toEqual(["AAA"]);
    expect(d.nearMisses[0].failingFactor).toBeTruthy();
  });

  it("alphabetical tie-break on top ticker for identical composites", () => {
    const scored = [
      { ticker: "ZZZ", result: scoreTicker(fullScores(4), FRAMEWORK_CONFIG) },
      { ticker: "AAA", result: scoreTicker(fullScores(4), FRAMEWORK_CONFIG) },
    ];
    const d = decideUniverse(scored, FRAMEWORK_CONFIG);
    expect(d.topTicker).toBe("AAA");
    expect(d.pickedTicker).toBe("AAA");
  });

  it("throws on empty universe", () => {
    expect(() => decideUniverse([], FRAMEWORK_CONFIG)).toThrow(/empty universe/);
  });
});
