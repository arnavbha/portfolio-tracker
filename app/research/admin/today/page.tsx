import Link from "next/link";
import {
  countValidatorFailures,
  getFrameworkVersion,
  getMostRecentScanSnapshot,
  listRecentScanSnapshots,
} from "@/lib/research/queries";
import { FRAMEWORK_CONFIG } from "@/lib/research/framework-config";
import type {
  FactorScore,
  FrameworkConfig,
  ScanSnapshotRow,
} from "@/lib/research/types";
import { isExpectedPreLaunchError, EmptyState } from "../../_components/EmptyState";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Today — Research",
  description: "Operator dashboard for the most recent scan.",
};

type SearchParams = { threshold?: string };

interface SimulationOutcome {
  threshold: number;
  pickedTicker: string | null;
  pickedScore: number | null;
  candidatesPassed: number;
  floorBlocked: number;
}

function simulateAtThreshold(
  snapshot: ScanSnapshotRow,
  config: FrameworkConfig,
  threshold: number,
): SimulationOutcome {
  let candidatesPassed = 0;
  let floorBlocked = 0;
  const survivors: Array<{ ticker: string; score: number }> = [];

  for (const [ticker, entry] of Object.entries(snapshot.scores)) {
    if (entry.score < threshold) continue;
    const trippedFloor = config.factors.some((f) => {
      if (f.hardFloor === null) return false;
      const fs = entry.factors[f.id];
      if (!fs) return false;
      return fs.score < f.hardFloor;
    });
    if (trippedFloor) {
      floorBlocked++;
      continue;
    }
    candidatesPassed++;
    survivors.push({ ticker, score: entry.score });
  }

  survivors.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.ticker.localeCompare(b.ticker),
  );

  const picked = survivors[0] ?? null;
  return {
    threshold,
    pickedTicker: picked?.ticker ?? null,
    pickedScore: picked?.score ?? null,
    candidatesPassed,
    floorBlocked,
  };
}

