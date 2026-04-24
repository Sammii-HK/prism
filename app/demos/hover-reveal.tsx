"use client";
import { HoverReveal } from "../lib/components/hover-reveal";

export default function HoverRevealDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-1">
        {/* Eyebrow */}
        <p
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          hover-reveal
        </p>

        {/* (a) Pricing */}
        <HoverReveal
          revealContent={
            <p className="text-sm text-white/40 py-3 px-1">
              Starting at $9/month. Scale as you grow.
            </p>
          }
        >
          <p className="text-sm text-white/60 py-3 px-1 cursor-default">
            Pricing
          </p>
        </HoverReveal>

        {/* (b) Features */}
        <HoverReveal
          revealContent={
            <ul className="text-sm text-white/40 py-3 px-1 flex flex-col gap-1">
              <li>Spring-physics animations</li>
              <li>Cursor-reactive colour</li>
              <li>Zero dependencies</li>
            </ul>
          }
        >
          <p className="text-sm text-white/60 py-3 px-1 cursor-default">
            Features
          </p>
        </HoverReveal>

        {/* (c) Support — direction up */}
        <HoverReveal
          direction="up"
          revealContent={
            <p className="text-sm text-white/40 py-3 px-1">
              24/7 live chat with real humans.
            </p>
          }
        >
          <p className="text-sm text-white/60 py-3 px-1 cursor-default">
            Support
          </p>
        </HoverReveal>

        {/* Footer hint */}
        <p
          className="text-xs italic mt-4"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Hover each item to reveal details.
        </p>
      </div>
    </div>
  );
}
