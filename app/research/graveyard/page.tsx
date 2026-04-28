import Link from "next/link";
import { listInvalidatedPicks } from "@/lib/research/queries";
import { EmptyState, isExpectedPreLaunchError } from "../_components/EmptyState";
import type { PickRow } from "@/lib/research/types";

export const dynamic = "force-dynamic";

export default async function GraveyardPage() {
  let picks: PickRow[] = [];
  let preLaunch = false;
  try {
    picks = await listInvalidatedPicks(200);
  } catch (e) {
    if (isExpectedPreLaunchError(e)) preLaunch = true;
    else throw e;
  }

  if (preLaunch || picks.length === 0) {
    return (
      <EmptyState
        title="Graveyard"
        body="The mortality register. Every invalidated pick lives here permanently — no rewriting history, no deletion. Nothing here yet."
        hint="Picks move here when a thesis-breaker rule trips."
      />
    );
  }

  return (
    <article>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Graveyard</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {picks.length} invalidated pick{picks.length === 1 ? "" : "s"}.
          Permanent record.
        </p>
      </header>
      <ul className="divide-y divide-zinc-800/80">
        {picks.map((p) => (
          <li key={p.id}>
            <Link
              href={`/research/pick/${p.id}`}
              className="grid grid-cols-[5rem_1fr_8rem_8rem] items-baseline gap-4 py-4 hover:bg-zinc-900/40 -mx-2 px-2 rounded transition-colors"
            >
              <span className="font-medium text-zinc-200">{p.ticker}</span>
              <span className="text-sm text-zinc-400 truncate">
                {p.invalidationTrigger ?? "manually invalidated"}
              </span>
              <span className="text-sm text-zinc-500 tabular-nums text-right">
                issued {p.issuedDate}
              </span>
              <span className="text-sm text-zinc-500 tabular-nums text-right">
                killed{" "}
                {p.invalidatedAt ? p.invalidatedAt.slice(0, 10) : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
