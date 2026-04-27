import { describe, it, expect } from "vitest";
import { segmentSentences, validateProse } from "@/lib/research/explain";
import type { ProseSource } from "@/lib/research/types";

const SOURCES: ProseSource[] = [
  { n: 1, sourceType: "8-K", url: "https://sec.gov/x", label: "Q1 8-K" },
  { n: 2, sourceType: "news", url: "https://example.com/y", label: "Reuters" },
];

describe("segmentSentences", () => {
  it("splits compound sentences", () => {
    const s = segmentSentences("Revenue grew 12%. Margin expanded 200bps. Buybacks resumed.");
    expect(s.length).toBe(3);
  });

  it("preserves abbreviations and decimals as a single sentence", () => {
    const s = segmentSentences("Revenue grew 4.2% this quarter according to mgmt.");
    expect(s.length).toBe(1);
  });

  it("returns empty for blank input", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("   \n  ")).toEqual([]);
  });
});

describe("validateProse", () => {
  it("passes when every sentence ends with a known [src:N]", () => {
    const prose = "Revenue grew 12% [src:1]. Margins expanded 200bps [src:2].";
    const r = validateProse(prose, SOURCES);
    expect(r.ok).toBe(true);
    expect(r.failedSentences).toEqual([]);
  });

  it("fails sentences with no citation", () => {
    const prose = "Revenue grew 12%. Margins expanded 200bps [src:2].";
    const r = validateProse(prose, SOURCES);
    expect(r.ok).toBe(false);
    expect(r.failedSentences).toHaveLength(1);
    expect(r.failedSentences[0].reason).toMatch(/no \[src:N\]/);
  });

  it("fails on unknown citations", () => {
    const prose = "Revenue grew 12% [src:9]. Margins expanded 200bps [src:2].";
    const r = validateProse(prose, SOURCES);
    expect(r.ok).toBe(false);
    expect(r.unknownCitations).toEqual([9]);
    expect(r.failedSentences[0].reason).toMatch(/unknown citation/);
  });

  it("requires the citation at end of sentence, not mid-sentence", () => {
    const prose = "Revenue grew [src:1] sharply this quarter.";
    const r = validateProse(prose, SOURCES);
    expect(r.ok).toBe(false);
    expect(r.failedSentences[0].reason).toMatch(/end of sentence/);
  });

  it("accepts a trailing terminator after the citation", () => {
    const prose = "Revenue grew 12% [src:1]. Margins expanded 200bps [src:2].";
    expect(validateProse(prose, SOURCES).ok).toBe(true);
  });

  it("ok=false when prose is empty (no sentences to validate)", () => {
    const r = validateProse("", SOURCES);
    expect(r.ok).toBe(false);
    expect(r.sentences).toEqual([]);
  });

  it("multiple citations in one sentence are all checked", () => {
    const prose = "Revenue grew per 8-K and news [src:1] [src:2].";
    const r = validateProse(prose, SOURCES);
    expect(r.ok).toBe(true);
    expect(r.sentences[0].citationsCited).toEqual([1, 2]);
  });
});
