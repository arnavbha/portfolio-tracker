import type { FactorConfig, FactorScore, FrameworkConfig, NearMiss } from "./types";

/**
 * Scoring engine. Pure functions, no I/O. Inputs are 0-5 per factor (humans grade
 * on a 5-point scale; computable factors are normalized to 5 by their fetchers
 * before reaching this module). Composite is weight-rescaled to 0-100 so it lines
 * up with the viability threshold (75) and near-miss band (70-74).
 *
 * Hard floors short-circuit viability: any factor below its floor disqualifies
 * the ticker even if the composite clears 75. The Pick row keeps the full
 * per-factor breakdown so the diff/explain pages can render gaps.
 */

export interface RawFactorInput {
  id: string;
  /** 0-5, inclusive. NaN/out-of-range throws. */
  score: number;
  /** Optional human-readable note carried through to the Pick row. */
  note?: string | null;
}

export interface ScoreResult {
  composite: number;
  factorScores: Record<string, FactorScore>;
  floorsTripped: string[];
  /** composite >= viability AND no floors tripped. */
  passedViability: boolean;
  /** In near-miss band AND no floors tripped. */
  isNearMiss: boolean;
}

const MIN_RAW = 0;
const MAX_RAW = 5;

function assertValidRaw(score: number, factorId: string): void {
  if (Number.isNaN(score) || score < MIN_RAW || score > MAX_RAW) {
    throw new Error(`factor ${factorId}: score ${score} out of range [${MIN_RAW}, ${MAX_RAW}]`);
  }
}

function indexFactors(config: FrameworkConfig): Map<string, FactorConfig> {
  return new Map(config.factors.map((f) => [f.id, f]));
}

/**
 * Score a single ticker against the framework. Throws on unknown factor ids,
 * missing factors, or out-of-range scores — silent skips at this layer would
 * produce inflated scores at the persistence layer.
 */
export function scoreTicker(inputs: RawFactorInput[], config: FrameworkConfig): ScoreResult {
  const byId = indexFactors(config);

  const seen = new Set<string>();
  const factorScores: Record<string, FactorScore> = {};
  const floorsTripped: string[] = [];
  let weightedSum = 0;

  for (const input of inputs) {
    const factor = byId.get(input.id);
    if (!factor) throw new Error(`unknown factor id: ${input.id}`);
    if (seen.has(input.id)) throw new Error(`duplicate factor id: ${input.id}`);
    seen.add(input.id);
    assertValidRaw(input.score, input.id);

    factorScores[input.id] = {
      score: input.score,
      weight: factor.weight,
      note: input.note ?? null,
    };

    weightedSum += (input.score / MAX_RAW) * factor.weight;

    if (factor.hardFloor !== null && input.score < factor.hardFloor) {
      floorsTripped.push(input.id);
    }
  }

  for (const factor of config.factors) {
    if (!seen.has(factor.id)) {
      throw new Error(`missing factor: ${factor.id} — score every factor in the framework`);
    }
  }

  const composite = round2(weightedSum);
  const { viability, nearMissBandLow, nearMissBandHigh } = config.thresholds;
  const noFloorsTripped = floorsTripped.length === 0;

  return {
    composite,
    factorScores,
    floorsTripped,
    passedViability: composite >= viability && noFloorsTripped,
    isNearMiss:
      noFloorsTripped &&
      composite >= nearMissBandLow &&
      composite <= nearMissBandHigh,
  };
}

/**
 * Reduce a per-ticker scoring map into the snapshot fields:
 *   topScore, topTicker, viabilityPassed, pickedTicker, nearMisses.
 *
 * Tie-break on top: alphabetical by ticker. Deterministic so re-scans match.
 * pickedTicker is null on null-days (no ticker passed viability).
 */
export interface UniverseScoreInput {
  ticker: string;
  result: ScoreResult;
}

export interface UniverseDecision {
  topTicker: string;
  topScore: number;
  pickedTicker: string | null;
  viabilityPassed: boolean;
  nearMisses: NearMiss[];
}

export function decideUniverse(scored: UniverseScoreInput[], config: FrameworkConfig): UniverseDecision {
  if (scored.length === 0) throw new Error("decideUniverse called with empty universe");

  const sorted = [...scored].sort((a, b) => {
    if (b.result.composite !== a.result.composite) return b.result.composite - a.result.composite;
    return a.ticker.localeCompare(b.ticker);
  });

  const top = sorted[0];
  const passingCandidates = sorted.filter((s) => s.result.passedViability);
  const picked = passingCandidates[0] ?? null;

  const nearMisses: NearMiss[] = sorted
    .filter((s) => s.result.isNearMiss)
    .map((s) => {
      const failingFactor = lowestRelativeFactor(s.result.factorScores, config);
      return {
        ticker: s.ticker,
        score: s.result.composite,
        failingFactor: failingFactor.id,
        factorGap: failingFactor.gapTo5,
      };
    });

  return {
    topTicker: top.ticker,
    topScore: top.result.composite,
    pickedTicker: picked?.ticker ?? null,
    viabilityPassed: picked !== null,
    nearMisses,
  };
}

function lowestRelativeFactor(
  factorScores: Record<string, FactorScore>,
  config: FrameworkConfig,
): { id: string; gapTo5: number } {
  // "Failing factor" for a near-miss = the factor where lifting it to 5 would
  // recover the most weighted points. That's just the largest (5 - score) * weight.
  const byId = indexFactors(config);
  let bestId = "";
  let bestGain = -1;
  for (const [id, fs] of Object.entries(factorScores)) {
    const factor = byId.get(id);
    if (!factor) continue;
    const gain = (MAX_RAW - fs.score) * factor.weight;
    if (gain > bestGain) {
      bestGain = gain;
      bestId = id;
    }
  }
  const fs = factorScores[bestId];
  return { id: bestId, gapTo5: round2(MAX_RAW - fs.score) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
