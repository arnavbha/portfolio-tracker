import { query } from "./db";
import type {
  ForwardReturnRow,
  ForwardReturnWindow,
  FrameworkVersionRow,
  PickRow,
  PickStatus,
  ProseStatus,
  ScanSnapshotRow,
  ThesisAnnotationRow,
  ThesisBreakerEventRow,
} from "./types";

/**
 * Read-side queries for the /research/* render pages. All Promise-returning,
 * all parameterized. Server components import these at request time; ISR
 * caches the rendered output on the Vercel edge so query rate is bounded.
 *
 * Naming convention: `getX` returns one (or null), `listX` returns an array.
 * Date params are 'YYYY-MM-DD'; ids are UUIDs.
 *
 * No row-shape transforms beyond snake→camel here. Higher-level pages compose
 * multiple queries; this module stays a flat catalog so `git grep getX` finds
 * every caller.
 */

// scan_snapshots ----------------------------------------------------------

interface ScanSnapshotRaw {
  id: string;
  scan_date: string;
  framework_version: string;
  universe_size: number;
  scores: ScanSnapshotRow["scores"];
  top_score: string; // pg numeric → string
  top_ticker: string;
  viability_threshold: string;
  viability_passed: boolean;
  picked_ticker: string | null;
  near_misses: ScanSnapshotRow["nearMisses"];
  reason_text: string | null;
  created_at: string;
}

function snapshotRowFromRaw(r: ScanSnapshotRaw): ScanSnapshotRow {
  return {
    id: r.id,
    scanDate: r.scan_date,
    frameworkVersion: r.framework_version,
    universeSize: r.universe_size,
    scores: r.scores,
    topScore: Number(r.top_score),
    topTicker: r.top_ticker,
    viabilityThreshold: Number(r.viability_threshold),
    viabilityPassed: r.viability_passed,
    pickedTicker: r.picked_ticker,
    nearMisses: r.near_misses,
    reasonText: r.reason_text,
    createdAt: r.created_at,
  };
}

export async function getMostRecentScanSnapshot(): Promise<ScanSnapshotRow | null> {
  const r = await query<ScanSnapshotRaw>(
    "SELECT * FROM scan_snapshots ORDER BY scan_date DESC, created_at DESC LIMIT 1",
  );
  return r.rows[0] ? snapshotRowFromRaw(r.rows[0]) : null;
}

export async function getScanSnapshotByDate(
  scanDate: string,
): Promise<ScanSnapshotRow | null> {
  const r = await query<ScanSnapshotRaw>(
    "SELECT * FROM scan_snapshots WHERE scan_date = $1 ORDER BY created_at DESC LIMIT 1",
    [scanDate],
  );
  return r.rows[0] ? snapshotRowFromRaw(r.rows[0]) : null;
}

export async function listRecentScanSnapshots(limit = 30): Promise<ScanSnapshotRow[]> {
  const r = await query<ScanSnapshotRaw>(
    "SELECT * FROM scan_snapshots ORDER BY scan_date DESC, created_at DESC LIMIT $1",
    [limit],
  );
  return r.rows.map(snapshotRowFromRaw);
}

// picks -------------------------------------------------------------------

interface PickRaw {
  id: string;
  ticker: string;
  scan_snapshot_id: string;
  framework_version: string;
  score: string;
  factor_scores: PickRow["factorScores"];
  thesis_text: string;
  prose_text: string | null;
  prose_status: ProseStatus;
  prose_sources: PickRow["proseSources"];
  status: PickStatus;
  issued_date: string;
  invalidated_at: string | null;
  invalidation_trigger: string | null;
  created_at: string;
}

function pickRowFromRaw(r: PickRaw): PickRow {
  return {
    id: r.id,
    ticker: r.ticker,
    scanSnapshotId: r.scan_snapshot_id,
    frameworkVersion: r.framework_version,
    score: Number(r.score),
    factorScores: r.factor_scores,
    thesisText: r.thesis_text,
    proseText: r.prose_text,
    proseStatus: r.prose_status,
    proseSources: r.prose_sources,
    status: r.status,
    issuedDate: r.issued_date,
    invalidatedAt: r.invalidated_at,
    invalidationTrigger: r.invalidation_trigger,
    createdAt: r.created_at,
  };
}

export async function getPickById(id: string): Promise<PickRow | null> {
  const r = await query<PickRaw>("SELECT * FROM picks WHERE id = $1", [id]);
  return r.rows[0] ? pickRowFromRaw(r.rows[0]) : null;
}

export async function listActivePicks(limit = 50): Promise<PickRow[]> {
  const r = await query<PickRaw>(
    "SELECT * FROM picks WHERE status = 'active' ORDER BY issued_date DESC LIMIT $1",
    [limit],
  );
  return r.rows.map(pickRowFromRaw);
}

