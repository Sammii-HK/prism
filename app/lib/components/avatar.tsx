"use client";
import { useRef, useEffect } from "react";
import { pastelColour } from "../primitives/gradient";
import { proximityToCircle, subscribeAttention } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

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
 * Circular avatar with image or fallback initials. The pastel ring glows
 * only while the pointer is over this avatar (capped at 0.45 opacity). Ring colour
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

    const unsubscribe = subscribeAttention(({ x, y }) => {
      mouseX = x;
      mouseY = y;

      // Only the avatar under the pointer answers, so a stack of them does
      // not all brighten as the cursor passes along it.
      proximity = proximityToCircle(el.getBoundingClientRect(), mouseX, mouseY);
    });

    let raf: number;

    const tick = () => {
      smoothProximity += (proximity - smoothProximity) * 0.1;
      if (reducedMotionNow()) smoothProximity = proximity;

      const t = motionTime();
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
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, []);

  const fontSize = Math.round(size * 0.38);
  // Without an image the initials are the only content, so name the avatar
  // itself: prefer alt (e.g. a full name) and fall back to the initials.
  const fallbackLabel = alt || fallback;

  return (
    <div
      ref={ref}
      role={!src && fallbackLabel ? "img" : undefined}
      aria-label={!src && fallbackLabel ? fallbackLabel : undefined}
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
          aria-hidden={fallbackLabel ? true : undefined}
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
