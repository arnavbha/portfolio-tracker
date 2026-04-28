import {
  listAllPicksForFeed,
  listRecentScanSnapshots,
} from "@/lib/research/queries";
import { isExpectedPreLaunchError } from "../_components/EmptyState";
import type { PickRow, ScanSnapshotRow } from "@/lib/research/types";

export const revalidate = 3600;

const TAG_AUTHORITY = "portfolio-tracker.local";

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(s: string): string {
  // Postgres TIMESTAMPTZ stringifies as ISO-ish; Date round-trips it cleanly.
  return new Date(s).toISOString();
}

function dayIso(scanDate: string): string {
  return new Date(`${scanDate}T00:00:00Z`).toISOString();
}

interface FeedEntry {
  id: string;
  title: string;
  link: string;
  updated: string;
  published: string;
  summary: string;
  sortKey: string;
}

function pickEntry(p: PickRow, base: string): FeedEntry {
  const link = `${base}/research/pick/${p.id}`;
  const id = `tag:${TAG_AUTHORITY},${p.issuedDate}:pick-${p.id}`;
  const published = dayIso(p.issuedDate);
  const updated = p.invalidatedAt ? toIso(p.invalidatedAt) : toIso(p.createdAt);
  const summary =
    p.status === "invalidated"
      ? `[INVALIDATED] ${p.thesisText}`
      : p.thesisText;
  const title =
    p.status === "invalidated"
      ? `${p.ticker} — invalidated`
      : `${p.ticker} — ${p.issuedDate}`;
  return {
    id,
    title,
    link,
    updated,
    published,
    summary,
    sortKey: updated,
  };
}

function nullDayEntry(s: ScanSnapshotRow, base: string): FeedEntry {
  const link = `${base}/research/journal/${s.scanDate}`;
  const id = `tag:${TAG_AUTHORITY},${s.scanDate}:nullday-${s.scanDate}`;
  const published = dayIso(s.scanDate);
  const updated = toIso(s.createdAt);
  const summary =
    s.reasonText ??
    `No ticker passed viability ≥ ${s.viabilityThreshold}. Top: ${s.topTicker} @ ${s.topScore}.`;
  return {
    id,
    title: `Nothing today — ${s.scanDate}`,
    link,
    updated,
    published,
    summary,
    sortKey: updated,
  };
}

function renderAtom(entries: FeedEntry[], base: string, updated: string): string {
  const selfHref = `${base}/research/feed.xml`;
  const items = entries
    .map(
      (e) => `  <entry>
    <id>${escapeXml(e.id)}</id>
    <title>${escapeXml(e.title)}</title>
    <link rel="alternate" type="text/html" href="${escapeXml(e.link)}"/>
    <updated>${e.updated}</updated>
    <published>${e.published}</published>
    <summary type="text">${escapeXml(e.summary)}</summary>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Research — Portfolio Tracker</title>
  <subtitle>Daily framework scan of the S&amp;P 100. One pick on a viable day, nothing on the rest.</subtitle>
  <link rel="self" type="application/atom+xml" href="${escapeXml(selfHref)}"/>
  <link rel="alternate" type="text/html" href="${escapeXml(`${base}/research`)}"/>
  <id>tag:${TAG_AUTHORITY},2026:research-feed</id>
  <updated>${updated}</updated>
${items}
</feed>
`;
}

export async function GET(): Promise<Response> {
  const base = baseUrl();

  let picks: PickRow[] = [];
  let snapshots: ScanSnapshotRow[] = [];
  try {
    [picks, snapshots] = await Promise.all([
      listAllPicksForFeed(50),
      listRecentScanSnapshots(50),
    ]);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  const pickEntries = picks.map((p) => pickEntry(p, base));
  const nullEntries = snapshots
    .filter((s) => s.pickedTicker === null)
    .map((s) => nullDayEntry(s, base));

  const merged = [...pickEntries, ...nullEntries]
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, 50);

  const updated =
    merged[0]?.updated ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const body = renderAtom(merged, base, updated);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
