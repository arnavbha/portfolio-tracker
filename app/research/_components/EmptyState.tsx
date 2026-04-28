/**
 * Reusable shell for "no data yet" / "DB not configured" screens. We render
 * these BEFORE Hour 1 (DB) is provisioned, so every research page must
 * gracefully degrade rather than 500. Pages call this in their catch block
 * after attempting their query.
 */

interface EmptyStateProps {
  title: string;
  body: string;
  hint?: string;
}

export function EmptyState({ title, body, hint }: EmptyStateProps) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-zinc-300 leading-relaxed">{body}</p>
      {hint ? <p className="mt-6 text-sm text-zinc-500">{hint}</p> : null}
    </section>
  );
}

/**
 * Heuristic: a thrown query error before a row exists is almost always one of
 *   - DATABASE_URL unset
 *   - migration not run
 *   - first scan hasn't landed yet
 * We collapse those into one render so the operator sees a useful nudge
 * instead of a 500.
 */
export function isExpectedPreLaunchError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    m.includes("database_url") ||
    m.includes("relation") ||
    m.includes("does not exist") ||
    m.includes("connect") ||
    m.includes("econnrefused")
  );
}
