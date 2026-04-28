#!/usr/bin/env tsx
/**
 * Daily scan CLI. Runs from GitHub Actions cron (.github/workflows/daily-scan.yml)
 * and from the operator's machine for spot-checks.
 *
 *   bun run scan                                       # full S&P 100, persists
 *   bun run scan:dry                                   # 5-ticker subset, no DB writes
 *   tsx scripts/scan.ts --tickers=AAPL,MSFT --dry-run  # custom subset
 *   tsx scripts/scan.ts --date=2026-04-26              # backdate (idempotent)
 *
 * Exit codes:
 *   0 — scan completed (pick or null-day; both are success)
 *   1 — scan failed before persisting (no tickers fetched, DB down, etc.)
 *   2 — bad args
 */

// Load .env.local before any module reads process.env. Next.js does this for
// server runtime, but tsx CLI invocations need to do it explicitly.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const envFile = resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

import { runScan } from "../lib/research/scan";
import { pickFactorGrader } from "../lib/research/grader";

interface Args {
  tickers?: string[];
  dryRun: boolean;
  scanDate: string; // YYYY-MM-DD, defaults to today
  rateLimitMs?: number;
}

function parseArgs(argv: string[]): Args {
  let tickers: string[] | undefined;
  let dryRun = false;
  let scanDate = new Date().toISOString().slice(0, 10);
  let rateLimitMs: number | undefined;

  for (const a of argv.slice(2)) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--tickers=")) {
      tickers = a
        .slice("--tickers=".length)
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
    } else if (a.startsWith("--date=")) {
      scanDate = a.slice("--date=".length);
    } else if (a.startsWith("--rate-ms=")) {
      rateLimitMs = Number(a.slice("--rate-ms=".length));
    } else if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scanDate)) {
    console.error(`bad --date: ${scanDate}`);
    process.exit(2);
  }
  return { tickers, dryRun, scanDate, rateLimitMs };
}

function printUsage(): void {
  console.error(
    [
      "Usage: tsx scripts/scan.ts [--dry-run] [--tickers=AAPL,MSFT] [--date=YYYY-MM-DD] [--rate-ms=1100]",
      "",
      "  --dry-run        run pipeline; do not write to DB",
      "  --tickers=...    comma-separated subset (default: full S&P 100)",
      "  --date=...       scan date (default: today UTC)",
      "  --rate-ms=...    delay between Finnhub calls (default: 1100ms = 54/min)",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const grader = pickFactorGrader();
  const graderName = process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "stub-3.5";

  console.log(
    [
      `[scan] date=${args.scanDate} ${args.dryRun ? "DRY-RUN " : ""}` +
        (args.tickers ? `tickers=${args.tickers.join(",")}` : "universe=SP100") +
        ` grader=${graderName}`,
    ].join(""),
  );

  const out = await runScan({
    scanDate: args.scanDate,
    tickers: args.tickers,
    dryRun: args.dryRun,
    rateLimitMs: args.rateLimitMs,
    factorGrader: grader,
  });

  console.log("─".repeat(60));
  console.log(`framework_version : ${out.frameworkVersion}`);
  console.log(`universe_size     : ${out.universeSize}`);
  console.log(`fetched           : ${out.fetchedCount}`);
  console.log(`dropped_history   : ${out.droppedForHistory.length}${out.droppedForHistory.length ? ` [${out.droppedForHistory.slice(0, 5).join(",")}${out.droppedForHistory.length > 5 ? ",…" : ""}]` : ""}`);
  console.log(`top               : ${out.topTicker} @ ${out.topScore}`);
  console.log(`viability_passed  : ${out.viabilityPassed}`);
  console.log(`picked            : ${out.pickedTicker ?? "—"}`);
  console.log(`near_misses       : ${out.nearMisses.length}`);
  console.log(`reason            : ${out.reasonText}`);
  if (out.scanSnapshotId) console.log(`scan_snapshot_id  : ${out.scanSnapshotId}`);
  if (out.pickId) console.log(`pick_id           : ${out.pickId}`);
  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error(`[scan] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
