#!/usr/bin/env tsx
/**
 * Apply SQL migrations in db/migrations/ in lexical order. Idempotent: each
 * file is recorded in `_research_migrations(filename, applied_at)` after a
 * successful transaction, and on subsequent runs already-applied files are
 * skipped.
 *
 * Migration files are pure SQL — keep them dialect-PostgreSQL, transaction-
 * safe (every statement that needs a tx is wrapped in BEGIN/COMMIT inside the
 * file already), and additive whenever possible. To roll back, write a new
 * migration that undoes the previous one; never edit a file once shipped.
 *
 *   npm run db:migrate
 *
 * Connection comes from DATABASE_URL via .env.local (loaded at the top).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const envFile = resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

import { Client } from "pg";

const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");
const MIGRATIONS_TABLE = "_research_migrations";

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("db:migrate — DATABASE_URL not set. See docs/RESEARCH-SETUP.md.");
    process.exit(1);
  }

  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`db:migrate — directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("db:migrate — no .sql files in db/migrations/. Nothing to do.");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
         filename   TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );

    const applied = new Set(
      (
        await client.query<{ filename: string }>(
          `SELECT filename FROM ${MIGRATIONS_TABLE}`,
        )
      ).rows.map((r) => r.filename),
    );

    let applies = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`  apply  ${file} ...`);
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
          [file],
        );
        applies++;
      } catch (e) {
        console.error(`  FAIL   ${file}: ${(e as Error).message}`);
        process.exit(1);
      }
    }
    console.log(`db:migrate — done. Applied ${applies} new file(s); ${applied.size + applies} total.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`db:migrate — FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
