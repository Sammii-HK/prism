"use client";
import { PulseDot } from "../lib/components/pulse-dot";

export default function PulseDotDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-10">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          pulse-dot
        </p>

        {/* Cursor-reactive at different sizes */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-mono mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            cursor-reactive
          </p>
          <div className="flex items-center gap-6">
            <PulseDot size={6} />
            <PulseDot size={8} />
            <PulseDot size={12} />
            <PulseDot size={16} />
          </div>
        </div>

        {/* Fixed colours */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-mono mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            fixed colours
          </p>
          <div className="flex items-center gap-6">
            <PulseDot size={10} colour="#7dd3fc" />
            <PulseDot size={10} colour="#86efac" />
            <PulseDot size={10} colour="#fcd34d" />
            <PulseDot size={10} colour="#fca5a5" />
          </div>
        </div>

        <p
          className="text-xs italic mt-4"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Top row follows your cursor. Bottom row stays fixed.
        </p>
      </div>
    </div>
  );
}
