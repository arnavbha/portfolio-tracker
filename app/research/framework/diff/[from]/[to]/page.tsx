import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFrameworkVersion } from "@/lib/research/queries";
import type {
  FactorConfig,
  FrameworkConfig,
  FrameworkRule,
  FrameworkVersionRow,
} from "@/lib/research/types";
import { isExpectedPreLaunchError } from "../../../../_components/EmptyState";

export const dynamic = "force-dynamic";

type Params = { from: string; to: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { from, to } = await params;
  return {
    title: `Framework diff ${from} → ${to} — Research`,
    description: `Side-by-side diff of framework versions ${from} and ${to}.`,
  };
}

interface FactorChange {
  id: string;
  label: string;
  weight: { prev: number; next: number };
  hardFloor: { prev: number | null; next: number | null };
}

interface RuleChange {
  id: string;
  prev: { expression: string; severity: FrameworkRule["severity"] };
  next: { expression: string; severity: FrameworkRule["severity"] };
}

interface DiffResult {
  added: FactorConfig[];
  removed: FactorConfig[];
  changed: FactorChange[];
  thresholds: Array<{ key: string; prev: number; next: number }>;
  rulesAdded: FrameworkRule[];
  rulesRemoved: FrameworkRule[];
  rulesChanged: RuleChange[];
}

function diff(prev: FrameworkConfig, next: FrameworkConfig): DiffResult {
  const prevFactors = new Map(prev.factors.map((f) => [f.id, f]));
  const nextFactors = new Map(next.factors.map((f) => [f.id, f]));

  const added: FactorConfig[] = [];
  const removed: FactorConfig[] = [];
  const changed: FactorChange[] = [];

  for (const [id, f] of prevFactors) {
    if (!nextFactors.has(id)) removed.push(f);
  }
  for (const [id, n] of nextFactors) {
    const p = prevFactors.get(id);
    if (!p) {
      added.push(n);
      continue;
    }
    if (p.weight !== n.weight || p.hardFloor !== n.hardFloor) {
      changed.push({
        id,
        label: n.label,
        weight: { prev: p.weight, next: n.weight },
        hardFloor: { prev: p.hardFloor, next: n.hardFloor },
      });
    }
  }

  const thresholds: DiffResult["thresholds"] = [];
  if (prev.thresholds.viability !== next.thresholds.viability) {
    thresholds.push({
      key: "viability",
      prev: prev.thresholds.viability,
      next: next.thresholds.viability,
    });
  }
  if (prev.thresholds.nearMissBandLow !== next.thresholds.nearMissBandLow) {
    thresholds.push({
      key: "nearMissBandLow",
      prev: prev.thresholds.nearMissBandLow,
      next: next.thresholds.nearMissBandLow,
    });
  }
  if (prev.thresholds.nearMissBandHigh !== next.thresholds.nearMissBandHigh) {
    thresholds.push({
      key: "nearMissBandHigh",
      prev: prev.thresholds.nearMissBandHigh,
      next: next.thresholds.nearMissBandHigh,
    });
  }

  const prevRules = new Map(prev.rules.map((r) => [r.id, r]));
  const nextRules = new Map(next.rules.map((r) => [r.id, r]));
  const rulesAdded: FrameworkRule[] = [];
  const rulesRemoved: FrameworkRule[] = [];
  const rulesChanged: RuleChange[] = [];
  for (const [id, r] of prevRules) {
    if (!nextRules.has(id)) rulesRemoved.push(r);
  }
  for (const [id, n] of nextRules) {
    const p = prevRules.get(id);
    if (!p) {
      rulesAdded.push(n);
      continue;
    }
    if (p.expression !== n.expression || p.severity !== n.severity) {
      rulesChanged.push({
        id,
        prev: { expression: p.expression, severity: p.severity },
        next: { expression: n.expression, severity: n.severity },
      });
    }
  }

  return {
    added,
    removed,
    changed,
    thresholds,
    rulesAdded,
    rulesRemoved,
    rulesChanged,
  };
}

function fmtFloor(v: number | null): string {
  return v === null ? "—" : String(v);
}

