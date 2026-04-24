"use client";
import { useRef, useEffect, useState } from "react";
import { pastelColour } from "../primitives/gradient";

export interface GlowTextareaProps {
  /** Floating label text that springs above the textarea on focus or when a value is present */
  label?: string;
  /** Controlled textarea value */
  value?: string;
  /** Change handler called on every keystroke */
  onChange?: (value: string) => void;
  /** Placeholder shown once the label has floated and the field is focused */
  placeholder?: string;
  /** Error message — locks glow to soft coral pastel and renders message below the textarea */
  error?: string;
  /** Disables the textarea and suppresses all glow and spring motion */
  disabled?: boolean;
  /** Number of visible text rows */
  rows?: number;
  /** Additional class names applied to the outermost wrapper div */
  className?: string;
}

/**
 * Multiline textarea with a floating label that springs on focus and a
 * cursor-mapped pastel border glow. Visually identical to GlowInput but
 * with a resizable textarea element.
 *
 * @example
 * <GlowTextarea label="Bio" rows={4} value={bio} onChange={setBio} />
 * <GlowTextarea label="Notes" disabled rows={3} />
 */
export const GlowTextarea = ({
  label = "Label",
  value = "",
  onChange,
  placeholder = "",
  error,
  disabled = false,
  rows = 4,
  className = "",
}: GlowTextareaProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);

  // Live values snapshot — read inside rAF to avoid stale closures
  const live = useRef({
    isFocused: false,
    value: "",
    disabled: false,
    error: undefined as string | undefined,
  });
  useEffect(() => {
    live.current = { isFocused, value, disabled, error };
  }, [isFocused, value, disabled, error]);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Spring physics state — all mutable, never triggers re-render
  const isFilled = value.length > 0;
  const startsFloated = isFilled || isFocused;

  const sp = useRef({
    labelY: startsFloated ? -24 : 0,
    labelYVel: 0,
    labelScale: startsFloated ? 0.75 : 1,
    labelScaleVel: 0,
    glow: 0,
    glowVel: 0,
  });

  useEffect(() => {
    // Physics spring step: position–velocity pair given stiffness k and damping d
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

    // Smooth cursor position — tracked inside the loop for zero re-renders
    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;
    let proximity = 0; // 0–1, how close cursor is to the textarea

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;

      // Calculate proximity to this textarea for hover glow
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(0, Math.abs(e.clientX - cx) - rect.width / 2);
        const dy = Math.max(0, Math.abs(e.clientY - cy) - rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = 120; // px — glow starts fading in from this distance
        proximity = Math.max(0, 1 - dist / range);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      // Lerp cursor (0.08 — perceptibly smooth, not laggy)
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const s = sp.current;
      const { isFocused: focused, value: val, disabled: dis, error: err } = live.current;
      const filled = val.length > 0;
      const floated = focused || filled;

      // Spring targets
      const targetLabelY = floated ? -24 : 0;
      const targetLabelScale = floated ? 0.75 : 1;
      // Proximity gives cursor-reactive border colour, focus adds outer glow
      const targetGlow = dis ? 0 : focused || Boolean(err) ? 1 : Math.min(proximity, 0.45);

      // Integrate springs
      const [ly, lyv] = step(s.labelY, s.labelYVel, targetLabelY, 180, 22);
      const [ls, lsv] = step(s.labelScale, s.labelScaleVel, targetLabelScale, 180, 22);
      const [gw, gwv] = step(s.glow, s.glowVel, targetGlow, 120, 18);

      s.labelY = ly;
      s.labelYVel = lyv;
      s.labelScale = ls;
      s.labelScaleVel = lsv;
      s.glow = gw;
      s.glowVel = gwv;

      const glowClamped = Math.max(0, Math.min(1, gw));
      const t = performance.now() / 1000;

      // Colour source: coral for error, pastel cursor-mapped otherwise
      let r: number, g: number, b: number;
      if (err) {
        r = 255;
        g = 155;
        b = 145;
      } else {
        ({ r, g, b } = pastelColour(smoothX, smoothY, t));
      }

      // Label — lerp colour from white/35 at rest toward pastel when floated
      if (labelRef.current) {
        labelRef.current.style.transform = `translateY(${ly}px) scale(${ls})`;
        if (floated) {
          const lr = Math.round(255 + (r - 255) * glowClamped);
          const lg = Math.round(255 + (g - 255) * glowClamped);
          const lb = Math.round(255 + (b - 255) * glowClamped);
          labelRef.current.style.color = `rgba(${lr},${lg},${lb},0.9)`;
        } else {
          labelRef.current.style.color = "rgba(255,255,255,0.35)";
        }
      }

      // Textarea — border colour from proximity, outer glow only on focus
      if (textareaRef.current) {
        if (glowClamped < 0.005) {
          textareaRef.current.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.1)";
        } else {
          const g0 = glowClamped;
          // Outer glow only kicks in above the proximity ceiling (0.45)
          const outerGlow = Math.max(0, (g0 - 0.45) / 0.55);
          textareaRef.current.style.boxShadow = [
            `0 0 0 1px rgba(${r},${g},${b},${(0.85 * g0).toFixed(3)})`,
            `0 0 16px 3px rgba(${r},${g},${b},${(0.18 * outerGlow).toFixed(3)})`,
            "0 0 0 1px rgba(255,255,255,0.04)",
          ].join(", ");
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative${className ? ` ${className}` : ""}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        rows={rows}
        placeholder={isFocused ? placeholder : ""}
        className="w-full bg-transparent border border-white/[0.15] rounded-xl px-4 pt-7 pb-3 text-white text-sm outline-none resize-y disabled:cursor-not-allowed"
        style={{
          transition: "none",
          willChange: "box-shadow",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
        }}
      />
      <label
        ref={labelRef}
        className="absolute left-4 top-5 pointer-events-none text-sm inline-block will-change-transform origin-top-left"
        style={{
          color: "rgba(255,255,255,0.35)",
          transform: `translateY(${startsFloated ? -24 : 0}px) scale(${startsFloated ? 0.75 : 1})`,
        }}
      >
        {label}
      </label>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "rgb(255,155,145)" }}>
          {error}
        </p>
      )}
    </div>
  );
};
