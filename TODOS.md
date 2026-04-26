# TODOS

Deferred work from the research-section planning cycle (office-hours + plan-ceo-review + plan-eng-review + plan-design-review + plan-devex-review, 2026-04-23 to 2026-04-24). Sorted by when they'd be revisited.

## V1 must-do (from devex review, 2026-04-24)

These were promoted INTO V1 by /plan-devex-review — they are not deferred work, they are required impl steps. Listed here as a pre-impl checklist so they don't get skipped under velocity pressure.

- [ ] **DX1** — Update `.env.local.example` to list all 6 research-section secrets with comments explaining which side (Vercel / GHA / both) each goes to. ~10 min. **Highest-leverage Hour-1 win.**
- [ ] **DX2** — Add `package.json` scripts: `test:research`, `test:research:watch`, `scan`, `scan:dry`, `framework:bump`, `feed:check`. Add `tsx` + `vitest` + `@vitest/ui` to devDependencies. ~5 min.
- [ ] **DX3** — Ship `scripts/bump-framework.ts` (~40 min) OR fall back to `docs/FRAMEWORK-BUMPS.md` if heavy mid-impl. Script is preferred — doc-only forces hand-constructed SQL which produces E3-class snapshot drift bugs.
- [ ] **DX4** — `/research/admin/today` flip-evaluation dashboard. One screen with all 3 shakedown criteria + LLM call counter + recent validator failures + manual re-trigger buttons. ~60 min. Amends design-doc Step 5.20.
- [ ] **DX6** — `docs/RESEARCH-SETUP.md` — one-page Hour-1-to-end-of-Day-1 runbook, extracted from CEO plan Step 0E. ~20 min.

## V1.1 carve-outs (revisit ~2 weeks after public flip)

## V1.1 carve-outs (revisit ~2 weeks after public flip)

- [ ] Universe expansion S&P 100 → S&P 500. Requires Finnhub pacing retest: at 400 fundamentals calls/min and 60 calls/min free-tier cap, S&P 500 wall-clock is ~35 min per scan. Either upgrade Finnhub tier, or shard scans across multiple days, or cache fundamentals >24h.
- [ ] Forward-return visualization charts at `/research/track-record` (from design doc; 1w/1m/3m/6m/1y bucket charts vs SPY benchmark).
- [ ] Operator-triggered LLM commentary on news annotations (from design doc; explicit opt-in per annotation, still citation-validated).
- [x] ~~CI check: verify `framework_versions.config_snapshot_json` matches current `lib/research/framework-config.ts` at deploy time.~~ **Promoted to V1 (2026-04-23 eng review)** as a 10-line Vitest unit test in `test/research/snapshot-drift.test.ts`. Fails CI if TS config diverges from latest DB snapshot.
- [ ] **Write 1-page `DESIGN.md`** capturing inherited tokens (zinc-950 bg, Geist Sans/Mono, blue-600 brand, amber warning, rounded-2xl card from existing `/`) + research-section divergences (`max-w-3xl` reading width, no card surface, sub-nav with text-only labels, no `motion` imports, `SpotlightCard` allowed once on pick-page score header). Source: 2026-04-24 design review Pass 5 / D11. Future Claude/contributor sessions need this artifact.
- [ ] **LLM provider upgrade — Gemini free → Anthropic OR Gemini paid.** V1 ships on Gemini free tier (`@google/genai`, `gemini-2.5-flash`, ~200 calls/day cap defensive ceiling). Swap to Anthropic ($30/mo cap from original plan) OR Gemini paid tier when (a) free-tier rate limits begin throttling daily scans, OR (b) traction validates the spend. All LLM-touch code lives in `lib/research/explain.ts` behind a thin interface — migration is a single-file SDK swap. Source: 2026-04-24 V1 free-tier audit.
- [ ] **Vercel Hobby → Pro upgrade** ($20/mo). Triggers: (a) commercial-use threshold crossed (any monetization signal on the site), (b) Edge Middleware Basic Auth UX becomes a friction point and Password Protection's cleaner UI is wanted, (c) function execution / bandwidth limits hit. Source: 2026-04-24 V1 free-tier audit.
- [ ] **Custom domain.** `*.vercel.app` is V1. Buy a domain (~$12/yr) when traction justifies the brand surface. Source: 2026-04-24 V1 free-tier audit.

## Post-launch, revisit if traction warrants

- [ ] **Near-miss leaderboard on `/research` homepage** — "most-frequent near-miss tickers of all time." Pattern-surfacing delight. Deferred from CEO review expansion #4.
- [ ] **Webhook output for pick events** — POST to configurable URL on pick-issued / pick-invalidated. Indie-investor niche integration surface. Deferred from CEO review expansion #5.
- [ ] **Operator meta-journal** — weekly ~200-word operator reflections on framework behavior (not per-pick, meta-level). Defer until there's actually something to reflect on.

## Explicitly not-for-V1 (may or may not ever happen)

- [ ] Email digest — design doc says no-for-V1; Atom feed is the V1 distribution channel.
- [ ] User accounts / auth on the public site — read-only for now.
- [ ] In-app framework editor UI — framework bumps stay as git commits.
- [ ] Backtesting / synthetic historical scans — violates the transparency wedge.

## Source plans

- CEO plan: `/Users/abhatia/.gstack/projects/arnavbha-portfolio-tracker/ceo-plans/2026-04-23-research-section.md`
- Design doc (v3, APPROVED): `/Users/abhatia/.gstack/projects/arnavbha-portfolio-tracker/abhatia-claude-competent-sutherland-c2be27-design-20260422-233704.md`
