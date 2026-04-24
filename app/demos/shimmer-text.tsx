"use client";
import { ShimmerText } from "../lib/components/shimmer-text";

export default function ShimmerTextDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-6">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          shimmer-text
        </p>

        <ShimmerText className="text-5xl font-semibold tracking-tight">
          Design engineering
        </ShimmerText>

        <ShimmerText className="text-xl font-light tracking-tight" speed={0.7}>
          Components with soul
        </ShimmerText>

        <ShimmerText className="text-xs font-mono uppercase tracking-widest" speed={1.5}>
          New
        </ShimmerText>

        <p
          className="text-xs italic mt-8"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Move your cursor. Watch the shimmer.
        </p>
      </div>
    </div>
  );
}
