"use client";
import { useRef, useEffect, useCallback } from "react";
import { pastelColour } from "../primitives/gradient";

export interface SpringToggleProps {
  /** Whether the toggle is on */
  checked: boolean;
  /** Called when the user clicks the toggle */
  onChange: (checked: boolean) => void;
  /** Disables the toggle and suppresses all glow and spring motion */
  disabled?: boolean;
  /** Additional class names applied to the outermost wrapper */
  className?: string;
}

/**
 * Toggle switch with spring-physics overshoot on the thumb and a
 * cursor-reactive pastel border glow. The track fills with pastel colour
 * when on, and the thumb springs between positions with 2-3px overshoot.
 *
 * @example
 * <SpringToggle checked={on} onChange={setOn} />
 * <SpringToggle checked={false} onChange={() => {}} disabled />
 */
export const SpringToggle = ({
  checked,
  onChange,
  disabled = false,
  className = "",
}: SpringToggleProps) => {
  const trackRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Track dimensions: 52px wide, 28px tall. Thumb is 20px.
  // Left position: 4px, right position: 28px (52 - 20 - 4)
  const THUMB_LEFT = 4;
  const THUMB_RIGHT = 28;

  // Live values — read inside rAF
  const live = useRef({
    checked: checked,
    disabled: disabled,
  });
  useEffect(() => {
    live.current = { checked, disabled };
  }, [checked, disabled]);

  // Spring physics state — mutable, never triggers re-render
  const sp = useRef({
    thumbX: checked ? THUMB_RIGHT : THUMB_LEFT,
    thumbXVel: 0,
    trackFill: checked ? 1 : 0,
    trackFillVel: 0,
    glow: 0,
    glowVel: 0,
  });

  useEffect(() => {
    const el = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    // Spring step — same signature as glow-input
    const step = (
      pos: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = k * (target - pos) - d * vel;
      const newVel = vel + acc / 60;
      return [pos + newVel / 60, newVel];
    };

    // Smooth cursor position
    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;
    let proximity = 0;

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;

      // Proximity to this toggle for hover glow
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(0, Math.abs(e.clientX - cx) - rect.width / 2);
        const dy = Math.max(0, Math.abs(e.clientY - cy) - rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = 120;
        proximity = Math.max(0, 1 - dist / range);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const s = sp.current;
      const { checked: on, disabled: dis } = live.current;

      // Spring targets
      const targetThumbX = on ? THUMB_RIGHT : THUMB_LEFT;
      const targetTrackFill = on ? 1 : 0;
      const targetGlow = dis ? 0 : Math.min(proximity, 0.45);

      // Integrate springs — k=180, d=22 for thumb and fill (matches glow-input)
      const [tx, txv] = step(s.thumbX, s.thumbXVel, targetThumbX, 180, 22);
      const [tf, tfv] = step(s.trackFill, s.trackFillVel, targetTrackFill, 180, 22);
      const [gw, gwv] = step(s.glow, s.glowVel, targetGlow, 120, 18);

      s.thumbX = tx;
      s.thumbXVel = txv;
      s.trackFill = tf;
      s.trackFillVel = tfv;
      s.glow = gw;
      s.glowVel = gwv;

      const glowClamped = Math.max(0, Math.min(1, gw));
      const fillClamped = Math.max(0, Math.min(1, tf));
      const t = performance.now() / 1000;
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Track background — lerp between off (white/6%) and pastel fill
      const offR = 255, offG = 255, offB = 255;
      const offA = 0.06;
      // When filled, use pastel at ~35% opacity
      const fillA = 0.35;
      const bgR = Math.round(offR + (r - offR) * fillClamped);
      const bgG = Math.round(offG + (g - offG) * fillClamped);
      const bgB = Math.round(offB + (b - offB) * fillClamped);
      const bgA = offA + (fillA - offA) * fillClamped;

      el.style.backgroundColor = `rgba(${bgR},${bgG},${bgB},${bgA})`;

      // Track border glow — proximity-reactive, same system as glow-input
      if (glowClamped < 0.005) {
        el.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.08)`;
      } else {
        const outerGlow = Math.max(0, (glowClamped - 0.45) / 0.55);
        el.style.boxShadow = [
          `0 0 0 1px rgba(${r},${g},${b},${(0.85 * glowClamped).toFixed(3)})`,
          `0 0 12px 2px rgba(${r},${g},${b},${(0.15 * outerGlow).toFixed(3)})`,
          `0 0 0 1px rgba(255,255,255,0.04)`,
        ].join(", ");
      }

      // Thumb position
      thumb.style.transform = `translateX(${tx}px)`;

      // Thumb glow — subtle pastel shadow when on
      if (fillClamped > 0.1) {
        thumb.style.boxShadow = `0 0 ${6 * fillClamped}px rgba(${r},${g},${b},${(0.4 * fillClamped).toFixed(3)})`;
      } else {
        thumb.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onChange(!checked);
  }, [checked, onChange, disabled]);

  return (
    <button
      ref={trackRef}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`relative inline-flex items-center rounded-full cursor-pointer outline-none disabled:cursor-not-allowed${className ? ` ${className}` : ""}`}
      style={{
        width: 52,
        height: 28,
        opacity: disabled ? 0.4 : 1,
        backgroundColor: "rgba(255,255,255,0.06)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
        willChange: "box-shadow, background-color",
        transition: "none",
      }}
    >
      <div
        ref={thumbRef}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 20,
          height: 20,
          top: 4,
          left: 0,
          backgroundColor: "#ffffff",
          transform: `translateX(${checked ? THUMB_RIGHT : THUMB_LEFT}px)`,
          willChange: "transform, box-shadow",
          transition: "none",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
};