export default async function AdminTodayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let snapshot: ScanSnapshotRow | null = null;
  let recent: ScanSnapshotRow[] = [];
  let validatorFailures = 0;
  let preLaunch = false;
  try {
    [snapshot, recent, validatorFailures] = await Promise.all([
      getMostRecentScanSnapshot(),
      listRecentScanSnapshots(14),
      countValidatorFailures(),
    ]);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
    preLaunch = true;
  }

  if (preLaunch || !snapshot) {
    return (
      <EmptyState
        title="Admin · today"
        body="No scans persisted yet. Once the first scan lands, this page shows the live snapshot, near-misses with full factor breakdowns, the threshold-simulation slider, and the validator-failure backlog."
        hint="Run `npm run scan -- --dry-run` to verify the pipeline. See docs/RESEARCH-SETUP.md."
      />
    );
  }

  const versionRow = await getFrameworkVersion(snapshot.frameworkVersion).catch(
    () => null,
  );
  const config: FrameworkConfig =
    versionRow?.configSnapshotJson ?? FRAMEWORK_CONFIG;

  const requested = Number(sp.threshold);
  const threshold =
    Number.isFinite(requested) && requested >= 50 && requested <= 100
      ? Math.round(requested)
      : config.thresholds.viability;

  const sim = simulateAtThreshold(snapshot, config, threshold);

  const sortedScores = Object.entries(snapshot.scores)
    .map(([ticker, entry]) => ({ ticker, ...entry }))
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.ticker.localeCompare(b.ticker),
    );

  const nearMissTickers = new Set(snapshot.nearMisses.map((n) => n.ticker));
  const nearMissDetails = sortedScores.filter((s) =>
    nearMissTickers.has(s.ticker),
  );

  return (
    <article>
      <header className="mb-10">
        <p className="text-xs uppercase tracking-wider text-amber-400">
          Operator dashboard
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Admin · today
        </h1>
        <p className="mt-2 text-sm text-zinc-500 tabular-nums">
          {snapshot.scanDate} · framework {snapshot.frameworkVersion} ·{" "}
          {snapshot.universeSize} tickers · top {snapshot.topTicker} @{" "}
          {snapshot.topScore.toFixed(2)}
        </p>
      </header>

      <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded border border-zinc-800/80 px-4 py-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            Picked
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {snapshot.pickedTicker ?? "—"}
          </div>
        </div>
        <div className="rounded border border-zinc-800/80 px-4 py-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            Near misses
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {snapshot.nearMisses.length}
          </div>
        </div>
        <div
          className={
            "rounded border px-4 py-3 " +
            (validatorFailures > 0
              ? "border-rose-900/60 bg-rose-950/20"
              : "border-zinc-800/80")
          }
        >
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            Validator failures (all-time)
          </div>
          <div
            className={
              "mt-1 text-2xl font-semibold tabular-nums " +
              (validatorFailures > 0 ? "text-rose-300" : "")
            }
          >
            {validatorFailures}
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">Threshold simulation</h2>
        <p className="text-sm text-zinc-400 mb-4 max-w-2xl">
          Re-run the decision over today&apos;s scores at a different viability
          threshold. Hard floors still apply — a ticker that trips a floor stays
          dropped no matter the threshold.
        </p>
        <form method="get" className="flex flex-wrap items-center gap-4 mb-6">
          <label htmlFor="threshold" className="text-sm text-zinc-400">
            Threshold
          </label>
          <input
            id="threshold"
            name="threshold"
            type="number"
            min={50}
            max={100}
            step={1}
            defaultValue={threshold}
            className="w-24 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm tabular-nums"
          />
          <button
            type="submit"
            className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white"
          >
            Simulate
          </button>
          <span className="text-xs text-zinc-500">
            Live config: {config.thresholds.viability}
          </span>
        </form>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm max-w-2xl">
          <dt className="text-zinc-500">At threshold</dt>
          <dd className="tabular-nums">{sim.threshold}</dd>
          <dt className="text-zinc-500">Would pick</dt>
          <dd className="tabular-nums">
            {sim.pickedTicker ?? "—"}{" "}
            {sim.pickedScore !== null ? (
              <span className="text-zinc-500">
                @ {sim.pickedScore.toFixed(2)}
              </span>
            ) : null}
          </dd>
          <dt className="text-zinc-500">Survivors</dt>
          <dd className="tabular-nums">{sim.candidatesPassed}</dd>
          <dt className="text-zinc-500">Floor-blocked</dt>
          <dd className="tabular-nums">{sim.floorBlocked}</dd>
        </dl>
      </section>

      {nearMissDetails.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Near misses ({nearMissDetails.length}) — full factor breakdown
          </h2>
          <div className="space-y-6">
            {nearMissDetails.map((entry) => (
              <div
                key={entry.ticker}
                className="rounded border border-zinc-800/80 px-4 py-3"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-lg font-semibold">
                      {entry.ticker}
                    </span>
                    <span className="ml-3 text-sm text-zinc-500 tabular-nums">
                      {entry.score.toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href={`/research/journal/${snapshot.scanDate}`}
                    className="text-xs text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
                  >
                    journal day →
                  </Link>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-900">
                      <th className="text-left font-normal py-1">Factor</th>
                      <th className="text-right font-normal py-1">Score</th>
                      <th className="text-right font-normal py-1">Weight</th>
                      <th className="text-right font-normal py-1">Floor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.factors.map((f) => {
                      const fs: FactorScore | undefined = entry.factors[f.id];
                      if (!fs) return null;
                      const tripped =
                        f.hardFloor !== null && fs.score < f.hardFloor;
                      return (
                        <tr
                          key={f.id}
                          className="border-b border-zinc-900/60"
                        >
                          <td className="py-1">
                            <span className="font-mono text-zinc-300">
                              {f.id}
                            </span>
                          </td>
                          <td
                            className={
                              "py-1 text-right tabular-nums " +
                              (tripped ? "text-rose-400" : "")
                            }
                          >
                            {fs.score.toFixed(2)}
                          </td>
                          <td className="py-1 text-right tabular-nums text-zinc-500">
                            {fs.weight}
                          </td>
                          <td className="py-1 text-right tabular-nums text-zinc-500">
                            {f.hardFloor === null ? "—" : f.hardFloor}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Recent scans</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left font-normal py-2">Date</th>
              <th className="text-left font-normal py-2">Picked</th>
              <th className="text-right font-normal py-2">Top score</th>
              <th className="text-right font-normal py-2">Near misses</th>
              <th className="text-left font-normal py-2 pl-6">Framework</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id} className="border-b border-zinc-900/60">
                <td className="py-2 tabular-nums">
                  <Link
                    href={`/research/journal/${s.scanDate}`}
                    className="text-zinc-200 hover:text-white underline-offset-4 hover:underline"
                  >
                    {s.scanDate}
                  </Link>
                </td>
                <td className="py-2 tabular-nums">
                  {s.pickedTicker ?? (
                    <span className="text-zinc-500">null-day</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {s.topTicker} @ {s.topScore.toFixed(2)}
                </td>
                <td className="py-2 text-right tabular-nums text-zinc-400">
                  {s.nearMisses.length}
                </td>
                <td className="py-2 pl-6 font-mono text-xs text-zinc-500">
                  {s.frameworkVersion}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="text-sm text-zinc-500">
        <p>
          Today&apos;s reason text:{" "}
          <span className="text-zinc-300">
            {snapshot.reasonText ?? "(none)"}
          </span>
        </p>
      </section>
    </article>
  );
}
