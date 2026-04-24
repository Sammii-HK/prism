"use client";
import { useRef, useEffect, useCallback } from "react";
import { pastelColour } from "../primitives/gradient";

export interface GlowCheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Called when the user clicks the checkbox */
  onChange: (checked: boolean) => void;
  /** Label text rendered beside the checkbox */
  label?: string;
  /** Disables the checkbox and suppresses all glow and spring motion */
  disabled?: boolean;
  /** Additional class names applied to the outermost wrapper */
  className?: string;
}

/**
 * Checkbox with spring-physics checkmark overshoot and a cursor-reactive
 * pastel border glow. When checked the box fills with pastel colour and
 * a white SVG tick springs in with scale overshoot.
 *
 * @example
 * <GlowCheckbox checked={on} onChange={setOn} label="Remember me" />
 * <GlowCheckbox checked={false} onChange={() => {}} disabled label="Locked" />
 */
export const GlowCheckbox = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: GlowCheckboxProps) => {
  const boxRef = useRef<HTMLButtonElement>(null);
  const tickRef = useRef<SVGSVGElement>(null);

  // Live values — read inside rAF to avoid stale closures
  const live = useRef({
    checked: checked,
    disabled: disabled,
  });
  useEffect(() => {
    live.current = { checked, disabled };
  }, [checked, disabled]);

  // Spring physics state — mutable, never triggers re-render
  const sp = useRef({
    fill: checked ? 1 : 0,
    fillVel: 0,
    tickScale: checked ? 1 : 0,
    tickScaleVel: 0,
    glow: 0,
    glowVel: 0,
  });

  useEffect(() => {
    const el = boxRef.current;
    const tick = tickRef.current;
    if (!el || !tick) return;

    // Spring step — same signature as glow-input / spring-toggle
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

    const loop = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const s = sp.current;
      const { checked: on, disabled: dis } = live.current;

      // Spring targets
      const targetFill = on ? 1 : 0;
      const targetTickScale = on ? 1 : 0;
      const targetGlow = dis ? 0 : Math.min(proximity, 0.45);

      // Integrate springs
      const [fl, flv] = step(s.fill, s.fillVel, targetFill, 180, 22);
      const [ts, tsv] = step(s.tickScale, s.tickScaleVel, targetTickScale, 200, 22);
      const [gw, gwv] = step(s.glow, s.glowVel, targetGlow, 120, 18);

      s.fill = fl;
      s.fillVel = flv;
      s.tickScale = ts;
      s.tickScaleVel = tsv;
      s.glow = gw;
      s.glowVel = gwv;

      const fillClamped = Math.max(0, Math.min(1, fl));
      const tickClamped = Math.max(0, ts); // allow overshoot above 1
      const glowClamped = Math.max(0, Math.min(1, gw));
      const t = performance.now() / 1000;
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Box background — transparent when unchecked, pastel fill when checked
      const bgA = 0.35 * fillClamped;
      el.style.backgroundColor =
        fillClamped > 0.005
          ? `rgba(${r},${g},${b},${bgA.toFixed(3)})`
          : "transparent";

      // Box border glow — proximity-reactive, same system as glow-input
      if (glowClamped < 0.005 && fillClamped < 0.005) {
        el.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.15)";
      } else {
        const outerGlow = Math.max(0, (glowClamped - 0.45) / 0.55);
        // Extra bloom when checked
        const checkedBloom = fillClamped * 0.12;
        el.style.boxShadow = [
          `0 0 0 1px rgba(${r},${g},${b},${(Math.max(0.15, 0.85 * glowClamped + 0.5 * fillClamped)).toFixed(3)})`,
          `0 0 12px 2px rgba(${r},${g},${b},${(0.15 * outerGlow + checkedBloom).toFixed(3)})`,
          "0 0 0 1px rgba(255,255,255,0.04)",
        ].join(", ");
      }

      // Checkmark — spring scale with overshoot
      if (tickClamped < 0.005) {
        tick.style.opacity = "0";
        tick.style.transform = "scale(0)";
      } else {
        tick.style.opacity = Math.min(1, tickClamped * 2).toFixed(3);
        tick.style.transform = `scale(${tickClamped.toFixed(4)})`;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

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
    <label
      className={`inline-flex items-center gap-3 select-none${disabled ? " cursor-not-allowed" : " cursor-pointer"}${className ? ` ${className}` : ""}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <button
        ref={boxRef}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className="relative flex items-center justify-center rounded-md outline-none shrink-0"
        style={{
          width: 20,
          height: 20,
          backgroundColor: "transparent",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
          willChange: "box-shadow, background-color",
          transition: "none",
        }}
      >
        <svg
          ref={tickRef}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="pointer-events-none"
          style={{
            opacity: 0,
            transform: "scale(0)",
            willChange: "transform, opacity",
            transition: "none",
          }}
        >
          <path
            d="M2.5 6.5L5 9L9.5 3.5"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {label && (
        <span className="text-sm text-white/60">{label}</span>
      )}
    </label>
  );
};
