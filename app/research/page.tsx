import Link from "next/link";
import { getMostRecentScanSnapshot, listRecentScanSnapshots } from "@/lib/research/queries";
import { EmptyState, isExpectedPreLaunchError } from "./_components/EmptyState";
import type { ScanSnapshotRow } from "@/lib/research/types";

export const dynamic = "force-dynamic";

export default async function ResearchTodayPage() {
  let latest: ScanSnapshotRow | null = null;
  let recent: ScanSnapshotRow[] = [];
  let preLaunch = false;

  try {
    [latest, recent] = await Promise.all([
      getMostRecentScanSnapshot(),
      listRecentScanSnapshots(7),
    ]);
  } catch (e) {
    if (isExpectedPreLaunchError(e)) {
      preLaunch = true;
    } else {
      throw e;
    }
  }

  if (preLaunch || latest === null) {
    return (
      <EmptyState
        title="No scans yet"
        body="The first daily scan hasn't run. Once it does, this page shows today's verdict — a single pick on a viable day, or 'nothing today' on the rest."
        hint={
          preLaunch
            ? "Operator: provision Postgres and run the migration. See docs/RESEARCH-SETUP.md."
            : "Daily scan runs at 09:13 UTC weekdays."
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      <Hero snapshot={latest} />
      <RecentDays days={recent} />
    </div>
  );
}

function Hero({ snapshot }: { snapshot: ScanSnapshotRow }) {
  const isPick = snapshot.pickedTicker !== null;
  return (
    <section className="border-b border-zinc-800 pb-10">
      <p className="text-sm text-zinc-500 tabular-nums">{snapshot.scanDate}</p>
      {isPick ? (
        <>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">
            {snapshot.pickedTicker}
          </h1>
          <p className="mt-3 text-zinc-400">
            Today's pick. Composite {snapshot.topScore.toFixed(1)} ≥ viability{" "}
            {snapshot.viabilityThreshold.toFixed(0)}. Framework {snapshot.frameworkVersion}.
          </p>
          <p className="mt-6 text-sm">
            <Link
              href={`/research/journal/${snapshot.scanDate}`}
              className="text-zinc-300 hover:text-white underline-offset-4 hover:underline"
            >
              Open thesis →
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-zinc-300">
            Nothing today
          </h1>
          <p className="mt-3 text-zinc-400">
            No ticker passed viability. Top: {snapshot.topTicker} @{" "}
            {snapshot.topScore.toFixed(1)} (threshold{" "}
            {snapshot.viabilityThreshold.toFixed(0)}).
          </p>
          {snapshot.nearMisses.length > 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              {snapshot.nearMisses.length} near-miss
              {snapshot.nearMisses.length === 1 ? "" : "es"}:{" "}
              {snapshot.nearMisses.map((n) => n.ticker).join(", ")}.
            </p>
          ) : null}
          <p className="mt-6 text-sm">
            <Link
              href={`/research/journal/${snapshot.scanDate}`}
              className="text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
            >
              Why →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function RecentDays({ days }: { days: ScanSnapshotRow[] }) {
  if (days.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Recent scans
      </h2>
      <ul className="mt-4 divide-y divide-zinc-800/80">
        {days.map((d) => (
          <li key={d.id}>
            <Link
              href={`/research/journal/${d.scanDate}`}
              className="flex items-baseline justify-between py-3 text-sm hover:bg-zinc-900/40 -mx-2 px-2 rounded transition-colors"
            >
              <span className="tabular-nums text-zinc-500 w-28">{d.scanDate}</span>
              <span
                className={
                  d.pickedTicker
                    ? "font-medium text-zinc-100 flex-1"
                    : "italic text-zinc-500 flex-1"
                }
              >
                {d.pickedTicker ?? "nothing today"}
              </span>
              <span className="tabular-nums text-zinc-500 ml-4">
                {d.topScore.toFixed(1)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
