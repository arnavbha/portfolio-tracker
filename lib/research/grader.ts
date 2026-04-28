import { Type } from "@google/genai";
import { FRAMEWORK_CONFIG } from "./framework-config";
import { GEMINI_MODEL_ID, getGeminiClient } from "./gemini";
import { stubFactorGrader, type FactorGrader, type MarketSignals } from "./scan";
import type { RawFactorInput } from "./score";

/**
 * Gemini-backed `FactorGrader`. Emits a 0–5 score for every factor in
 * `FRAMEWORK_CONFIG`, structured-output enforced via `responseSchema`. Throws
 * if any factor is missing or out of range — the caller's `scoreTicker` would
 * throw on the same condition, but failing here gives a cleaner error.
 *
 * Scope intentionally narrow: this provider does not retry, does not track
 * the daily call counter (that's `lib/research/scan.ts`'s job), and does not
 * fall back. If GEMINI_API_KEY is unset, callers should pick `stubFactorGrader`
 * before reaching this module — see `pickFactorGrader()` below.
 */

const FACTOR_IDS = FRAMEWORK_CONFIG.factors.map((f) => f.id);

const SYSTEM_INSTRUCTION = [
  "You grade S&P 100 tickers against a fixed equity-research framework.",
  "Output JSON: an object with a `factors` array. Each entry is { id: string, score: number, note?: string }.",
  "score is 0–5 inclusive, decimals allowed (e.g. 3.5). 0 = catastrophic, 5 = best in class.",
  "Score every factor id provided. Never invent a factor id. Never omit a factor.",
  "note (optional) is a single short clause — what drove the score, no marketing language.",
  "Be skeptical. Most large-cap names sit between 2.5 and 4.0. Reserve >=4.5 for genuinely best-in-class evidence.",
].join(" ");

interface GeminiFactorOut {
  id: string;
  score: number;
  note?: string;
}
interface GeminiOutput {
  factors: GeminiFactorOut[];
}

function buildResponseSchema(): { type: Type; properties: Record<string, unknown>; required: string[] } {
  return {
    type: Type.OBJECT,
    properties: {
      factors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, enum: FACTOR_IDS },
            score: { type: Type.NUMBER },
            note: { type: Type.STRING },
          },
          required: ["id", "score"],
        },
      },
    },
    required: ["factors"],
  };
}

function buildPrompt(ticker: string, signals: MarketSignals): string {
  const last = signals.closes[signals.closes.length - 1];
  const first = signals.closes[0];
  const sixMoReturn =
    first && last ? ((last[1] - first[1]) / first[1]) * 100 : null;
  const factorList = FRAMEWORK_CONFIG.factors
    .map((f) => `- ${f.id} (${f.label}, weight ${f.weight}, type ${f.type})`)
    .join("\n");
  return [
    `Ticker: ${ticker}`,
    `Current price: ${signals.current.toFixed(2)} (prev close ${signals.previousClose.toFixed(2)}, daily ${signals.dailyChangePct.toFixed(2)}%)`,
    sixMoReturn === null
      ? "6-month return: unavailable"
      : `6-month price return: ${sixMoReturn.toFixed(2)}%`,
    `History bars available: ${signals.closes.length}`,
    "",
    "Factors to grade (must score every one):",
    factorList,
    "",
    "Return the JSON object now.",
  ].join("\n");
}

export const geminiFactorGrader: FactorGrader = {
  async grade(ticker, signals) {
    const client = getGeminiClient();
    if (!client) {
      throw new Error(
        "geminiFactorGrader invoked without GEMINI_API_KEY — use pickFactorGrader() to fall back to the stub.",
      );
    }
    const response = await client.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: buildPrompt(ticker, signals),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: buildResponseSchema(),
        maxOutputTokens: 2048,
      },
    });
    const raw = (response.text ?? "").trim();
    if (!raw) throw new Error(`geminiFactorGrader: empty response for ${ticker}`);

    let parsed: GeminiOutput;
    try {
      parsed = JSON.parse(raw) as GeminiOutput;
    } catch (e) {
      throw new Error(
        `geminiFactorGrader: non-JSON response for ${ticker}: ${(e as Error).message}`,
      );
    }
    return validateAndShape(parsed, ticker);
  },
};

export function validateAndShape(parsed: GeminiOutput, ticker: string): RawFactorInput[] {
  const known = new Set(FACTOR_IDS);
  const seen = new Set<string>();
  const out: RawFactorInput[] = [];
  for (const f of parsed.factors ?? []) {
    if (!known.has(f.id)) {
      throw new Error(`geminiFactorGrader: unknown factor ${f.id} for ${ticker}`);
    }
    if (seen.has(f.id)) {
      throw new Error(`geminiFactorGrader: duplicate factor ${f.id} for ${ticker}`);
    }
    if (typeof f.score !== "number" || Number.isNaN(f.score)) {
      throw new Error(`geminiFactorGrader: non-numeric score for ${f.id} on ${ticker}`);
    }
    if (f.score < 0 || f.score > 5) {
      throw new Error(
        `geminiFactorGrader: score ${f.score} out of range for ${f.id} on ${ticker}`,
      );
    }
    seen.add(f.id);
    out.push({
      id: f.id,
      score: f.score,
      note: f.note?.trim() ? f.note.trim() : null,
    });
  }
  for (const id of FACTOR_IDS) {
    if (!seen.has(id)) {
      throw new Error(`geminiFactorGrader: missing factor ${id} for ${ticker}`);
    }
  }
  return out;
}

/**
 * Picks Gemini if `GEMINI_API_KEY` is set, otherwise returns the stub.
 * Use from scripts/scan.ts so dry-runs without creds still exercise the
 * full pipeline end-to-end.
 */
export function pickFactorGrader(): FactorGrader {
  return process.env.GEMINI_API_KEY ? geminiFactorGrader : stubFactorGrader;
}
