"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";

export interface GlowBadgeProps {
  children: ReactNode;
  /** Colour variant — default follows cursor, others use fixed accent colours */
  variant?: "default" | "success" | "warning" | "error";
  /** Enable organic breathing pulse animation */
  pulse?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Small pill badge with an organic breathing pulse and cursor-mapped pastel
 * glow border. Variants override the colour while keeping the same physics.
 *
 * @example
 * <GlowBadge>Active</GlowBadge>
 * <GlowBadge variant="success">Shipped</GlowBadge>
 * <GlowBadge variant="error" pulse={false}>Failed</GlowBadge>
 */
export const GlowBadge = ({
  children,
  variant = "default",
  pulse = true,
  className = "",
}: GlowBadgeProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;
    let proximity = 0;

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;

      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(0, Math.abs(e.clientX - cx) - rect.width / 2);
        const dy = Math.max(0, Math.abs(e.clientY - cy) - rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = 100;
        proximity = Math.max(0, 1 - dist / range);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const t = performance.now() / 1000;

      // Resolve colour
      let r: number, g: number, b: number;
      if (variant === "success") {
        r = 140; g = 220; b = 170;
      } else if (variant === "warning") {
        r = 230; g = 195; b = 140;
      } else if (variant === "error") {
        r = 255; g = 155; b = 145;
      } else {
        ({ r, g, b } = pastelColour(smoothX, smoothY, t));
      }

      // Breathing opacity via sine wave (~2s period)
      const breathe = pulse
        ? 0.6 + 0.4 * ((Math.sin(t * Math.PI) + 1) / 2)
        : 1;

      // Glow intensity: variant badges always glow softly, default reacts to proximity
      const glowStrength = variant === "default"
        ? Math.max(0.3, proximity)
        : 0.6;

      el.style.opacity = String(breathe);
      el.style.borderColor = `rgba(${r},${g},${b},${(0.5 * glowStrength).toFixed(3)})`;
      el.style.boxShadow = `0 0 ${8 * glowStrength}px rgba(${r},${g},${b},${(0.15 * glowStrength).toFixed(3)})`;
      el.style.backgroundColor = `rgba(${r},${g},${b},0.08)`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [variant, pulse]);

  return (
    <span ref={wrapRef} className="inline-block">
      <span
        ref={ref}
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-mono select-none ${className}`}
        style={{
          color: "rgba(255,255,255,0.7)",
          borderColor: "rgba(255,255,255,0.1)",
          backgroundColor: "rgba(255,255,255,0.04)",
          willChange: "opacity, border-color, box-shadow, background-color",
        }}
      >
        {children}
      </span>
    </span>
  );
};
