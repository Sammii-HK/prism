import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          borderRadius: 36,
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 20,
            background:
              "linear-gradient(135deg, rgba(255,180,210,0.95) 0%, rgba(180,210,255,0.95) 50%, rgba(210,255,200,0.95) 100%)",
            borderRadius: 24,
            filter: "blur(14px)",
            opacity: 0.95,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 28,
            background: "#050505",
            borderRadius: 20,
          }}
        />
        <div
          style={{
            position: "relative",
            color: "white",
            fontSize: 100,
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          P
        </div>
      </div>
    ),
    { ...size }
  );
}
