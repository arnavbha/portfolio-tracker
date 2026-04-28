import Link from "next/link";
import { notFound } from "next/navigation";
import { getScanSnapshotByDate, listAllPicksForFeed } from "@/lib/research/queries";
import type { Metadata } from "next";
import type { ScanSnapshotRow, PickRow } from "@/lib/research/types";
import { isExpectedPreLaunchError } from "../../_components/EmptyState";

export const dynamic = "force-dynamic";

type Params = { date: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Scan — ${date} — Research`,
    description: `Daily framework scan for ${date}.`,
  };
}

export default async function JournalDayPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  let snapshot: ScanSnapshotRow | null = null;
  let pickForDay: PickRow | null = null;
  try {
    snapshot = await getScanSnapshotByDate(date);
    if (snapshot?.pickedTicker) {
      const all = await listAllPicksForFeed(200);
      pickForDay =
        all.find(
          (p) => p.ticker === snapshot!.pickedTicker && p.issuedDate === date,
        ) ?? null;
    }
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  if (!snapshot) notFound();

  const isPick = snapshot.pickedTicker !== null;

  return (
    <article className="max-w-3xl">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 tabular-nums">{snapshot.scanDate}</p>
        {isPick ? (
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {snapshot.pickedTicker}
          </h1>
        ) : (
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-300">
            Nothing today
          </h1>
        )}
      </header>

      <section className="prose prose-invert max-w-none text-zinc-200">
        {isPick && pickForDay ? (
          <>
            <p>
              <Link
                href={`/research/pick/${pickForDay.id}`}
                className="text-zinc-200 underline-offset-4 hover:text-white hover:underline"
              >
                Open the full thesis →
              </Link>
            </p>
            <p className="text-zinc-400">{pickForDay.thesisText}</p>
          </>
        ) : (
          <p className="text-zinc-300 leading-relaxed">{snapshot.reasonText}</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Scan stats
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-zinc-500">Universe size</dt>
          <dd className="tabular-nums">{snapshot.universeSize}</dd>
          <dt className="text-zinc-500">Top ticker</dt>
          <dd className="tabular-nums">
            {snapshot.topTicker} @ {snapshot.topScore.toFixed(2)}
          </dd>
          <dt className="text-zinc-500">Viability threshold</dt>
          <dd className="tabular-nums">
            {snapshot.viabilityThreshold.toFixed(0)}
          </dd>
          <dt className="text-zinc-500">Framework</dt>
          <dd>
            <Link
              href={`/research/framework`}
              className="text-zinc-300 hover:text-white underline-offset-4 hover:underline"
            >
              {snapshot.frameworkVersion}
            </Link>
          </dd>
        </dl>
      </section>

      {snapshot.nearMisses.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Near misses ({snapshot.nearMisses.length})
          </h2>
          <ul className="mt-3 divide-y divide-zinc-800/80">
            {snapshot.nearMisses.map((n) => (
              <li
                key={n.ticker}
                className="flex items-baseline justify-between py-2 text-sm"
              >
                <span className="font-medium">{n.ticker}</span>
                <span className="text-zinc-500">
                  failing {n.failingFactor} (gap {n.factorGap.toFixed(2)})
                </span>
                <span className="tabular-nums">{n.score.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
