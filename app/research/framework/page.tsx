import Link from "next/link";
import { listFrameworkVersions } from "@/lib/research/queries";
import { FRAMEWORK_CONFIG, totalWeight } from "@/lib/research/framework-config";
import type { FrameworkVersionRow } from "@/lib/research/types";
import { isExpectedPreLaunchError } from "../_components/EmptyState";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "factors", label: "Factors" },
  { id: "thresholds", label: "Thresholds" },
  { id: "rules", label: "Rules" },
  { id: "history", label: "Version history" },
];

export default async function FrameworkPage() {
  let versions: FrameworkVersionRow[] = [];
  try {
    versions = await listFrameworkVersions();
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  // Render against the live TS config since the DB row may not exist yet.
  // Once seeded, the diff page renders against snapshots — this page stays
  // anchored to the live truth so operators can sanity-check what's deployed.
  const cfg = FRAMEWORK_CONFIG;
  const weightTotal = totalWeight(cfg);

  return (
    <article>
      <header className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight">Framework</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Live config: {cfg.version} · total weight {weightTotal} ·{" "}
          {cfg.factors.length} factors · {cfg.rules.length} rules
        </p>
        <nav className="mt-6 flex gap-5 text-sm text-zinc-400">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="hover:text-zinc-100">
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <section id="factors" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-semibold mb-4">Factors</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left font-normal py-2">Label</th>
              <th className="text-left font-normal py-2">Type</th>
              <th className="text-right font-normal py-2">Weight</th>
              <th className="text-right font-normal py-2">Hard floor</th>
            </tr>
          </thead>
          <tbody>
            {cfg.factors.map((f) => (
              <tr key={f.id} className="border-b border-zinc-900/60">
                <td className="py-2">
                  <span className="font-medium">{f.label}</span>
                  <span className="ml-2 text-xs text-zinc-500 font-mono">
                    {f.id}
                  </span>
                </td>
                <td className="py-2 text-zinc-400">{f.type}</td>
                <td className="py-2 text-right tabular-nums">{f.weight}</td>
                <td className="py-2 text-right tabular-nums text-zinc-400">
                  {f.hardFloor === null ? "—" : f.hardFloor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="thresholds" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-semibold mb-4">Thresholds</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm max-w-md">
          <dt className="text-zinc-500">Viability</dt>
          <dd className="tabular-nums">≥ {cfg.thresholds.viability}</dd>
          <dt className="text-zinc-500">Near-miss band</dt>
          <dd className="tabular-nums">
            {cfg.thresholds.nearMissBandLow}–{cfg.thresholds.nearMissBandHigh}
          </dd>
        </dl>
      </section>

      <section id="rules" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-semibold mb-4">Rules</h2>
        <ul className="space-y-3">
          {cfg.rules.map((r) => (
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
      </section>

      <section id="history" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-semibold mb-4">Version history</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No persisted versions yet. The first scan will seed{" "}
            <span className="font-mono">{cfg.version}</span>.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800/80">
            {versions.map((v, i) => {
              const prior = versions[i + 1];
              return (
                <li
                  key={v.id}
                  className="flex items-baseline justify-between py-3 text-sm"
                >
                  <div>
                    <span className="font-medium font-mono">{v.version}</span>
                    {v.migrationNotes ? (
                      <span className="ml-3 text-zinc-400">
                        {v.migrationNotes}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="text-zinc-500 tabular-nums">
                      {v.effectiveFrom.slice(0, 10)}
                    </span>
                    {prior ? (
                      <Link
                        href={`/research/framework/diff/${prior.version}/${v.version}`}
                        className="text-zinc-300 hover:text-white underline-offset-4 hover:underline"
                      >
                        diff →
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}
