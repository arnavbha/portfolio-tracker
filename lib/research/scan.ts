import { FRAMEWORK_CONFIG, serializeSnapshot } from "./framework-config";
import { decideUniverse, scoreTicker, type RawFactorInput } from "./score";
import { fetchQuoteServer, sleep } from "./finnhub-server";
import { pickCandleFetcher } from "./candles-yahoo";
import { SP100_UNIVERSE } from "./universe";
import type { FactorScore, NearMiss } from "./types";
import { query, withTransaction } from "./db";

/**
 * Scan orchestrator. One call per scan-day. Idempotent on
 * (scan_date, framework_version). The CLI entrypoint lives at scripts/scan.ts.
 *
 * Pipeline:
 *   1. Hydrate universe (or override list).
 *   2. Fetch quote + 6m candles per ticker (rate-limited; 60 req/min free).
 *   3. Apply `min-history` rule — drop tickers with < 6 months of closes.
 *   4. For each survivor: build raw factor scores (computable from data,
 *      qualitative from FactorGrader), call scoreTicker.
 *   5. decideUniverse → snapshot row + (if picked) pick row.
 *
 * V1 ships with `stubFactorGrader` so the pipeline runs end-to-end without
 * LLM credentials. Swap to a Gemini-backed grader after secrets are wired —
 * see lib/research/explain.ts for the provider interface and pattern.
 */

export interface ScanInput {
  scanDate: string; // YYYY-MM-DD
  tickers?: readonly string[]; // override; defaults to SP100_UNIVERSE
  dryRun?: boolean; // skip DB writes
  factorGrader?: FactorGrader;
  /** ms between Finnhub calls; free tier is 60/min so 1100ms is safe. */
  rateLimitMs?: number;
}

export interface ScanOutput {
  scanDate: string;
  frameworkVersion: string;
  universeSize: number;
  fetchedCount: number;
  droppedForHistory: string[];
  topTicker: string;
  topScore: number;
  pickedTicker: string | null;
  viabilityPassed: boolean;
  nearMisses: NearMiss[];
  reasonText: string;
  scanSnapshotId: string | null; // null in dry-run
  pickId: string | null;
}

export interface FactorGrader {
  /**
   * Produce 0-5 scores for every factor in FRAMEWORK_CONFIG. Implementations
   * may use computable signals from `marketSignals`, qualitative judgement
   * from an LLM, or a fixed seed (testing).
   */
  grade(ticker: string, marketSignals: MarketSignals): Promise<RawFactorInput[]>;
}

export interface MarketSignals {
  ticker: string;
  current: number;
  previousClose: number;
  dailyChangePct: number;
  /** Trailing close history in ascending date order. */
  closes: Array<[number, number]>;
}

const SIX_MONTHS_SEC = 60 * 60 * 24 * 31 * 6; // ~6 months
const MIN_HISTORY_BARS = 120; // ~6 months of trading days

/** Default grader: emits 3.5 across all factors. Use for plumbing tests
 *  and dry-runs before LLM credentials are provisioned. */
export const stubFactorGrader: FactorGrader = {
  async grade() {
    return FRAMEWORK_CONFIG.factors.map((f) => ({ id: f.id, score: 3.5 }));
  },
};

export async function runScan(input: ScanInput): Promise<ScanOutput> {
  const tickers = input.tickers ?? SP100_UNIVERSE;
  const grader = input.factorGrader ?? stubFactorGrader;
  const rateMs = input.rateLimitMs ?? 1100;

  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - SIX_MONTHS_SEC;

  const fetched: MarketSignals[] = [];
  const droppedForHistory: string[] = [];
  const fetchErrors: Array<{ ticker: string; reason: string }> = [];
  const fetchCandles = pickCandleFetcher();

  for (const ticker of tickers) {
    const quote = await fetchQuoteServer(ticker);
    if (!quote.ok) {
      fetchErrors.push({ ticker, reason: quote.reason });
      await sleep(rateMs);
      continue;
    }
    await sleep(rateMs);
    const candles = await fetchCandles(ticker, sixMonthsAgo, now);
    if (!candles.ok) {
      fetchErrors.push({ ticker, reason: candles.reason });
      await sleep(rateMs);
      continue;
    }
    if (candles.data.closes.length < MIN_HISTORY_BARS) {
      droppedForHistory.push(ticker);
      await sleep(rateMs);
      continue;
    }
    fetched.push({
      ticker,
      current: quote.data.current,
      previousClose: quote.data.previousClose,
      dailyChangePct: quote.data.dailyChangePct,
      closes: candles.data.closes,
    });
    await sleep(rateMs);
  }

  if (fetched.length === 0) {
    throw new Error(
      `scan ${input.scanDate}: no tickers passed ingestion. ` +
        `dropped-for-history=${droppedForHistory.length}, fetch-errors=${fetchErrors.length}.`,
    );
  }

  const scored: Array<{ ticker: string; result: ReturnType<typeof scoreTicker> }> = [];
  const allFactorScores: Record<string, { score: number; factors: Record<string, FactorScore> }> = {};

  for (const sig of fetched) {
    const raw = await grader.grade(sig.ticker, sig);
    const result = scoreTicker(raw, FRAMEWORK_CONFIG);
    scored.push({ ticker: sig.ticker, result });
    allFactorScores[sig.ticker] = { score: result.composite, factors: result.factorScores };
  }

  const decision = decideUniverse(scored, FRAMEWORK_CONFIG);

  const reasonText =
    decision.pickedTicker === null
      ? `No ticker passed viability ≥ ${FRAMEWORK_CONFIG.thresholds.viability}. Top: ${decision.topTicker} @ ${decision.topScore}. ${decision.nearMisses.length} near-miss(es).`
      : `${decision.pickedTicker} passed viability at ${decision.topScore} on framework ${FRAMEWORK_CONFIG.version}.`;

  if (input.dryRun) {
    return {
      scanDate: input.scanDate,
      frameworkVersion: FRAMEWORK_CONFIG.version,
      universeSize: tickers.length,
      fetchedCount: fetched.length,
      droppedForHistory,
      topTicker: decision.topTicker,
      topScore: decision.topScore,
      pickedTicker: decision.pickedTicker,
      viabilityPassed: decision.viabilityPassed,
      nearMisses: decision.nearMisses,
      reasonText,
      scanSnapshotId: null,
      pickId: null,
    };
  }

  const persisted = await persistScan({
    scanDate: input.scanDate,
    frameworkVersion: FRAMEWORK_CONFIG.version,
    universeSize: tickers.length,
    scoresMap: allFactorScores,
    decision,
    reasonText,
    pickedFactorScores:
      decision.pickedTicker !== null
        ? allFactorScores[decision.pickedTicker].factors
        : null,
  });

  return {
    scanDate: input.scanDate,
    frameworkVersion: FRAMEWORK_CONFIG.version,
    universeSize: tickers.length,
    fetchedCount: fetched.length,
    droppedForHistory,
    topTicker: decision.topTicker,
    topScore: decision.topScore,
    pickedTicker: decision.pickedTicker,
    viabilityPassed: decision.viabilityPassed,
    nearMisses: decision.nearMisses,
    reasonText,
    scanSnapshotId: persisted.scanSnapshotId,
    pickId: persisted.pickId,
  };
}