export default async function FrameworkDiffPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { from, to } = await params;

  let fromRow: FrameworkVersionRow | null = null;
  let toRow: FrameworkVersionRow | null = null;
  let preLaunch = false;
  try {
    [fromRow, toRow] = await Promise.all([
      getFrameworkVersion(from),
      getFrameworkVersion(to),
    ]);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
    preLaunch = true;
  }

  if (preLaunch) {
    return (
      <article className="max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Framework diff
          </h1>
          <p className="mt-2 text-sm text-zinc-500 font-mono">
            {from} → {to}
          </p>
        </header>
        <p className="text-zinc-400">
          The framework_versions table has not been seeded yet. The first scan
          will insert v1.0.0; subsequent bumps will appear here.
        </p>
        <p className="mt-4">
          <Link
            href="/research/framework"
            className="text-zinc-300 hover:text-white underline-offset-4 hover:underline"
          >
            ← Framework
          </Link>
        </p>
      </article>
    );
  }

  if (!fromRow || !toRow) notFound();

  const prev = fromRow.configSnapshotJson;
  const next = toRow.configSnapshotJson;
  const d = diff(prev, next);

  const empty =
    d.added.length === 0 &&
    d.removed.length === 0 &&
    d.changed.length === 0 &&
    d.thresholds.length === 0 &&
    d.rulesAdded.length === 0 &&
    d.rulesRemoved.length === 0 &&
    d.rulesChanged.length === 0;

  return (
    <article>
      <header className="mb-10">
        <p className="text-sm text-zinc-500 font-mono">
          {from} → {to}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Framework diff
        </h1>
        {toRow.migrationNotes ? (
          <p className="mt-3 text-zinc-300 max-w-2xl leading-relaxed">
            {toRow.migrationNotes}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500 tabular-nums">
          {fromRow.effectiveFrom.slice(0, 10)} →{" "}
          {toRow.effectiveFrom.slice(0, 10)}
        </p>
      </header>

      {empty ? (
        <p className="text-zinc-400">
          Snapshots are byte-identical. No factors, thresholds, or rules
          changed between these versions.
        </p>
      ) : null}

      {d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Factors</h2>

          {d.added.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400 mb-2">
                Added ({d.added.length})
              </h3>
              <ul className="divide-y divide-zinc-800/80">
                {d.added.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-baseline justify-between py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{f.label}</span>
                      <span className="ml-2 text-xs text-zinc-500 font-mono">
                        {f.id}
                      </span>
                    </div>
                    <div className="text-zinc-400 tabular-nums text-xs">
                      weight {f.weight} · floor {fmtFloor(f.hardFloor)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {d.removed.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-rose-400 mb-2">
                Removed ({d.removed.length})
              </h3>
              <ul className="divide-y divide-zinc-800/80">
                {d.removed.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-baseline justify-between py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium line-through text-zinc-400">
                        {f.label}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500 font-mono">
                        {f.id}
                      </span>
                    </div>
                    <div className="text-zinc-500 tabular-nums text-xs">
                      was weight {f.weight}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {d.changed.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-amber-400 mb-2">
                Changed ({d.changed.length})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left font-normal py-2">Factor</th>
                    <th className="text-right font-normal py-2">
                      Weight {from}
                    </th>
                    <th className="text-right font-normal py-2">
                      Weight {to}
                    </th>
                    <th className="text-right font-normal py-2">
                      Floor {from}
                    </th>
                    <th className="text-right font-normal py-2">
                      Floor {to}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.changed.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-900/60">
                      <td className="py-2">
                        <span className="font-medium">{c.label}</span>
                        <span className="ml-2 text-xs text-zinc-500 font-mono">
                          {c.id}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-500">
                        {c.weight.prev}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          c.weight.prev !== c.weight.next
                            ? "text-amber-400"
                            : ""
                        }`}
                      >
                        {c.weight.next}
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-500">
                        {fmtFloor(c.hardFloor.prev)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          c.hardFloor.prev !== c.hardFloor.next
                            ? "text-amber-400"
                            : ""
                        }`}
                      >
                        {fmtFloor(c.hardFloor.next)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {d.thresholds.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Thresholds</h2>
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left font-normal py-2">Key</th>
                <th className="text-right font-normal py-2">{from}</th>
                <th className="text-right font-normal py-2">{to}</th>
              </tr>
            </thead>
            <tbody>
              {d.thresholds.map((t) => (
                <tr key={t.key} className="border-b border-zinc-900/60">
                  <td className="py-2 font-mono text-zinc-300">{t.key}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">
                    {t.prev}
                  </td>
                  <td className="py-2 text-right tabular-nums text-amber-400">
                    {t.next}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {d.rulesAdded.length > 0 ||
      d.rulesRemoved.length > 0 ||
      d.rulesChanged.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Rules</h2>

          {d.rulesAdded.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400 mb-2">
                Added ({d.rulesAdded.length})
              </h3>
              <ul className="space-y-2">
                {d.rulesAdded.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span
                      className={
                        r.severity === "hard"
                          ? "inline-block text-xs uppercase tracking-wider text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded mr-3"
                          : "inline-block text-xs uppercase tracking-wider text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded mr-3"
                      }
                    >
                      {r.severity}
                    </span>
                    <span className="text-zinc-200">{r.expression}</span>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">
                      {r.id}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {d.rulesRemoved.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-rose-400 mb-2">
                Removed ({d.rulesRemoved.length})
              </h3>
              <ul className="space-y-2">
                {d.rulesRemoved.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="text-zinc-500 line-through">
                      {r.expression}
                    </span>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">
                      {r.id}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {d.rulesChanged.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-amber-400 mb-2">
                Changed ({d.rulesChanged.length})
              </h3>
              <ul className="space-y-4">
                {d.rulesChanged.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="text-xs text-zinc-500 font-mono mb-1">
                      {c.id}
                    </div>
                    <div className="text-zinc-500 line-through">
                      <span className="text-xs uppercase tracking-wider mr-2">
                        {c.prev.severity}
                      </span>
                      {c.prev.expression}
                    </div>
                    <div className="text-zinc-200 mt-1">
                      <span
                        className={
                          c.next.severity === "hard"
                            ? "inline-block text-xs uppercase tracking-wider text-rose-400 mr-2"
                            : "inline-block text-xs uppercase tracking-wider text-amber-400 mr-2"
                        }
                      >
                        {c.next.severity}
                      </span>
                      {c.next.expression}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="mt-12 text-sm">
        <Link
          href="/research/framework"
          className="text-zinc-300 hover:text-white underline-offset-4 hover:underline"
        >
          ← Framework
        </Link>
      </footer>
    </article>
  );
}
