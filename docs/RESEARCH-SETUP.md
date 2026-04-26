# Research Section — Setup Runbook

The research section (`/research/*`) is a daily-scan stock research feature with a public track record, thesis graveyard, framework versioning, and an Atom feed. It runs on top of the existing portfolio tracker but does not share state with it.

This file is the operator's Hour-1 setup checklist, extracted from the [CEO plan](../../.gstack/projects/arnavbha-portfolio-tracker/ceo-plans/2026-04-23-research-section.md) Step 0E so you don't have to read the full 685-line plan to bring the system up.

## TTHW target

**6–8 hours from `git clone` to first GHA-cron-driven scan_snapshot rendering on `/research`.**

If you're past 8 hours and the first cron hasn't successfully completed, stop and resolve before moving on. Integrating against broken external state is the #1 source of fake progress.

---

## Hour 1 — External accounts (open these tabs in parallel)

Don't do these serially. Open all 5 signup pages first; switch between them as forms send confirmation emails.

- [ ] **Neon project** — https://neon.tech, free tier. Copy the pooled connection string into `DATABASE_URL`.
- [ ] **Google AI Studio** — https://aistudio.google.com/apikey. Copy into `GEMINI_API_KEY`.
- [ ] **Finnhub** — https://finnhub.io/register. Free tier 60 calls/min. Copy into `FINNHUB_API_KEY`.
  - Keep this key separate from the existing `NEXT_PUBLIC_FINNHUB_KEY` (browser, portfolio tab). Same Finnhub account is fine.
- [ ] **SEC EDGAR User-Agent string** — pick `"FirstLast email@host"`. Real contact. Anonymous values get rate-limited.
- [ ] **Vercel project linked** — Hobby tier (free, non-commercial). The site deploys here. Cron does NOT run here (eng-review Perf 4A).
- [ ] **GitHub Actions secrets** — `gh secret set` for each (see split table below).
- [ ] **`openssl rand -hex 32`** → store result as `CRON_SECRET` in BOTH Vercel env AND `gh secret set CRON_SECRET`.
- [ ] **`ADMIN_PASSWORD`** — choose a passphrase. Vercel env only.

### Secret-split table (the #1 source of Hour-1 confusion)

| Secret | Vercel | GHA | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | Both sides talk to Neon |
| `CRON_SECRET` | ✓ | ✓ | GHA POSTs to Vercel `/api/revalidate-research` with this header |
| `ADMIN_PASSWORD` | ✓ | — | Edge Middleware Basic Auth |
| `NEXT_PUBLIC_FINNHUB_KEY` | ✓ | — | Browser bundle, pre-existing portfolio tab |
| `FINNHUB_API_KEY` | — | ✓ | Server-side scan worker only |
| `GEMINI_API_KEY` | — | ✓ | Server-side scan worker only |
| `SEC_EDGAR_USER_AGENT` | — | ✓ | Server-side scan worker only |

Source of truth for which secrets exist: [`.env.local.example`](../.env.local.example). When you add a secret, update that file first.

**Checkpoint:** if any account creation stalls (Neon waitlist, billing verification), stop and resolve before moving to Hour 2.

---

## Hour 2–3 — Schema, framework v1.0.0, middleware gate

- [ ] Run schema migrations per CEO plan Step 2 + Accepted Scope #4 amendments. Tables: `scan_snapshots`, `picks`, `thesis_annotations`, `forward_returns`, `framework_versions` (with `config_snapshot_json` + `migration_notes` columns), `validator_failures`, `thesis_breaker_events`, `llm_call_counter`.
- [ ] Seed `framework_versions` with `v1.0.0` row. Use `bun run framework:bump --version=v1.0.0 --reason="baseline"` once the script exists, or hand-write the INSERT for v1.0.0.
- [ ] Write `lib/research/framework-config.ts` mirroring the seeded JSON snapshot.
- [ ] Wire the gate: `middleware.ts` with matcher `/research/:path*` (NOT just `/research/admin/:path*`). The narrowing happens at flip-to-public on day 14.
- [ ] **Shakedown clock starts now.** Log deploy timestamp. Day 14 = flip evaluation.

---

## Hour 4–5 — Scan pipeline skeleton, manual run

- [ ] Extend `lib/finnhub.ts` with `fetchFundamentals`, `fetchCompanyNews`, `fetchHistoricalCandle` + per-minute token-bucket rate limiter (≈7 min wall-clock for S&P 100).
- [ ] Write `lib/research/scan.ts`: universe JSON → factor fetch → score with v1.0.0 → decide pick/null-day → persist scan_snapshot. Append-only. Idempotency key: `(scanDate, frameworkVersionAtMidnightET)`.
- [ ] Write `scripts/scan.ts` (the GHA-callable entrypoint). Honor `--dry-run` and `--tickers=...` flags.
- [ ] Wire `llm_call_counter` row + 200/day ceiling check.
- [ ] **Manual run:** `bun run scan:dry` (5 tickers, no DB writes). Inspect output for sane scores. Then `bun run scan` against 5 tickers — verify scan_snapshot row written, score sane, no sector-specific logic leaked in.
- [ ] **Do NOT ship cron yet.** Manual trigger only at this stage.

