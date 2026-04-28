import { Pool, types as pgTypes, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/**
 * Postgres pool for the research section. Singleton across hot reloads in dev
 * (Next.js otherwise spawns a new pool per route compile, exhausting Neon
 * free-tier connections within a few minutes).
 *
 * Edge runtime: not used here. The scan pipeline runs from GHA + the read
 * paths run from Node-runtime RSCs. Middleware never touches this module.
 */

// Coerce DATE / TIMESTAMP / TIMESTAMPTZ to raw strings instead of Date objects.
// Reasons:
//   1. queries.ts types every date column as `string` and feeds them straight
//      into JSX (`<dd>{snapshot.scanDate}</dd>`); React refuses to render Date
//      objects so unparsed Dates produce a 500 with "Objects are not valid as
//      a React child (found: [object Date])".
//   2. Date roundtrips lose timezone fidelity for the DATE type — PG's DATE is
//      a calendar date, not an instant — and node-postgres converts it to UTC
//      midnight which we then re-format anyway.
// OIDs: 1082 = DATE, 1114 = TIMESTAMP (no tz), 1184 = TIMESTAMPTZ.
pgTypes.setTypeParser(1082, (v) => v); // DATE → "2026-04-28"
pgTypes.setTypeParser(1114, (v) => v); // TIMESTAMP → "2026-04-28 04:00:00"
pgTypes.setTypeParser(1184, (v) => v); // TIMESTAMPTZ → "2026-04-28 04:00:00+00"

declare global {
  // eslint-disable-next-line no-var
  var __researchPgPool: Pool | undefined;
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL not set. See docs/RESEARCH-SETUP.md for the secret split (.env.local for dev, Vercel env + GHA Secrets for deploy).",
    );
  }
  return new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.__researchPgPool) globalThis.__researchPgPool = buildPool();
    return globalThis.__researchPgPool;
  }
  if (!globalThis.__researchPgPool) globalThis.__researchPgPool = buildPool();
  return globalThis.__researchPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