export async function listInvalidatedPicks(limit = 100): Promise<PickRow[]> {
  const r = await query<PickRaw>(
    "SELECT * FROM picks WHERE status = 'invalidated' ORDER BY invalidated_at DESC NULLS LAST LIMIT $1",
    [limit],
  );
  return r.rows.map(pickRowFromRaw);
}

export async function listAllPicksForFeed(limit = 50): Promise<PickRow[]> {
  const r = await query<PickRaw>(
    "SELECT * FROM picks ORDER BY issued_date DESC LIMIT $1",
    [limit],
  );
  return r.rows.map(pickRowFromRaw);
}

// thesis_annotations ------------------------------------------------------

interface AnnotationRaw {
  id: string;
  pick_id: string;
  source_type: ThesisAnnotationRow["sourceType"];
  source_url: string | null;
  headline: string;
  body_text: string | null;
  is_auto: boolean;
  occurred_at: string;
  created_at: string;
}

export async function listAnnotationsForPick(
  pickId: string,
): Promise<ThesisAnnotationRow[]> {
  const r = await query<AnnotationRaw>(
    "SELECT * FROM thesis_annotations WHERE pick_id = $1 ORDER BY occurred_at DESC",
    [pickId],
  );
  return r.rows.map((x) => ({
    id: x.id,
    pickId: x.pick_id,
    sourceType: x.source_type,
    sourceUrl: x.source_url,
    headline: x.headline,
    bodyText: x.body_text,
    isAuto: x.is_auto,
    occurredAt: x.occurred_at,
    createdAt: x.created_at,
  }));
}

// breaker events ----------------------------------------------------------

interface BreakerRaw {
  id: string;
  pick_id: string;
  rule_id: string;
  state: ThesisBreakerEventRow["state"];
  trigger_event: string | null;
  trigger_url: string | null;
  is_auto: boolean;
  occurred_at: string;
  created_at: string;
}

export async function listBreakerEventsForPick(
  pickId: string,
): Promise<ThesisBreakerEventRow[]> {
  const r = await query<BreakerRaw>(
    "SELECT * FROM thesis_breaker_events WHERE pick_id = $1 ORDER BY occurred_at DESC",
    [pickId],
  );
  return r.rows.map((x) => ({
    id: x.id,
    pickId: x.pick_id,
    ruleId: x.rule_id,
    state: x.state,
    triggerEvent: x.trigger_event,
    triggerUrl: x.trigger_url,
    isAuto: x.is_auto,
    occurredAt: x.occurred_at,
    createdAt: x.created_at,
  }));
}

// forward returns ---------------------------------------------------------

interface ForwardReturnRaw {
  id: string;
  pick_id: string;
  window: ForwardReturnWindow;
  pick_date_close: string | null;
  current_close: string | null;
  abs_return: string | null;
  spy_return: string | null;
  vs_spy_return: string | null;
  computed_at: string;
}

export async function listForwardReturnsForPick(
  pickId: string,
): Promise<ForwardReturnRow[]> {
  const r = await query<ForwardReturnRaw>(
    "SELECT * FROM forward_returns WHERE pick_id = $1",
    [pickId],
  );
  return r.rows.map((x) => ({
    id: x.id,
    pickId: x.pick_id,
    window: x.window,
    pickDateClose: x.pick_date_close === null ? null : Number(x.pick_date_close),
    currentClose: x.current_close === null ? null : Number(x.current_close),
    absReturn: x.abs_return === null ? null : Number(x.abs_return),
    spyReturn: x.spy_return === null ? null : Number(x.spy_return),
    vsSpyReturn: x.vs_spy_return === null ? null : Number(x.vs_spy_return),
    computedAt: x.computed_at,
  }));
}

// framework versions ------------------------------------------------------

interface FrameworkVersionRaw {
  id: string;
  version: string;
  config_snapshot_json: FrameworkVersionRow["configSnapshotJson"];
  migration_notes: string | null;
  effective_from: string;
  created_at: string;
}

export async function listFrameworkVersions(): Promise<FrameworkVersionRow[]> {
  const r = await query<FrameworkVersionRaw>(
    "SELECT * FROM framework_versions ORDER BY effective_from DESC",
  );
  return r.rows.map((x) => ({
    id: x.id,
    version: x.version,
    configSnapshotJson: x.config_snapshot_json,
    migrationNotes: x.migration_notes,
    effectiveFrom: x.effective_from,
    createdAt: x.created_at,
  }));
}

export async function getFrameworkVersion(
  version: string,
): Promise<FrameworkVersionRow | null> {
  const r = await query<FrameworkVersionRaw>(
    "SELECT * FROM framework_versions WHERE version = $1",
    [version],
  );
  if (!r.rows[0]) return null;
  const x = r.rows[0];
  return {
    id: x.id,
    version: x.version,
    configSnapshotJson: x.config_snapshot_json,
    migrationNotes: x.migration_notes,
    effectiveFrom: x.effective_from,
    createdAt: x.created_at,
  };
}
