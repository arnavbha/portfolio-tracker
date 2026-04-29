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
  /** ms between FactorGrader calls. Gemini free tier is 10 RPM on
   *  gemini-2.5-flash, so 6500ms is a safe floor (~9.2/min). Set 0 when
   *  the grader is the local stub to avoid an unnecessary 11-minute pause
   *  on a 100-ticker dry-run. */
  graderPaceMs?: number;
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
  /** Tickers where the primary grader threw and the stub was used instead. */
  graderFallbacks: Array<{ ticker: string; error: string }>;
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
  // Stub grader is local + free; Gemini grader is paced to stay under 10 RPM
  // on the free tier. Caller can override with graderPaceMs explicitly.
  const graderPaceMs =
    input.graderPaceMs ?? (grader === stubFactorGrader ? 0 : 6500);

  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - SIX_MONTHS_SEC;

  // `SKIP_HISTORY=1` runs the scan without daily candles. The `min-history`
  // framework rule becomes a no-op and forward-return windows lose their
  // pick-date close anchor. Use only when the candle source is wedged and
  // running a degraded scan tonight beats not running one at all. The
  // snapshot reasonText carries a `[SKIP_HISTORY]` tag so the persisted row
  // is auditable.
  const skipHistory = process.env.SKIP_HISTORY === "1";

  const fetched: MarketSignals[] = [];
  const droppedForHistory: string[] = [];
  // `stage` tells us which side of the pipeline rejected each ticker, so a
  // failed scan's error message points at the actual culprit (quote vs candle)
  // instead of a single opaque counter.
  const fetchErrors: Array<{ ticker: string; stage: "quote" | "candle"; reason: string; detail?: string }> = [];
  const fetchCandles = pickCandleFetcher();

  for (const ticker of tickers) {
    const quote = await fetchQuoteServer(ticker);
    if (!quote.ok) {
      fetchErrors.push({ ticker, stage: "quote", reason: quote.reason, detail: quote.detail });
      await sleep(rateMs);
      continue;
    }
    if (skipHistory) {
      fetched.push({
        ticker,
        current: quote.data.current,
        previousClose: quote.data.previousClose,
        dailyChangePct: quote.data.dailyChangePct,
        closes: [],
      });
      await sleep(rateMs);
      continue;
    }
    await sleep(rateMs);
    const candles = await fetchCandles(ticker, sixMonthsAgo, now);
    if (!candles.ok) {
      fetchErrors.push({ ticker, stage: "candle", reason: candles.reason, detail: candles.detail });
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
    const sample = fetchErrors
      .slice(0, 5)
      .map((e) => `  ${e.ticker} [${e.stage}] ${e.reason}${e.detail ? ` — ${e.detail}` : ""}`)
      .join("\n");
    throw new Error(
      `scan ${input.scanDate}: no tickers passed ingestion. ` +
        `dropped-for-history=${droppedForHistory.length}, fetch-errors=${fetchErrors.length}.\n` +
        `First failures:\n${sample}`,
    );
  }

  const scored: Array<{ ticker: string; result: ReturnType<typeof scoreTicker> }> = [];
  const allFactorScores: Record<string, { score: number; factors: Record<string, FactorScore> }> = {};

  // Per-ticker resilience: if the primary grader throws (Gemini quota,
  // transport, schema-validation, etc.), fall back to the stub grader for
  // that one ticker and keep going. Without this, a single 429 mid-loop
  // kills the entire scan and nothing persists. The fallback is recorded so
  // the snapshot reasonText surfaces how degraded the grading was.
  const graderFailures: Array<{ ticker: string; error: string }> = [];

  for (let i = 0; i < fetched.length; i++) {
    const sig = fetched[i];
    let raw: RawFactorInput[];
    try {
      raw = await grader.grade(sig.ticker, sig);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      graderFailures.push({ ticker: sig.ticker, error: msg.slice(0, 200) });
      raw = await stubFactorGrader.grade(sig.ticker, sig);
    }
    const result = scoreTicker(raw, FRAMEWORK_CONFIG);
    scored.push({ ticker: sig.ticker, result });
    allFactorScores[sig.ticker] = { score: result.composite, factors: result.factorScores };
    // Pace before the next call (not the last one) so total wall time doesn't
    // include a trailing sleep we don't need.
    if (graderPaceMs > 0 && i < fetched.length - 1) {
      await sleep(graderPaceMs);
    }
  }

  const decision = decideUniverse(scored, FRAMEWORK_CONFIG);

  const tags: string[] = [];
  if (skipHistory) tags.push("[SKIP_HISTORY]");
  if (graderFailures.length > 0) {
    tags.push(`[STUB_FALLBACK ${graderFailures.length}/${fetched.length}]`);
  }
  const tag = tags.length > 0 ? `${tags.join(" ")} ` : "";
  const reasonText =
    decision.pickedTicker === null
      ? `${tag}No ticker passed viability ≥ ${FRAMEWORK_CONFIG.thresholds.viability}. Top: ${decision.topTicker} @ ${decision.topScore}. ${decision.nearMisses.length} near-miss(es).`
      : `${tag}${decision.pickedTicker} passed viability at ${decision.topScore} on framework ${FRAMEWORK_CONFIG.version}.`;

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
      graderFallbacks: graderFailures,
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
    graderFallbacks: graderFailures,
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
