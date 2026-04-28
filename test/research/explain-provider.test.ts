import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { geminiExplainProvider } from "@/lib/research/explain";
import { _resetGeminiClientForTests } from "@/lib/research/gemini";

describe("geminiExplainProvider without GEMINI_API_KEY", () => {
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
    await expect(
      geminiExplainProvider({
        system: "test system",
        prompt: "test prompt",
        sources: [
          { n: 1, sourceType: "8-K", url: "https://example.com", label: "Q1 8-K" },
        ],
      }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
