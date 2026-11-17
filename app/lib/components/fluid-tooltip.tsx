"use client";
import {
  useRef,
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { pastelColour } from "../primitives/gradient";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

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
  // Keyboard users get the tooltip on focus; Escape dismisses it until the
  // next hover or focus (WCAG 1.4.13).
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;
  const tooltipId = useId();

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
      setDismissed(false);
      setHovered(true);
    };

    const onLeave = () => {
      setHovered(false);
    };

    const onFocusIn = (e: FocusEvent) => {
      const s = stateRef.current;
      // No cursor to follow: anchor below the focused element's left edge
      if (!hovered && e.target instanceof Element) {
        const rect = e.target.getBoundingClientRect();
        s.x = rect.left;
        s.y = rect.bottom;
        s.targetX = rect.left;
        s.targetY = rect.bottom;
      }
      s.active = true;
      setDismissed(false);
      setFocused(true);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && wrapper.contains(e.relatedTarget)) return;
      setFocused(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setDismissed(true);
    };

    wrapper.addEventListener("pointerenter", onEnter, { passive: true });
    wrapper.addEventListener("pointerleave", onLeave, { passive: true });
    wrapper.addEventListener("pointermove", onMove, { passive: true });
    wrapper.addEventListener("focusin", onFocusIn);
    wrapper.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);

    // Spring constants
    const k = 200;
    const d = 24;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - lastTime) / 1000, 0.032); // Cap at ~30fps min
      lastTime = now;

      const reduced = reducedMotionNow();

      // Lerp position toward cursor
      s.x += (s.targetX - s.x) * 0.08;
      s.y += (s.targetY - s.y) * 0.08;
      if (reduced) {
        s.x = s.targetX;
        s.y = s.targetY;
      }

      // Spring physics for opacity and scale
      const targetOpacity = open ? 1 : 0;
      const targetScale = open ? 1 : 0.95;

      const opacityForce = k * (targetOpacity - s.opacity) - d * s.opacityVel;
      s.opacityVel += opacityForce * dt;
      s.opacity += s.opacityVel * dt;
      s.opacity = Math.max(0, Math.min(1, s.opacity));

      const scaleForce = k * (targetScale - s.scale) - d * s.scaleVel;
      s.scaleVel += scaleForce * dt;
      s.scale += s.scaleVel * dt;
      if (reduced) {
        // Fade only: no scale spring
        s.scale = 1;
        s.scaleVel = 0;
      }

      // Apply to DOM
      const xPc = (s.x / window.innerWidth) * 100;
      const yPc = (s.y / window.innerHeight) * 100;
      const t = motionTime();
      const { r, g, b } = pastelColour(xPc, yPc, t);

      tooltip.style.left = `${s.x + offset}px`;
      tooltip.style.top = `${s.y + offset}px`;
      tooltip.style.opacity = `${s.opacity}`;
      tooltip.style.transform = `scale(${s.scale})`;
      tooltip.style.borderColor = `rgb(${r} ${g} ${b} / 0.3)`;

      // Stop rAF when fully faded out and not hovered
      if (!open && s.opacity < 0.005) {
        s.active = false;
        s.opacity = 0;
        tooltip.style.opacity = "0";
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    // Always run when hovered, keep running until fade-out completes
    if (open || stateRef.current.active) {
      stateRef.current.active = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    }

    return () => {
      wrapper.removeEventListener("pointerenter", onEnter);
      wrapper.removeEventListener("pointerleave", onLeave);
      wrapper.removeEventListener("pointermove", onMove);
      wrapper.removeEventListener("focusin", onFocusIn);
      wrapper.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open, hovered, offset]);

  // aria-describedby has to sit on the focusable trigger, not the wrapper
  const trigger = isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": [children.props["aria-describedby"], tooltipId].filter(Boolean).join(" "),
      })
    : children;

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-block ${className}`}
      aria-describedby={isValidElement(children) ? undefined : tooltipId}
      {...rest}
    >
      {trigger}
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
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
