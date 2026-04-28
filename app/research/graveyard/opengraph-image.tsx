import { ImageResponse } from "next/og";
import { listInvalidatedPicks } from "@/lib/research/queries";
import { isExpectedPreLaunchError } from "../_components/EmptyState";
import type { PickRow } from "@/lib/research/types";

export const alt = "Research graveyard — invalidated picks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  let invalidated: PickRow[] = [];
  try {
    invalidated = await listInvalidatedPicks(100);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

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
            fontSize: 24,
            color: "#a1a1aa",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Research · graveyard
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 120,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "#fb7185",
              display: "flex",
            }}
          >
            Mortality register
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 38,
              color: "#a1a1aa",
              display: "flex",
            }}
          >
            {invalidated.length === 0
              ? "Every pick that ever shipped, and how it died."
              : `${invalidated.length} invalidated pick${invalidated.length === 1 ? "" : "s"}.`}
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
          <div style={{ display: "flex" }}>Public mistakes, public corrections</div>
          <div style={{ display: "flex" }}>portfolio-tracker / research</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
