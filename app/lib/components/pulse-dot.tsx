"use client";
import { useRef, useEffect } from "react";
import { pastelColour } from "../primitives/gradient";

export interface PulseDotProps {
  /** Dot diameter in pixels */
  size?: number;
  /** Fixed colour — if omitted, uses cursor-reactive pastelColour */
  colour?: string;
  /** Additional class names on the wrapper */
  className?: string;
}

/**
 * Notification dot with an organic breathing pulse ring that expands and fades.
 * Colour follows cursor position unless a fixed colour is provided.
 *
 * @example
 * <PulseDot />
 * <PulseDot size={12} colour="#7dd3fc" />
 */
export const PulseDot = ({
  size = 8,
  colour,
  className = "",
}: PulseDotProps) => {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;
    };

    if (!colour) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const t = performance.now() / 1000;

      // Resolve colour
      let colourStr: string;
      if (colour) {
        colourStr = colour;
      } else {
        const { r, g, b } = pastelColour(smoothX, smoothY, t);
        colourStr = `rgb(${r},${g},${b})`;
      }

      dot.style.backgroundColor = colourStr;

      // Pulse ring: sine easing, ~2s period
      const phase = ((Math.sin(t * Math.PI) + 1) / 2); // 0–1, smooth sine

      // Ring scale: 1x to 3x
      const ringScale = 1 + phase * 2;
      // Ring opacity: 0.4 to 0
      const ringOpacity = 0.4 * (1 - phase);

      ring.style.transform = `scale(${ringScale})`;
      ring.style.opacity = String(ringOpacity);
      ring.style.borderColor = colourStr;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      if (!colour) {
        window.removeEventListener("pointermove", onMove);
      }
      cancelAnimationFrame(raf);
    };
  }, [colour, size]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size * 3, height: size * 3 }}
    >
      {/* Pulse ring */}
      <span
        ref={ringRef}
        className="absolute rounded-full border"
        style={{
          width: size,
          height: size,
          borderColor: colour || "rgba(255,255,255,0.3)",
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* Core dot */}
      <span
        ref={dotRef}
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: colour || "rgba(255,255,255,0.5)",
          willChange: "background-color",
        }}
      />
    </span>
  );
};
