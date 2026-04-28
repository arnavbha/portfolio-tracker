import { GoogleGenAI } from "@google/genai";

/**
 * Shared Gemini client factory. V1 ships on `gemini-2.5-flash` against the
 * Google AI Studio free tier. The defensive ~200 calls/day cap (see
 * `llm_call_counter` table) is enforced by the scan orchestrator, not here —
 * this module is just plumbing.
 *
 * `getGeminiClient()` returns null when GEMINI_API_KEY is unset so callers can
 * fall back to the stub provider/grader without crashing the build. That keeps
 * the pre-creds dev loop unblocked: `npm run scan:dry` still works without a
 * Gemini key.
 *
 * All LLM-touch code lives behind two interfaces — `ExplainProvider`
 * (lib/research/explain.ts) and `FactorGrader` (lib/research/scan.ts) — so the
 * V1.1 swap to Anthropic or paid Gemini is a single-file change.
 */

export const GEMINI_MODEL_ID = "gemini-2.5-flash";

let cached: GoogleGenAI | null | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    cached = null;
    return null;
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

/** Test helper. Production code never calls this. */
export function _resetGeminiClientForTests(): void {
  cached = undefined;
}
