#!/usr/bin/env tsx
/**
 * Framework bump tool (DX3).
 *
 *   bun run framework:bump --version=v1.0.1 --reason="lowered mgmt-record floor 3 → 2.5"
 *
 * Reads the live TS config from lib/research/framework-config.ts, diffs against the
 * latest framework_versions row in the DB, prints the diff for operator review, and
 * on confirmation INSERTs a new framework_versions row with the serialized snapshot.
 *
 * Run AFTER editing lib/research/framework-config.ts. The version flag must match
 * the version field inside the TS file. The reason flag becomes migration_notes.
 */

import { Client } from "pg";
import { FRAMEWORK_CONFIG, serializeSnapshot, snapshotsEqual } from "../lib/research/framework-config";
import type { FrameworkConfig } from "../lib/research/types";

interface Args {
  version: string;
  reason: string;
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  let version = "";
  let reason = "";
  let yes = false;
  for (const a of argv.slice(2)) {
    if (a.startsWith("--version=")) version = a.slice("--version=".length);
    else if (a.startsWith("--reason=")) reason = a.slice("--reason=".length);
    else if (a === "--yes" || a === "-y") yes = true;
  }
  if (!version) fail("missing --version=vX.Y.Z");
  if (!reason) fail("missing --reason=\"...\"");
  return { version, reason, yes };
}

function fail(msg: string): never {
  console.error(`framework:bump error — ${msg}`);
  process.exit(1);
}

function diffSnapshots(prev: FrameworkConfig | null, next: FrameworkConfig): string[] {
  const lines: string[] = [];
  if (!prev) {
    lines.push(`baseline — no prior version. Seeding ${next.version}.`);
    lines.push(`  factors: ${next.factors.length}`);
    lines.push(`  viability threshold: ${next.thresholds.viability}`);
    lines.push(`  rules: ${next.rules.length}`);
    return lines;
  }
  if (snapshotsEqual(prev, next)) {
    lines.push("snapshots are identical — nothing to bump.");
    return lines;
  }
  lines.push(`${prev.version} → ${next.version}`);

  const prevFactors = Object.fromEntries(prev.factors.map((f) => [f.id, f]));
  const nextFactors = Object.fromEntries(next.factors.map((f) => [f.id, f]));

  for (const id of Object.keys(prevFactors)) {
    if (!(id in nextFactors)) lines.push(`  − removed factor: ${id}`);
  }
  for (const id of Object.keys(nextFactors)) {
    if (!(id in prevFactors)) {
      lines.push(`  + added factor: ${id} (weight ${nextFactors[id].weight}, floor ${nextFactors[id].hardFloor})`);
      continue;
    }
    const a = prevFactors[id], b = nextFactors[id];
    if (a.weight !== b.weight) lines.push(`  ~ ${id} weight: ${a.weight} → ${b.weight}`);
    if (a.hardFloor !== b.hardFloor) lines.push(`  ~ ${id} hardFloor: ${a.hardFloor} → ${b.hardFloor}`);
  }

  if (prev.thresholds.viability !== next.thresholds.viability) {
    lines.push(`  ~ viability threshold: ${prev.thresholds.viability} → ${next.thresholds.viability}`);
  }
  if (prev.thresholds.nearMissBandLow !== next.thresholds.nearMissBandLow) {
    lines.push(`  ~ near-miss band low: ${prev.thresholds.nearMissBandLow} → ${next.thresholds.nearMissBandLow}`);
  }
  if (prev.thresholds.nearMissBandHigh !== next.thresholds.nearMissBandHigh) {
    lines.push(`  ~ near-miss band high: ${prev.thresholds.nearMissBandHigh} → ${next.thresholds.nearMissBandHigh}`);
  }

  const prevRules = Object.fromEntries(prev.rules.map((r) => [r.id, r]));
  const nextRules = Object.fromEntries(next.rules.map((r) => [r.id, r]));
  for (const id of Object.keys(prevRules)) {
    if (!(id in nextRules)) lines.push(`  − removed rule: ${id} (${prevRules[id].expression})`);
  }
  for (const id of Object.keys(nextRules)) {
    if (!(id in prevRules)) lines.push(`  + added rule: ${id} (${nextRules[id].expression})`);
    else if (prevRules[id].expression !== nextRules[id].expression || prevRules[id].severity !== nextRules[id].severity) {
      lines.push(`  ~ rule ${id}: "${prevRules[id].expression}" (${prevRules[id].severity}) → "${nextRules[id].expression}" (${nextRules[id].severity})`);
    }
  }
  return lines;
}

async function prompt(question: string): Promise<boolean> {
  const { stdin, stdout } = process;
  return new Promise((resolve) => {
    stdout.write(`${question} [y/N] `);
    stdin.setEncoding("utf8");
    stdin.once("data", (data: string) => {
      resolve(data.trim().toLowerCase() === "y");
      stdin.pause();
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (FRAMEWORK_CONFIG.version !== args.version) {
    fail(
      `--version=${args.version} does not match lib/research/framework-config.ts version=${FRAMEWORK_CONFIG.version}. ` +
        `Edit the TS file first.`
    );
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) fail("DATABASE_URL not set. See docs/RESEARCH-SETUP.md.");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows: prior } = await client.query<{ version: string; config_snapshot_json: FrameworkConfig }>(
      "SELECT version, config_snapshot_json FROM framework_versions ORDER BY effective_from DESC LIMIT 1"
    );
    const prev = prior[0]?.config_snapshot_json ?? null;

    if (prev?.version === args.version) {
      fail(`version ${args.version} already exists in framework_versions. Pick a new version.`);
    }

    const nextSnapshot = serializeSnapshot(FRAMEWORK_CONFIG);
    const diff = diffSnapshots(prev, nextSnapshot);

    console.log(`\nframework:bump diff — ${prev?.version ?? "(none)"} → ${args.version}`);
    console.log("─".repeat(60));
    for (const line of diff) console.log(line);
    console.log("─".repeat(60));
    console.log(`reason: ${args.reason}\n`);

    if (prev && snapshotsEqual(prev, nextSnapshot)) {
      fail("nothing changed in lib/research/framework-config.ts — refusing to bump.");
    }

    const ok = args.yes ? true : await prompt("Insert this row?");
    if (!ok) {
      console.log("aborted.");
      process.exit(0);
    }

    await client.query(
      `INSERT INTO framework_versions (version, config_snapshot_json, migration_notes, effective_from)
       VALUES ($1, $2::jsonb, $3, NOW())`,
      [args.version, JSON.stringify(nextSnapshot), args.reason]
    );

    console.log(`✓ inserted framework_versions row for ${args.version}.`);
    console.log(`next: git commit lib/research/framework-config.ts && git push.`);
    console.log(
      `verify: open /research/framework/diff/${prev?.version ?? "v0"}/${args.version} after deploy.`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
