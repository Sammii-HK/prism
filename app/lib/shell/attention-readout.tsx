"use client";
import { useEffect, useState } from "react";
import { subscribeAttention, type AttentionKind } from "../hooks/attention";
import { motionTime, useReducedMotion } from "../hooks/reduced-motion";
import { pastelColour } from "../primitives/gradient";

const KIND_LABEL: Record<AttentionKind, string> = {
  mouse: "cursor",
  touch: "touch",
  keyboard: "keyboard",
  none: "idle",
};

type Reading = { kind: AttentionKind; xPc: number; yPc: number; rgb: [number, number, number] };

/**
 * A live instrument line that shows what the components are reacting to:
 * which input, where on the page, and the colour that point maps to.
 * It makes the attention system visible, including the keyboard and touch
 * paths that are otherwise easy to miss.
 */
export const AttentionReadout = ({ className = "" }: { className?: string }) => {
  const reduced = useReducedMotion();
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    let frame = 0;
    let latest: { kind: AttentionKind; x: number; y: number } | null = null;

    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none" && !latest) return;
      latest = kind === "none" && latest ? { ...latest, kind } : { x, y, kind };
      if (frame) return;
      // Coalesce to one update per frame; pointermove can fire far faster.
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!latest) return;
        const xPc = (latest.x / window.innerWidth) * 100;
        const yPc = (latest.y / window.innerHeight) * 100;
        const { r, g, b } = pastelColour(xPc, yPc, motionTime());
        setReading({ kind: latest.kind, xPc, yPc, rgb: [Math.round(r), Math.round(g), Math.round(b)] });
      });
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, []);

  const rgb = reading ? `rgb(${reading.rgb.join(" ")})` : "rgb(255 255 255 / 0.3)";

  return (
    <div
      aria-hidden="true"
      className={`inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 font-mono text-[11px] tabular-nums text-white/55 ${className}`}
    >
      <span className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: rgb, boxShadow: reading ? `0 0 10px ${rgb}` : "none" }}
        />
        <span className="text-white/75">{reading ? KIND_LABEL[reading.kind] : "move, tap or press tab"}</span>
      </span>
      {reading && (
        <>
          <span>
            x {reading.xPc.toFixed(1).padStart(5, " ")} · y {reading.yPc.toFixed(1).padStart(5, " ")}
          </span>
          <span className="hidden sm:inline">rgb {reading.rgb.join(" ")}</span>
        </>
      )}
      {reduced && <span className="text-white/75">reduced motion</span>}
    </div>
  );
};
