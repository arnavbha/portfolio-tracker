import Link from "next/link";
import { listRecentScanSnapshots } from "@/lib/research/queries";
import { EmptyState, isExpectedPreLaunchError } from "../_components/EmptyState";
import type { ScanSnapshotRow } from "@/lib/research/types";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  let days: ScanSnapshotRow[] = [];
  try {
    days = await listRecentScanSnapshots(365);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  if (days.length === 0) {
    return (
      <EmptyState
        title="Journal"
        body="Every scan day is logged here — picks and null-days alike. Nothing's been written yet."
      />
    );
  }

  return (
    <article>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Journal</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {days.length} scan day{days.length === 1 ? "" : "s"}. Picks bold,
          null-days italic.
        </p>
      </header>
      <ul className="space-y-1">
        {days.map((d) => (
          <li key={d.id}>
            <Link
              href={`/research/journal/${d.scanDate}`}
              className="grid grid-cols-[7rem_1fr_4rem] items-baseline gap-4 py-1.5 text-sm hover:bg-zinc-900/40 -mx-2 px-2 rounded transition-colors"
            >
              <span className="tabular-nums text-zinc-500">{d.scanDate}</span>
              <span
                className={
                  d.pickedTicker
                    ? "font-medium text-zinc-100"
                    : "italic text-zinc-500"
                }
              >
                {d.pickedTicker ?? "nothing today"}
              </span>
              <span className="tabular-nums text-right text-zinc-500">
                {d.topScore.toFixed(1)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
