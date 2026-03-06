"use client";
import { useEffect, useRef } from "react";
import { cursorColour } from "./gradient";

type CursorGlowProps = {
  /** Size of the glow in pixels. Default: 350 */
  size?: number;
  /** Blur radius in pixels. Default: 35 */
  blur?: number;
  /** Lerp smoothing (0-1). Default: 0.06 */
  lerp?: number;
  /** CSS opacity for the glow. Default: 0.08 */
  opacity?: number;
};

export const CursorGlow = ({
  size = 350,
  blur = 35,
  lerp: lerpFactor = 0.06,
  opacity = 0.08,
}: CursorGlowProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -size, y: -size });
  const target = useRef({ x: -size, y: -size });

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let raf: number;

    const tick = () => {
      pos.current.x = lerp(pos.current.x, target.current.x, lerpFactor);
      pos.current.y = lerp(pos.current.y, target.current.y, lerpFactor);

      if (ref.current) {
        const xPc = Math.min(100, (pos.current.x * 2 / window.innerWidth) * 100);
        const yPc = Math.min(100, (pos.current.y / window.innerHeight) * 100);
        const { r, g, b } = cursorColour(xPc, yPc);

        ref.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
        ref.current.style.background = `radial-gradient(circle, rgb(${r} ${g} ${b} / ${opacity * 100}%) 0%, transparent 70%)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [lerpFactor, opacity, size]);

  const half = size / 2;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 -z-10 hidden md:block"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `-${half}px`,
        marginTop: `-${half}px`,
        willChange: "transform",
        filter: `blur(${blur}px)`,
      }}
    />
  );
};
