"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";

export interface ShimmerTextProps {
  children: ReactNode;
  /** Additional class names */
  className?: string;
  /** Speed multiplier — 1 = ~3 second cycle */
  speed?: number;
}

/**
 * Text with a subtle travelling shimmer band whose colour is mapped to cursor
 * position via pastelColour. The band sweeps across on a loop using rAF — no
 * CSS transitions.
 *
 * @example
 * <ShimmerText>Design engineering</ShimmerText>
 * <ShimmerText speed={0.5} className="text-sm">Slow shimmer</ShimmerText>
 */
export const ShimmerText = ({
  children,
  className = "",
  speed = 1,
}: ShimmerTextProps) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const t = performance.now() / 1000;
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Band position: 0–100% on a sine-ish loop
      const cycleDuration = 3 / speed;
      const progress = ((t % cycleDuration) / cycleDuration) * 100;

      // Mix pastel colour with white for a subtle tint
      const mr = Math.round(r * 0.35 + 255 * 0.65);
      const mg = Math.round(g * 0.35 + 255 * 0.65);
      const mb = Math.round(b * 0.35 + 255 * 0.65);

      // Create a gradient that acts as the text colour via background-clip
      // Base: white at 50% opacity, band: white at 90% with pastel tint
      const bandPos = progress;
      const bandWidth = 15; // percentage width of band

      el.style.backgroundImage = `linear-gradient(
        90deg,
        rgba(255,255,255,0.5) ${bandPos - bandWidth}%,
        rgba(${mr},${mg},${mb},0.9) ${bandPos - bandWidth / 2}%,
        rgba(${mr},${mg},${mb},0.95) ${bandPos}%,
        rgba(${mr},${mg},${mb},0.9) ${bandPos + bandWidth / 2}%,
        rgba(255,255,255,0.5) ${bandPos + bandWidth}%
      )`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <span
      ref={spanRef}
      className={className}
      style={{
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.5))",
        willChange: "background-image",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
};