---

## Hour 6+ — UI, then GHA cron, then expansions

UI surfaces, in order:

- [ ] `/research` homepage (D2 — positioning-first hero, today's state, recent 3 entries)
- [ ] `/research/journal` timeline (D6 — vertical text list)
- [ ] `/research/pick/[id]` (D4 — single-column narrative, max-w-3xl)
- [ ] `/research/graveyard` (D3 — mortality register)
- [ ] `/research/admin/*` — including `/research/admin/today` (DX4 — flip-evaluation dashboard)

CEO expansions, in this order (each unblocks the next):

- [ ] `/research/journal/[date]` per-date permalink — unblocks Atom `<link>` and OG route
- [ ] `app/research/feed.xml/route.ts` — Atom 1.0, `revalidate=3600`
- [ ] Four `opengraph-image.tsx` templates (pick, graveyard, null-day, site fallback)
- [ ] `/research/framework/diff/[from]/[to]` + baseline render

Cron LAST:

- [ ] `.github/workflows/daily-scan.yml` — cron `13 09 * * 1-5` (just before 09:00 ET; adjust for DST)
- [ ] Sentry heartbeat monitor — alerts after >26h without a scan heartbeat (E7)
- [ ] Verify first cron fires in production before ending the session

### End-of-Day-1 criteria

All four must hold. If any fail, stop and fix — do NOT start the shakedown clock on broken infrastructure:

1. First automated GHA cron scan completes successfully
2. scan_snapshot visible on `/research/journal`
3. `bun run feed:check` passes (Atom feed valid XML)
4. At least one OG image renders (open `https://{vercel-url}/research/pick/{id}/opengraph-image` in browser)

---

## Day 2–14 — Shakedown operations

- Daily check on `/research/admin/today` (DX4) against the 3 flip criteria:
  1. Cron run rate = 100% over the window
  2. LLM citation validator pass rate ≥ 70%
  3. scan_snapshot write failures = 0
- Any framework config change in this window creates `v1.0.1` (NOT `v1.1.0`). Use `bun run framework:bump`.
- **Day 14:** flip-evaluation. All 3 criteria pass → flip public (narrow middleware matcher to `/research/admin/:path*`). Any criterion fails → extend +7 days.

---

## Common day-1 traps

1. **Two Finnhub keys.** `NEXT_PUBLIC_FINNHUB_KEY` (browser, legacy portfolio tab) and `FINNHUB_API_KEY` (server, scan worker) are both required and must NOT be collapsed. Same Finnhub account is fine; the split keeps the server key out of the browser bundle.
2. **Secret split between Vercel and GHA.** Most go to both (see table above). Skipping one side surfaces as `revalidatePath` 401s or scan worker auth failures. Update both at once.
3. **`xmllint` not installed on macOS by default.** `brew install libxml2` before running `bun run feed:check`. Or skip local validation and use https://validator.w3.org/feed/ post-flip.
4. **Vitest is the first test runner in this repo.** `bun install` after the DX2 `package.json` update should pick up `vitest`, `@vitest/ui`, `tsx`. If not, `bun add -d vitest @vitest/ui tsx`.
5. **GHA cron schedule is UTC.** `13 09 * * 1-5` is 09:13 UTC ≈ 05:13 ET (winter). Adjust for DST. Verify by checking the workflow run history matches expected ET wall time.
6. **`config_snapshot_json` is hand-curated, not auto-serialized.** When you bump the framework, you write the new JSON. The diff page renders against the snapshots, not the live TS config. Drift between TS and JSON is E3 in the error map.
7. **`middleware.ts` matcher narrows AT flip, not before.** During shakedown the matcher is `/research/:path*` — the entire surface gated. Day 14 → narrow to `/research/admin/:path*`. Don't ship the narrow version on day 1.

---

## Reference

- **CEO plan:** `~/.gstack/projects/arnavbha-portfolio-tracker/ceo-plans/2026-04-23-research-section.md` (685 lines — strategic doc)
- **Design doc v3 APPROVED:** `~/.gstack/projects/arnavbha-portfolio-tracker/abhatia-claude-competent-sutherland-c2be27-design-20260422-233704.md`
- **Eng review test plan:** `~/.gstack/projects/arnavbha-portfolio-tracker/abhatia-competent-sutherland-c2be27-eng-review-test-plan-20260423-163452.md`
- **Deferred items / V1.1 candidates:** [`TODOS.md`](../TODOS.md)
