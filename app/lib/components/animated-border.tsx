"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";
import { subscribeAttention } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

type AnimatedBorderProps = {
  children: ReactNode;
  /** Border width in pixels. Default: 1.5 */
  borderWidth?: number;
  /** Border radius in pixels. Default: 16 */
  borderRadius?: number;
  /** Additional class names for the outer wrapper */
  className?: string;
};

/**
 * A card whose border colour shifts based on cursor position.
 * Colour is derived from pastelColour() with sine/cosine wave layers,
 * matching the portfolio aesthetic. Includes a soft outer glow.
 *
 * @example
 * <AnimatedBorder>
 *   <h2>Hello</h2>
 *   <p>Content inside the glowing border</p>
 * </AnimatedBorder>
 */
export const AnimatedBorder = ({
  children,
  borderWidth = 1.5,
  borderRadius = 16,
  className = "",
}: AnimatedBorderProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    mouseX: 50,
    mouseY: 50,
    currentX: 50,
    currentY: 50,
    velX: 0,
    velY: 0,
    glow: 0,
    hovered: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const SPRING = 0.06;
    const DAMPING = 0.82;

    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none") {
        // Attention released (finger lifted, focus left): keep the colour where it was, drop the hover glow
        stateRef.current.hovered = false;
        return;
      }
      stateRef.current.mouseX = (x / window.innerWidth) * 100;
      stateRef.current.mouseY = (y / window.innerHeight) * 100;

      // Track if cursor is over this element
      const rect = el.getBoundingClientRect();
      stateRef.current.hovered =
        x >= rect.left && x <= rect.right &&
        y >= rect.top && y <= rect.bottom;
    });

    let raf: number;
    const tick = () => {
      const s = stateRef.current;
      const t = motionTime();
      const reduced = reducedMotionNow();

      // Spring physics for cursor tracking
      s.velX += (s.mouseX - s.currentX) * SPRING;
      s.velY += (s.mouseY - s.currentY) * SPRING;
      s.velX *= DAMPING;
      s.velY *= DAMPING;
      s.currentX += s.velX;
      s.currentY += s.velY;
      if (reduced) {
        s.currentX = s.mouseX;
        s.currentY = s.mouseY;
        s.velX = 0;
        s.velY = 0;
      }

      // Glow eases in on hover
      const targetGlow = s.hovered ? 1 : 0.3;
      s.glow += (targetGlow - s.glow) * 0.12;
      if (reduced) s.glow = targetGlow;

      // Cursor-position-mapped colour with sine/cosine wave layers
      const rPc = Math.max(0, Math.min(100, s.currentX + Math.sin(t * 1.1) * 28));
      const gPc = Math.max(0, Math.min(100, s.currentY + Math.cos(t * 0.7) * 22));
      const { r, g, b } = pastelColour(rPc, gPc, t);

      // Border colour — always visible, brighter on hover
      const borderAlpha = 0.4 + s.glow * 0.4;
      el.style.borderColor = `rgb(${r} ${g} ${b} / ${borderAlpha.toFixed(2)})`;

      // Outer glow
      el.style.boxShadow = s.glow > 0.05
        ? `0 0 ${20 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * 0.3}), 0 0 ${50 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * 0.1})`
        : "none";

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        borderRadius,
        border: `${borderWidth}px solid rgba(255,255,255,0.1)`,
        background: "#050505",
        willChange: "border-color, box-shadow",
      }}
    >
      {children}
    </div>
  );
};
