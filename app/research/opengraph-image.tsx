import { ImageResponse } from "next/og";

export const alt = "Research — Portfolio Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            fontSize: 28,
            color: "#a1a1aa",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Research
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              display: "flex",
            }}
          >
            Daily framework scan.
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 36,
              color: "#a1a1aa",
              lineHeight: 1.3,
              display: "flex",
            }}
          >
            One pick on a viable day. Nothing on the rest. Full track record.
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
          <div style={{ display: "flex" }}>S&amp;P 100 universe</div>
          <div style={{ display: "flex" }}>portfolio-tracker</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
