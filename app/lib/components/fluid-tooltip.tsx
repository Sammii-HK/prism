"use client";
import {
  useRef,
  useEffect,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { pastelColour } from "../primitives/gradient";

type FluidTooltipProps = HTMLAttributes<HTMLDivElement> & {
  /** Content rendered inside the tooltip */
  content: ReactNode;
  /** The element that triggers the tooltip on hover */
  children: ReactNode;
  /** Distance from cursor in pixels. Default: 12 */
  offset?: number;
  /** Additional class name for the wrapper */
  className?: string;
};

/**
 * Tooltip that magnetically follows the cursor with lerp delay.
 * Border colour shifts with cursor position via pastelColour.
 * Springs in on hover with opacity + scale.
 *
 * @example
 * <FluidTooltip content="Save your progress">
 *   <button>Save</button>
 * </FluidTooltip>
 */
export const FluidTooltip = ({
  content,
  children,
  offset = 12,
  className = "",
  ...rest
}: FluidTooltipProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const stateRef = useRef({
    // Current lerped position
    x: 0,
    y: 0,
    // Target position (raw cursor)
    targetX: 0,
    targetY: 0,
    // Spring-driven appearance
    opacity: 0,
    scale: 0.95,
    opacityVel: 0,
    scaleVel: 0,
    // Whether we're visible at all (to skip rAF when idle)
    active: false,
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    let raf: number;

    const onMove = (e: PointerEvent) => {
      const s = stateRef.current;
      s.targetX = e.clientX;
      s.targetY = e.clientY;
    };

    const onEnter = (e: PointerEvent) => {
      const s = stateRef.current;
      // Snap position on first enter so it doesn't lerp from (0,0)
      s.x = e.clientX;
      s.y = e.clientY;
      s.targetX = e.clientX;
      s.targetY = e.clientY;
      s.active = true;
      setHovered(true);
    };

    const onLeave = () => {
      setHovered(false);
    };

    wrapper.addEventListener("pointerenter", onEnter, { passive: true });
    wrapper.addEventListener("pointerleave", onLeave, { passive: true });
    wrapper.addEventListener("pointermove", onMove, { passive: true });

    // Spring constants
    const k = 200;
    const d = 24;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - lastTime) / 1000, 0.032); // Cap at ~30fps min
      lastTime = now;

      // Lerp position toward cursor
      s.x += (s.targetX - s.x) * 0.08;
      s.y += (s.targetY - s.y) * 0.08;

      // Spring physics for opacity and scale
      const targetOpacity = hovered ? 1 : 0;
      const targetScale = hovered ? 1 : 0.95;

      const opacityForce = k * (targetOpacity - s.opacity) - d * s.opacityVel;
      s.opacityVel += opacityForce * dt;
      s.opacity += s.opacityVel * dt;
      s.opacity = Math.max(0, Math.min(1, s.opacity));

      const scaleForce = k * (targetScale - s.scale) - d * s.scaleVel;
      s.scaleVel += scaleForce * dt;
      s.scale += s.scaleVel * dt;

      // Apply to DOM
      const xPc = (s.x / window.innerWidth) * 100;
      const yPc = (s.y / window.innerHeight) * 100;
      const t = now / 1000;
      const { r, g, b } = pastelColour(xPc, yPc, t);

      tooltip.style.left = `${s.x + offset}px`;
      tooltip.style.top = `${s.y + offset}px`;
      tooltip.style.opacity = `${s.opacity}`;
      tooltip.style.transform = `scale(${s.scale})`;
      tooltip.style.borderColor = `rgb(${r} ${g} ${b} / 0.3)`;

      // Stop rAF when fully faded out and not hovered
      if (!hovered && s.opacity < 0.005) {
        s.active = false;
        s.opacity = 0;
        tooltip.style.opacity = "0";
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    // Always run when hovered, keep running until fade-out completes
    if (hovered || stateRef.current.active) {
      stateRef.current.active = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    }

    return () => {
      wrapper.removeEventListener("pointerenter", onEnter);
      wrapper.removeEventListener("pointerleave", onLeave);
      wrapper.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [hovered, offset]);

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`} {...rest}>
      {children}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none z-50 rounded-lg px-3 py-1.5 text-xs text-white/70 whitespace-nowrap"
        style={{
          opacity: 0,
          transform: "scale(0.95)",
          transformOrigin: "top left",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          willChange: "transform, opacity",
          backfaceVisibility: "hidden",
        }}
      >
        {content}
      </div>
    </div>
  );
};
