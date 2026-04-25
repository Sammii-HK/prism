import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 4,
            background:
              "linear-gradient(135deg, rgba(255,180,210,0.95) 0%, rgba(180,210,255,0.95) 50%, rgba(210,255,200,0.95) 100%)",
            borderRadius: 6,
            filter: "blur(2px)",
            opacity: 0.95,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 6,
            background: "#050505",
            borderRadius: 5,
          }}
        />
        <div
          style={{
            position: "relative",
            color: "white",
            fontSize: 18,
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
