"use client";
import { useRef, useEffect } from "react";
import { pastelColour } from "../primitives/gradient";

export interface AvatarProps {
  /** Image URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Fallback initials when no src is provided */
  fallback?: string;
  /** Diameter in pixels. Default: 40 */
  size?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Circular avatar with image or fallback initials. Pastel ring glow reacts
 * to cursor proximity (120px range, capped at 0.45 opacity). Ring colour
 * shifts with cursor position via pastelColour — all driven by refs + rAF.
 *
 * @example
 * <Avatar src="https://i.pravatar.cc/80" alt="User" />
 * <Avatar fallback="SK" size={56} />
 */
export const Avatar = ({
  src,
  alt = "",
  fallback = "",
  size = 40,
  className = "",
}: AvatarProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let mouseX = 0;
    let mouseY = 0;
    let proximity = 0;
    let smoothProximity = 0;

    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const range = 120;
      proximity = Math.max(0, 1 - dist / range);
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      smoothProximity += (proximity - smoothProximity) * 0.1;

      const t = performance.now() / 1000;
      const rect = el.getBoundingClientRect();
      const xPc = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const yPc = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      const { r, g, b } = pastelColour(xPc, yPc, t);

      const glow = Math.min(smoothProximity, 0.45);

      el.style.boxShadow = glow > 0.01
        ? `0 0 ${12 * glow}px rgba(${r},${g},${b},${(glow * 0.6).toFixed(3)}), 0 0 ${4 * glow}px rgba(${r},${g},${b},${(glow * 0.3).toFixed(3)})`
        : "none";
      el.style.borderColor = glow > 0.01
        ? `rgba(${r},${g},${b},${(glow * 0.7).toFixed(3)})`
        : "rgba(255,255,255,0.08)";

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const fontSize = Math.round(size * 0.38);

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        willChange: "box-shadow, border-color",
        backgroundColor: src ? "transparent" : "rgba(255,255,255,0.08)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- library component; next/image would couple it to Next.js
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
            display: "block",
          }}
        />
      ) : (
        <span
          style={{
            fontSize,
            lineHeight: 1,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {fallback}
        </span>
      )}
    </div>
  );
};
