"use client";
import { GlowBadge } from "../lib/components/glow-badge";

export default function GlowBadgeDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-8">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          glow-badge
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <GlowBadge>Active</GlowBadge>
          <GlowBadge variant="success">Shipped</GlowBadge>
          <GlowBadge variant="warning">Pending</GlowBadge>
          <GlowBadge variant="error">Failed</GlowBadge>
          <GlowBadge pulse={false}>Disabled</GlowBadge>
        </div>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Move your cursor near the badges.
        </p>
      </div>
    </div>
  );
}
