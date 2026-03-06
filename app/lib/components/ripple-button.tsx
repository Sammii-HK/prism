"use client";

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { usePointer } from "../hooks/use-pointer";
import { pastelColour } from "../primitives/gradient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RippleData = {
  id: number;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  /** Base pixel diameter of the ripple circle (before spring scale). */
  size: number;
};

type AnimatedRippleProps = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  size: number;
  scale: number;
  duration: number;
  onDone: () => void;
};

// ---------------------------------------------------------------------------
// AnimatedRipple — owns its own rAF loop, mutates DOM directly
// ---------------------------------------------------------------------------

function AnimatedRipple({
  x,
  y,
  r,
  g,
  b,
  size,
  scale,
  duration,
  onDone,
}: AnimatedRippleProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  // Keep onDone fresh without re-triggering the effect
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    let rafId: number;
    let cancelled = false;

    // Spring state
    let springPos = 0;
    let springVel = 0;
    const startTime = performance.now();
    let lastTime = startTime;

    const tick = (now: number) => {
      // Cap dt to prevent spiral-of-death on tab switch
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const elapsed = now - startTime;

      // Spring equation: stiffness 140, damping 14
      const force = (scale - springPos) * 140 - springVel * 14;
      springVel += force * dt;
      springPos += springVel * dt;

      // Linear opacity decay
      const opacity = Math.max(0, 0.6 * (1 - elapsed / duration));

      // Direct DOM mutation — no state, no React re-render
      el.style.transform = `translate(-50%, -50%) scale(${springPos})`;
      el.style.opacity = String(opacity);

      if (opacity <= 0.005) {
        cancelAnimationFrame(rafId);
        if (!cancelled) onDoneRef.current();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [scale, duration]);

  return (
    <span
      ref={spanRef}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        pointerEvents: "none",
        transformOrigin: "center",
        willChange: "transform, opacity",
        // Pastel bloom: soft core fading to transparent at 70%
        background: `radial-gradient(circle, rgba(${r},${g},${b},0.6) 0%, rgba(${r},${g},${b},0.25) 40%, transparent 70%)`,
        // Initial state — tick() overwrites from frame 1
        transform: "translate(-50%, -50%) scale(0)",
        opacity: "0.6",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// RippleButton — public component
// ---------------------------------------------------------------------------

export interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button label or any renderable content. */
  children: ReactNode;
  /** Time in ms for the ripple to fully decay to zero opacity. Default: 650 */
  rippleDuration?: number;
  /**
   * Final scale multiplier of the ripple circle relative to button dimensions.
   * Should exceed 2 to flood-fill the button. Default: 2.8
   */
  rippleScale?: number;
  /**
   * Maps ripple colour to cursor viewport position and time via
   * pastelColour(). Set false for a fixed neutral pastel. Default: true
   */
  usePointerColour?: boolean;
  /**
   * Enables the live cursor-reactive pastel box-shadow glow on hover.
   * Default: true
   */
  glowOnHover?: boolean;
}

/**
 * A button that blooms a pastel gradient ripple outward from each click point.
 * Ripple colour is derived from cursorColour() sampled at the exact moment of
 * click — so every tap is uniquely tinted by where the pointer sits in the
 * viewport. Multiple ripples coexist simultaneously. Spring physics throughout:
 * ripple scale overshoots before settling, nothing snaps.
 *
 * @example
 * <RippleButton onClick={handleSave}>Save changes</RippleButton>
 * <RippleButton rippleDuration={800} rippleScale={3.2}>Confirm</RippleButton>
 * <RippleButton usePointerColour={false} glowOnHover={false}>Static</RippleButton>
 */
export const RippleButton = ({
  children,
  rippleDuration = 650,
  rippleScale = 2.8,
  usePointerColour = true,
  glowOnHover = true,
  disabled = false,
  className = "",
  style: userStyle,
  onClick,
  ...rest
}: RippleButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);
  const [ripples, setRipples] = useState<RippleData[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Global pointer tracking — smoothed at lerp 0.08
  const { xPc, yPc, time } = usePointer({ lerp: 0.08 });

  // -------------------------------------------------------------------------
  // Click handler — spawn a ripple at the exact click coordinate
  // -------------------------------------------------------------------------
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const rect = buttonRef.current!.getBoundingClientRect();
    // Pixel offset relative to button top-left
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Base circle large enough to cover the button at scale 1
    const size = Math.max(rect.width, rect.height) * 2;

    // Sample colour from pastelColour — includes time variation so
    // sequential clicks from the same position still shift hue
    let r = 200, g = 200, b = 200;
    if (usePointerColour) {
      const vxPc = (e.clientX / window.innerWidth) * 100;
      const vyPc = (e.clientY / window.innerHeight) * 100;
      ({ r, g, b } = pastelColour(vxPc, vyPc, performance.now() / 1000));
    }

    setRipples(prev => [
      ...prev,
      { id: nextId.current++, x, y, r, g, b, size },
    ]);

    onClick?.(e);
  };

  const removeRipple = (id: number) => {
    setRipples(prev => prev.filter(rp => rp.id !== id));
  };

  // -------------------------------------------------------------------------
  // Hover glow — pastel box-shadow that shifts with viewport cursor position
  // -------------------------------------------------------------------------
  const { r: gr, g: gg, b: gb } = pastelColour(xPc, yPc, time);
  const boxShadow: CSSProperties["boxShadow"] =
    isHovered && glowOnHover && !disabled
      ? `0 0 18px 2px rgba(${gr},${gg},${gb},0.28), 0 0 0 1px rgba(${gr},${gg},${gb},0.12)`
      : "none";

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      style={{
        position: "relative",
        overflow: "hidden",
        boxShadow,
        ...userStyle,
      }}
      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-white/[0.04] border border-white/[0.08] cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {/* Text content sits above ripple layer via z-index */}
      <span style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        {children}
      </span>

      {ripples.map(rp => (
        <AnimatedRipple
          key={rp.id}
          x={rp.x}
          y={rp.y}
          r={rp.r}
          g={rp.g}
          b={rp.b}
          size={rp.size}
          scale={rippleScale}
          duration={rippleDuration}
          onDone={() => removeRipple(rp.id)}
        />
      ))}
    </button>
  );
};