interface PersistInput {
  scanDate: string;
  frameworkVersion: string;
  universeSize: number;
  scoresMap: Record<string, { score: number; factors: Record<string, FactorScore> }>;
  decision: ReturnType<typeof decideUniverse>;
  reasonText: string;
  pickedFactorScores: Record<string, FactorScore> | null;
}

interface PersistOutput {
  scanSnapshotId: string;
  pickId: string | null;
}

async function persistScan(input: PersistInput): Promise<PersistOutput> {
  // Idempotency: ON CONFLICT (scan_date, framework_version) DO NOTHING. If a
  // prior partial scan landed the snapshot row, we read it back instead of
  // re-inserting. Pick row is created only when we own the snapshot row.

  return withTransaction(async (client) => {
    const ensureFrameworkRow = await client.query(
      "SELECT 1 FROM framework_versions WHERE version = $1",
      [input.frameworkVersion],
    );
    if (ensureFrameworkRow.rowCount === 0) {
      await client.query(
        `INSERT INTO framework_versions (version, config_snapshot_json, migration_notes, effective_from)
         VALUES ($1, $2::jsonb, $3, NOW())`,
        [
          input.frameworkVersion,
          JSON.stringify(serializeSnapshot(FRAMEWORK_CONFIG)),
          "auto-seeded by first scan",
        ],
      );
    }

    const snapInsert = await client.query<{ id: string }>(
      `INSERT INTO scan_snapshots
         (scan_date, framework_version, universe_size, scores, top_score, top_ticker,
          viability_threshold, viability_passed, picked_ticker, near_misses, reason_text)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb, $11)
       ON CONFLICT (scan_date, framework_version) DO NOTHING
       RETURNING id`,
      [
        input.scanDate,
        input.frameworkVersion,
        input.universeSize,
        JSON.stringify(input.scoresMap),
        input.decision.topScore,
        input.decision.topTicker,
        FRAMEWORK_CONFIG.thresholds.viability,
        input.decision.viabilityPassed,
        input.decision.pickedTicker,
        JSON.stringify(input.decision.nearMisses),
        input.reasonText,
      ],
    );

    let scanSnapshotId: string;
    let alreadyExisted = false;
    if (snapInsert.rowCount === 0) {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM scan_snapshots WHERE scan_date = $1 AND framework_version = $2",
        [input.scanDate, input.frameworkVersion],
      );
      scanSnapshotId = existing.rows[0].id;
      alreadyExisted = true;
    } else {
      scanSnapshotId = snapInsert.rows[0].id;
    }

    let pickId: string | null = null;
    if (
      !alreadyExisted &&
      input.decision.pickedTicker !== null &&
      input.pickedFactorScores !== null
    ) {
      const pickInsert = await client.query<{ id: string }>(
        `INSERT INTO picks
           (ticker, scan_snapshot_id, framework_version, score, factor_scores,
            thesis_text, prose_status, status, issued_date)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending_validation', 'active', $7)
         RETURNING id`,
        [
          input.decision.pickedTicker,
          scanSnapshotId,
          input.frameworkVersion,
          input.decision.topScore,
          JSON.stringify(input.pickedFactorScores),
          `Auto-generated thesis stub for ${input.decision.pickedTicker} on ${input.scanDate}.`,
          input.scanDate,
        ],
      );
      pickId = pickInsert.rows[0].id;
    }

    return { scanSnapshotId, pickId };
  });
}

export async function pingDb(): Promise<boolean> {
  const r = await query<{ ok: number }>("SELECT 1 AS ok");
  return r.rows[0]?.ok === 1;
}
