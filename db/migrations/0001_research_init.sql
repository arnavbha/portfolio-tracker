-- Research section schema. First Postgres surface in this repo.
-- Run against Neon free tier. Append-only tables wherever possible.
-- See ceo-plans/2026-04-23-research-section.md Step 2 + Accepted Scope #4.

BEGIN;

-- Framework versions are seeded BEFORE the first scan runs.
-- config_snapshot_json is hand-curated alongside each version bump (see scripts/bump-framework.ts).
CREATE TABLE framework_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version               TEXT NOT NULL UNIQUE,
  config_snapshot_json  JSONB NOT NULL,
  migration_notes       TEXT,
  effective_from        TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per scan day. Append-only. Idempotency: (scan_date, framework_version).
-- picked_ticker is the denormalized signal: NULL = null-day, non-NULL = pick day.
-- The full pick row lives in the picks table, FK back to scan_snapshot_id.
CREATE TABLE scan_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date            DATE NOT NULL,
  framework_version    TEXT NOT NULL,
  universe_size        INT NOT NULL,
  scores               JSONB NOT NULL,
  top_score            NUMERIC NOT NULL,
  top_ticker           TEXT NOT NULL,
  viability_threshold  NUMERIC NOT NULL,
  viability_passed     BOOLEAN NOT NULL,
  picked_ticker        TEXT,
  near_misses          JSONB NOT NULL,
  reason_text          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scan_date, framework_version)
);
CREATE INDEX scan_snapshots_scan_date_desc_idx ON scan_snapshots (scan_date DESC);

CREATE TABLE picks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker                TEXT NOT NULL,
  scan_snapshot_id      UUID NOT NULL REFERENCES scan_snapshots(id) ON DELETE RESTRICT,
  framework_version     TEXT NOT NULL,
  score                 NUMERIC NOT NULL,
  factor_scores         JSONB NOT NULL,
  thesis_text           TEXT NOT NULL,
  prose_text            TEXT,
  prose_status          TEXT NOT NULL DEFAULT 'pending_validation'
                        CHECK (prose_status IN ('pending_validation','published','rate_limited','unavailable')),
  prose_sources         JSONB,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','invalidated')),
  issued_date           DATE NOT NULL,
  invalidated_at        TIMESTAMPTZ,
  invalidation_trigger  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX picks_status_idx                ON picks (status);
CREATE INDEX picks_ticker_issued_date_idx    ON picks (ticker, issued_date DESC);
CREATE INDEX picks_scan_snapshot_id_idx      ON picks (scan_snapshot_id);

CREATE TABLE thesis_annotations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id      UUID NOT NULL REFERENCES picks(id) ON DELETE RESTRICT,
  source_type  TEXT NOT NULL CHECK (source_type IN ('8-K','news','manual','llm-commentary')),
  source_url   TEXT,
  headline     TEXT NOT NULL,
  body_text    TEXT,
  is_auto      BOOLEAN NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX thesis_annotations_pick_id_occurred_idx ON thesis_annotations (pick_id, occurred_at DESC);

CREATE TABLE forward_returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id           UUID NOT NULL REFERENCES picks(id) ON DELETE RESTRICT,
  window            TEXT NOT NULL CHECK (window IN ('1w','1m','3m','6m','1y')),
  pick_date_close   NUMERIC,
  current_close     NUMERIC,
  abs_return        NUMERIC,
  spy_return        NUMERIC,
  vs_spy_return     NUMERIC,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pick_id, window)
);

CREATE TABLE validator_failures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id           UUID REFERENCES picks(id) ON DELETE SET NULL,
  attempt_number    INT NOT NULL,
  raw_prose         TEXT NOT NULL,
  failed_sentences  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX validator_failures_pick_id_idx ON validator_failures (pick_id, created_at DESC);

CREATE TABLE thesis_breaker_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id        UUID NOT NULL REFERENCES picks(id) ON DELETE RESTRICT,
  rule_id        TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state IN ('tripped','cleared')),
  trigger_event  TEXT,
  trigger_url    TEXT,
  is_auto        BOOLEAN NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX thesis_breaker_events_pick_id_idx ON thesis_breaker_events (pick_id, occurred_at DESC);

-- Daily LLM call counter. 200/day defensive ceiling against Gemini free-tier quota.
-- Replaces the original llm_spend_counter ($30/mo). See V1 free-tier audit 2026-04-24.
CREATE TABLE llm_call_counter (
  scan_date     DATE PRIMARY KEY,
  call_count    INT NOT NULL DEFAULT 0,
  last_call_at  TIMESTAMPTZ
);

COMMIT;
