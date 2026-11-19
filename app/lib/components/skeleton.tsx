"use client";
import { useRef, useEffect } from "react";
import { pastelColour } from "../primitives/gradient";
import { subscribeAttention } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

export interface SkeletonProps {
  /** Width — number (px) or CSS string */
  width?: string | number;
  /** Height — number (px) or CSS string */
  height?: string | number;
  /** Tailwind border-radius class. Default: "rounded-lg" */
  rounded?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Placeholder loading shape with a cursor-tinted travelling shimmer.
 * A bright band sweeps across on a ~2s rAF loop with a hint of
 * pastelColour mapped to cursor position.
 *
 * @example
 * <Skeleton width={200} height={16} />
 * <Skeleton width={40} height={40} rounded="rounded-full" />
 */
export const Skeleton = ({
  width,
  height = 16,
  rounded = "rounded-lg",
  className = "",
}: SkeletonProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;

    // Released attention parks at FAR_AWAY; keep the last colour instead of following it
    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none") return;
      rawX = (x / window.innerWidth) * 100;
      rawY = (y / window.innerHeight) * 100;
    });

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      // Reduced motion: no travelling band, hold the plain resting fill
      if (reducedMotionNow()) {
        el.style.backgroundImage = "";
        raf = requestAnimationFrame(tick);
        return;
      }

      const t = motionTime();
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Shimmer band position (~2s loop)
      const progress = ((t % 2) / 2) * 100;
      const bw = 25;

      // Mix pastel with white for subtle tint
      const mr = Math.round(r * 0.2 + 255 * 0.8);
      const mg = Math.round(g * 0.2 + 255 * 0.8);
      const mb = Math.round(b * 0.2 + 255 * 0.8);

      el.style.backgroundImage = `linear-gradient(
        90deg,
        rgba(255,255,255,0.04) ${progress - bw}%,
        rgba(${mr},${mg},${mb},0.08) ${progress}%,
        rgba(255,255,255,0.04) ${progress + bw}%
      )`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, []);

  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    backgroundColor: "rgba(255,255,255,0.04)",
    willChange: "background-image",
  };

  return (
    <div
      ref={ref}
      // Purely visual placeholder: the loading region that holds it should set aria-busy
      aria-hidden="true"
      className={`${rounded} ${className}`}
      style={style}
    />
  );
};
