import { revalidatePath } from "next/cache";

/**
 * GHA → Vercel revalidation hook. Called by .github/workflows/daily-scan.yml
 * after the daily scan finishes inserting rows into Postgres. Bearer-token
 * auth via CRON_SECRET (set in both GHA secrets and Vercel env).
 *
 * The /research/:path* pages run with `dynamic = "force-dynamic"` so they
 * already fetch fresh DB rows per request, but the Atom feed uses
 * `revalidate = 3600` and individual pick pages may end up cached by edge
 * middleware in the future. This handler prods every cacheable surface.
 */
export const dynamic = "force-dynamic";

const PATHS = [
  "/research",
  "/research/journal",
  "/research/graveyard",
  "/research/feed.xml",
] as const;

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not configured on this deployment" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return Response.json({ ok: false, error: "missing bearer token" }, { status: 401 });
  }
  const token = auth.slice("bearer ".length).trim();

  if (!constantTimeEqual(token, expected)) {
    return Response.json({ ok: false, error: "invalid bearer token" }, { status: 401 });
  }

  const revalidated: string[] = [];
  for (const p of PATHS) {
    revalidatePath(p);
    revalidated.push(p);
  }

  return Response.json({ ok: true, revalidated, at: new Date().toISOString() });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
