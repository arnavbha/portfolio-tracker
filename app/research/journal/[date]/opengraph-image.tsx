import { ImageResponse } from "next/og";
import { getScanSnapshotByDate } from "@/lib/research/queries";
import { isExpectedPreLaunchError } from "../../_components/EmptyState";
import type { ScanSnapshotRow } from "@/lib/research/types";

export const alt = "Research journal — Portfolio Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { date: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { date } = await params;

  let snapshot: ScanSnapshotRow | null = null;
  try {
    snapshot = await getScanSnapshotByDate(date);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  const isPick = snapshot?.pickedTicker !== null && snapshot?.pickedTicker !== undefined;
  const headline = isPick
    ? (snapshot!.pickedTicker as string)
    : "Nothing today";
  const sub = snapshot
    ? isPick
      ? `Composite ${snapshot.topScore.toFixed(2)} · viability ${snapshot.viabilityThreshold.toFixed(0)}`
      : `Top ${snapshot.topTicker} @ ${snapshot.topScore.toFixed(2)} · ${snapshot.nearMisses.length} near-miss${snapshot.nearMisses.length === 1 ? "" : "es"}`
    : "Daily framework scan";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#09090b",
          color: "#f4f4f5",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#a1a1aa",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>Research · journal</div>
          <div style={{ display: "flex" }}>{date}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: isPick ? 220 : 140,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              color: isPick ? "#f4f4f5" : "#a1a1aa",
              display: "flex",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 36,
              color: "#a1a1aa",
              display: "flex",
            }}
          >
            {sub}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#71717a",
          }}
        >
          <div style={{ display: "flex" }}>
            {snapshot ? `Framework ${snapshot.frameworkVersion}` : "Daily scan"}
          </div>
          <div style={{ display: "flex" }}>portfolio-tracker / research</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
