import { ImageResponse } from "next/og";

export const alt = "Sammii Kellow — senior frontend / design engineer";
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
              "radial-gradient(circle at 25% 25%, rgba(255, 200, 180, 0.18), transparent 45%), radial-gradient(circle at 80% 75%, rgba(180, 210, 255, 0.18), transparent 45%), radial-gradient(circle at 55% 50%, rgba(230, 200, 255, 0.12), transparent 50%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 26,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            hiring sammii
          </div>
          <div
            style={{
              color: "white",
              fontSize: 82,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            Senior frontend / design engineer.
          </div>
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 38, fontWeight: 500 }}>
            London · UK citizen · permanent or contract
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 24,
              letterSpacing: "0.02em",
            }}
          >
            prism.sammii.dev/hire
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
