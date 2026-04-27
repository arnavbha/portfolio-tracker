import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { FRAMEWORK_CONFIG, serializeSnapshot, snapshotsEqual } from "@/lib/research/framework-config";
import type { FrameworkConfig } from "@/lib/research/types";

/**
 * Eng-review CQ 2A: snapshot drift test, promoted into V1.
 *
 * The diff page renders against framework_versions.config_snapshot_json (DB), not
 * against the live TS config (lib/research/framework-config.ts). A silent drift
 * between the two means the diff page lies. This test fails CI when:
 *
 *   1. The TS config version is missing from framework_versions.
 *   2. The TS config does not deep-equal the snapshot stored under that version.
 *
 * Operator fix on failure: run `bun run framework:bump` to commit the new snapshot.
 *
 * The test SKIPS when DATABASE_URL is unset (e.g. CI without DB access). That is
 * intentional — the test gates deploys, not pure-local builds.
 */

const dbUrl = process.env.DATABASE_URL;

describe("framework snapshot drift", () => {
  if (!dbUrl) {
    it.skip("DATABASE_URL not set — skipping (this is expected in offline CI)", () => {});
    return;
  }

  it("live TS config matches the snapshot stored in framework_versions for its version", async () => {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ config_snapshot_json: FrameworkConfig }>(
        "SELECT config_snapshot_json FROM framework_versions WHERE version = $1",
        [FRAMEWORK_CONFIG.version]
      );

      expect(rows.length, `no framework_versions row for ${FRAMEWORK_CONFIG.version} — run framework:bump`).toBe(1);

      const stored = rows[0].config_snapshot_json;
      const live = serializeSnapshot(FRAMEWORK_CONFIG);

      expect(snapshotsEqual(stored, live), "live TS config drifted from stored snapshot — run framework:bump").toBe(true);
    } finally {
      await client.end();
    }
  });
});
