import type { ProseSource } from "./types";

/**
 * Citation validator for LLM-generated thesis prose.
 *
 * Hard rule: every sentence in the prose body must end with at least one [src:N]
 * token, where N references a known ProseSource.n. Otherwise the validator
 * marks the sentence failed; the orchestrator retries up to attempt cap, then
 * downgrades prose_status to 'unavailable' and records the failure rows.
 *
 * Sentence segmentation uses Intl.Segmenter('en', { granularity: 'sentence' }),
 * which is built into V8/JSC and handles abbreviations, decimals, and inline
 * URLs more robustly than a regex split. Available in Node 16+ and modern
 * browsers — no polyfill needed for our target runtimes.
 *
 * Model-agnostic on purpose: this layer doesn't know if Gemini, Claude, or a
 * local model produced the prose. Swap providers behind ExplainProvider and
 * the validator stays put.
 */

export interface ValidatedSentence {
  sentence: string;
  ok: boolean;
  reason: string | null;
  citationsCited: number[];
}

export interface ValidationResult {
  ok: boolean;
  sentences: ValidatedSentence[];
  failedSentences: Array<{ sentence: string; reason: string }>;
  unknownCitations: number[];
}

const CITATION_RE = /\[src:(\d+)\]/g;

export function segmentSentences(prose: string): string[] {
  const trimmed = prose.trim();
  if (!trimmed) return [];

  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) {
    // Defensive fallback for runtimes without Intl.Segmenter. Splits on
    // sentence-ending punctuation followed by whitespace + capital. Imperfect
    // but only kicks in on extremely old runtimes.
    return trimmed
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const segmenter = new Seg("en", { granularity: "sentence" });
  const out: string[] = [];
  for (const seg of segmenter.segment(trimmed)) {
    const s = seg.segment.trim();
    if (s) out.push(s);
  }
  return out;
}

export function validateProse(prose: string, sources: ProseSource[]): ValidationResult {
  const knownIds = new Set(sources.map((s) => s.n));
  const sentences = segmentSentences(prose);

  const validated: ValidatedSentence[] = [];
  const failed: ValidationResult["failedSentences"] = [];
  const unknownCitations = new Set<number>();

  for (const sentence of sentences) {
    const cited = parseCitations(sentence);
    let reason: string | null = null;
    if (cited.length === 0) {
      reason = "no [src:N] citation at end of sentence";
    } else {
      const unknowns = cited.filter((n) => !knownIds.has(n));
      for (const u of unknowns) unknownCitations.add(u);
      if (unknowns.length > 0) {
        reason = `unknown citation(s): ${unknowns.map((n) => `[src:${n}]`).join(", ")}`;
      } else if (!sentenceEndsWithCitation(sentence)) {
        reason = "citation must appear at end of sentence";
      }
    }
    const ok = reason === null;
    validated.push({ sentence, ok, reason, citationsCited: cited });
    if (!ok) failed.push({ sentence, reason: reason! });
  }

  return {
    ok: failed.length === 0 && validated.length > 0,
    sentences: validated,
    failedSentences: failed,
    unknownCitations: [...unknownCitations].sort((a, b) => a - b),
  };
}

function parseCitations(sentence: string): number[] {
  const out: number[] = [];
  for (const m of sentence.matchAll(CITATION_RE)) {
    out.push(Number(m[1]));
  }
  return out;
}

function sentenceEndsWithCitation(sentence: string): boolean {
  // Allow trailing terminator after the last citation, e.g. "...so X grew [src:2]."
  return /\[src:\d+\][\s.!?")']*$/.test(sentence.trimEnd());
}

/**
 * Provider interface. Keeps the orchestrator's call site stable across LLMs.
 * `system` carries the framework constraint preamble; `prompt` carries the
 * per-pick payload (factor scores, sources, recent annotations). The provider
 * must not retry — orchestrator owns retry policy and rate-limit accounting.
 */
export interface ExplainRequest {
  system: string;
  prompt: string;
  sources: ProseSource[];
}

export interface ExplainResponse {
  prose: string;
  modelId: string;
}

export type ExplainProvider = (req: ExplainRequest) => Promise<ExplainResponse>;
