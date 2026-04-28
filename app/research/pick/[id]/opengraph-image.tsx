import { ImageResponse } from "next/og";
import { getPickById } from "@/lib/research/queries";
import { isExpectedPreLaunchError } from "../../_components/EmptyState";
import type { PickRow } from "@/lib/research/types";

export const alt = "Research pick — Portfolio Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { id: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  let pick: PickRow | null = null;
  try {
    pick = await getPickById(id);
  } catch (e) {
    if (!isExpectedPreLaunchError(e)) throw e;
  }

  const ticker = pick?.ticker ?? "—";
  const score = pick ? pick.score.toFixed(2) : "—";
  const issued = pick?.issuedDate ?? "—";
  const framework = pick?.frameworkVersion ?? "v1.0.0";
  const invalidated = pick?.status === "invalidated";

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
          <div style={{ display: "flex" }}>Research · pick</div>
          <div
            style={{
              display: "flex",
              color: invalidated ? "#fb7185" : "#34d399",
            }}
          >
            {invalidated ? "Invalidated" : "Active"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 220,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              color: invalidated ? "#a1a1aa" : "#f4f4f5",
              textDecoration: invalidated ? "line-through" : "none",
              display: "flex",
            }}
          >
            {ticker}
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 38,
              color: "#a1a1aa",
              display: "flex",
            }}
          >
            Composite {score} · issued {issued}
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
          <div style={{ display: "flex" }}>Framework {framework}</div>
          <div style={{ display: "flex" }}>portfolio-tracker / research</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
