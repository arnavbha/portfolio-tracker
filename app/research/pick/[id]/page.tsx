import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getPickById,
  listAnnotationsForPick,
  listBreakerEventsForPick,
  listForwardReturnsForPick,
} from "@/lib/research/queries";
import { FRAMEWORK_CONFIG } from "@/lib/research/framework-config";
import type { Metadata } from "next";
import type {
  ForwardReturnRow,
  PickRow,
  ThesisAnnotationRow,
  ThesisBreakerEventRow,
} from "@/lib/research/types";
import { isExpectedPreLaunchError } from "../../_components/EmptyState";

export const dynamic = "force-dynamic";

type Params = { id: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Pick — Research" };
  let pick: PickRow | null = null;
  try {
    pick = await getPickById(id);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }
  if (!pick) return { title: "Pick — Research" };
  return {
    title: `${pick.ticker} — ${pick.issuedDate} — Research`,
    description: pick.thesisText.slice(0, 160),
  };
}

export default async function PickPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  let pick: PickRow | null = null;
  let annotations: ThesisAnnotationRow[] = [];
  let breakers: ThesisBreakerEventRow[] = [];
  let returns: ForwardReturnRow[] = [];

  try {
    pick = await getPickById(id);
    if (pick) {
      [annotations, breakers, returns] = await Promise.all([
        listAnnotationsForPick(id),
        listBreakerEventsForPick(id),
        listForwardReturnsForPick(id),
      ]);
    }
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  if (!pick) notFound();

  return (
    <article className="max-w-3xl">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 tabular-nums">
          Issued {pick.issuedDate} · Framework {pick.frameworkVersion}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight flex items-baseline gap-4">
          <span>{pick.ticker}</span>
          <span className="text-base font-normal text-zinc-500 tabular-nums">
            {pick.score.toFixed(2)}
          </span>
        </h1>
        {pick.status === "invalidated" ? (
          <p className="mt-3 inline-block text-xs font-medium uppercase tracking-wider text-zinc-200 bg-zinc-800 px-2 py-1 rounded">
            invalidated{" "}
            {pick.invalidatedAt ? `· ${pick.invalidatedAt.slice(0, 10)}` : ""}
          </p>
        ) : (
          <p className="mt-3 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded">
            active
          </p>
        )}
      </header>

      <section className="prose prose-invert max-w-none">
        <h2 className="text-base font-medium uppercase tracking-wider text-zinc-500">
          Thesis
        </h2>
        <p className="text-zinc-200 leading-relaxed">{pick.thesisText}</p>
        {pick.proseText ? (
          <ProsePanel pick={pick} />
        ) : (
          <p className="text-sm text-zinc-500 italic">
            Prose status: {pick.proseStatus}.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Factor breakdown
        </h2>
        <FactorTable factorScores={pick.factorScores} />
      </section>

      {breakers.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Thesis breaker events
          </h2>
          <ul className="mt-3 divide-y divide-zinc-800/80">
            {breakers.map((b) => (
              <li key={b.id} className="py-3 text-sm">
                <span
                  className={
                    b.state === "tripped"
                      ? "text-rose-400 font-medium"
                      : "text-emerald-400 font-medium"
                  }
                >
                  {b.state}
                </span>{" "}
                <span className="text-zinc-500 tabular-nums">
                  {b.occurredAt.slice(0, 10)}
                </span>{" "}
                <span className="text-zinc-200">{b.ruleId}</span>
                {b.triggerEvent ? (
                  <p className="mt-1 text-zinc-400">{b.triggerEvent}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {annotations.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Annotations
          </h2>
          <ul className="mt-3 space-y-4">
            {annotations.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="text-zinc-500 tabular-nums">
                  {a.occurredAt.slice(0, 10)} · {a.sourceType}
                </p>
                <p className="text-zinc-100 mt-0.5">{a.headline}</p>
                {a.bodyText ? (
                  <p className="text-zinc-400 mt-1">{a.bodyText}</p>
                ) : null}
                {a.sourceUrl ? (
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300 underline-offset-4 hover:underline mt-1 inline-block"
                  >
                    source ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {returns.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Forward returns vs SPY
          </h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left font-normal py-2">Window</th>
                <th className="text-right font-normal py-2">Pick</th>
                <th className="text-right font-normal py-2">SPY</th>
                <th className="text-right font-normal py-2">vs SPY</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-zinc-900/60">
                  <td className="py-2">{r.window}</td>
                  <td className="py-2 text-right tabular-nums">
                    {fmtPct(r.absReturn)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">
                    {fmtPct(r.spyReturn)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {fmtPct(r.vsSpyReturn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-16 text-sm">
        <Link
          href="/research/journal"
          className="text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
        >
          ← Back to journal
        </Link>
      </footer>
    </article>
  );
}

function ProsePanel({ pick }: { pick: PickRow }) {
  return (
    <>
      <h2 className="text-base font-medium uppercase tracking-wider text-zinc-500 mt-6">
        Citation-validated prose
      </h2>
      <p className="text-xs text-zinc-500 not-prose">
        Status: {pick.proseStatus}
      </p>
      <div
        className="text-zinc-200 leading-relaxed"
        // pick.proseText is hard-validated server-side via lib/research/explain.ts
        // (every sentence ends with a known [src:N]). Display it as plain text.
      >
        {pick.proseText}
      </div>
      {pick.proseSources && pick.proseSources.length > 0 ? (
        <ol className="text-xs text-zinc-500 not-prose mt-3 space-y-1">
          {pick.proseSources.map((s) => (
            <li key={s.n}>
              [src:{s.n}] {s.label} — {s.sourceType}
              {s.url ? (
                <>
                  {" — "}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-zinc-300 underline-offset-2 hover:underline"
                  >
                    link ↗
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

function FactorTable({
  factorScores,
}: {
  factorScores: PickRow["factorScores"];
}) {
  const labelById = new Map(FRAMEWORK_CONFIG.factors.map((f) => [f.id, f.label]));
  const rows = FRAMEWORK_CONFIG.factors
    .map((f) => ({
      id: f.id,
      label: labelById.get(f.id) ?? f.id,
      ...factorScores[f.id],
    }))
    .filter((r) => r.score !== undefined);
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-zinc-500 border-b border-zinc-800">
          <th className="text-left font-normal py-2">Factor</th>
          <th className="text-right font-normal py-2">Score</th>
          <th className="text-right font-normal py-2">Weight</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-zinc-900/60">
            <td className="py-2">{r.label}</td>
            <td className="py-2 text-right tabular-nums">
              {r.score.toFixed(1)}
            </td>
            <td className="py-2 text-right tabular-nums text-zinc-500">
              {r.weight}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}
