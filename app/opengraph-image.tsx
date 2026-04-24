import { ImageResponse } from "next/og";

export const alt = "Prism — cursor-reactive design engineering components";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#050505",
          padding: 80,
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 30%, rgba(180, 200, 255, 0.18), transparent 45%), radial-gradient(circle at 75% 70%, rgba(255, 180, 210, 0.18), transparent 45%), radial-gradient(circle at 50% 50%, rgba(200, 255, 220, 0.12), transparent 50%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 28,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            prism.sammii.dev
          </div>
          <div
            style={{
              color: "white",
              fontSize: 96,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Prism
          </div>
        </div>
        <div
          style={{
            position: "relative",
            color: "rgba(255,255,255,0.82)",
            fontSize: 44,
            lineHeight: 1.25,
            maxWidth: 1000,
            fontWeight: 500,
          }}
        >
          Cursor-reactive design engineering components. Spring physics, zero runtime deps.
        </div>
      </div>
    ),
    { ...size }
  );
}
