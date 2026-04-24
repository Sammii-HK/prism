"use client";
import { useRef, useEffect, useCallback } from "react";
import { pastelColour } from "../primitives/gradient";

export interface GlowSliderProps {
  /** Current value */
  value: number;
  /** Called when the user drags or clicks to change value */
  onChange: (value: number) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Label displayed above the slider */
  label?: string;
  /** Whether to show the numeric value on the right */
  showValue?: boolean;
  /** Disables the slider and suppresses all glow and spring motion */
  disabled?: boolean;
  /** Additional class names applied to the outermost wrapper */
  className?: string;
}

/**
 * Range slider with spring-physics thumb bounce and cursor-reactive pastel
 * glow on the track border and fill. Drag handling uses pointer capture for
 * smooth cross-element tracking.
 *
 * @example
 * <GlowSlider label="Volume" value={vol} onChange={setVol} />
 * <GlowSlider label="Opacity" min={0} max={1} step={0.01} value={op} onChange={setOp} />
 */
export const GlowSlider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  disabled = false,
  className = "",
}: GlowSliderProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  // Live values — read inside rAF to avoid stale closures
  const live = useRef({
    value,
    min,
    max,
    step,
    disabled,
    dragging: false,
  });
  useEffect(() => {
    live.current.value = value;
    live.current.min = min;
    live.current.max = max;
    live.current.step = step;
    live.current.disabled = disabled;
  }, [value, min, max, step, disabled]);

  // Spring physics state — mutable, never triggers re-render
  const sp = useRef({
    thumbScale: 1,
    thumbScaleVel: 0,
    glow: 0,
    glowVel: 0,
    fillIntensity: 0,
    fillIntensityVel: 0,
  });

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Snap value to step
  const snap = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      if (step >= 1) return Math.round(clamped / step) * step;
      // Float-safe rounding
      const inv = 1 / step;
      return Math.round(clamped * inv) / inv;
    },
    [min, max, step]
  );

  // Convert pointer clientX to value
  const pointerToValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snap(min + ratio * (max - min));
    },
    [min, max, snap, value]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    const fill = fillRef.current;
    const thumb = thumbRef.current;
    if (!wrap || !track || !fill || !thumb) return;

    // Spring step
    const springStep = (
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

      if (wrap) {
        const rect = wrap.getBoundingClientRect();
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
      const { value: val, min: mn, max: mx, disabled: dis, dragging } = live.current;

      // Spring targets
      const targetThumbScale = dragging ? 1.18 : 1;
      const targetGlow = dis ? 0 : dragging ? 1 : Math.min(proximity, 0.45);
      const targetFillIntensity = dragging ? 1 : 0.65;

      // Integrate springs
      const [ts, tsv] = springStep(s.thumbScale, s.thumbScaleVel, targetThumbScale, 200, 22);
      const [gw, gwv] = springStep(s.glow, s.glowVel, targetGlow, 120, 18);
      const [fi, fiv] = springStep(s.fillIntensity, s.fillIntensityVel, targetFillIntensity, 120, 18);

      s.thumbScale = ts;
      s.thumbScaleVel = tsv;
      s.glow = gw;
      s.glowVel = gwv;
      s.fillIntensity = fi;
      s.fillIntensityVel = fiv;

      const glowClamped = Math.max(0, Math.min(1, gw));
      const fillInt = Math.max(0, Math.min(1, fi));
      const t = performance.now() / 1000;
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Fill ratio
      const ratio = mx > mn ? (val - mn) / (mx - mn) : 0;

      // Fill bar — pastel colour with intensity modulation
      const fillAlpha = 0.3 + 0.35 * fillInt;
      fill.style.width = `${ratio * 100}%`;
      fill.style.backgroundColor = `rgba(${r},${g},${b},${fillAlpha.toFixed(3)})`;

      // Track border glow
      if (glowClamped < 0.005) {
        track.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.08)";
      } else {
        const outerGlow = Math.max(0, (glowClamped - 0.45) / 0.55);
        track.style.boxShadow = [
          `0 0 0 1px rgba(${r},${g},${b},${(0.85 * glowClamped).toFixed(3)})`,
          `0 0 12px 2px rgba(${r},${g},${b},${(0.15 * outerGlow).toFixed(3)})`,
          "0 0 0 1px rgba(255,255,255,0.04)",
        ].join(", ");
      }

      // Thumb position and scale
      thumb.style.left = `${ratio * 100}%`;
      thumb.style.transform = `translate(-50%, -50%) scale(${ts.toFixed(4)})`;

      // Thumb glow — full bloom while dragging
      if (glowClamped > 0.1) {
        const bloom = dragging ? 10 : 6 * glowClamped;
        const bloomAlpha = dragging ? 0.5 : 0.3 * glowClamped;
        thumb.style.boxShadow = `0 0 ${bloom}px rgba(${r},${g},${b},${bloomAlpha.toFixed(3)})`;
      } else {
        thumb.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
      }

      // Label colour — tint toward pastel on proximity
      if (labelRef.current && glowClamped > 0.01) {
        const lr = Math.round(255 + (r - 255) * glowClamped * 0.3);
        const lg = Math.round(255 + (g - 255) * glowClamped * 0.3);
        const lb = Math.round(255 + (b - 255) * glowClamped * 0.3);
        labelRef.current.style.color = `rgba(${lr},${lg},${lb},0.5)`;
      } else if (labelRef.current) {
        labelRef.current.style.color = "rgba(255,255,255,0.5)";
      }

      // Value colour — subtle tint
      if (valueRef.current && glowClamped > 0.01) {
        const vr = Math.round(255 + (r - 255) * glowClamped * 0.2);
        const vg = Math.round(255 + (g - 255) * glowClamped * 0.2);
        const vb = Math.round(255 + (b - 255) * glowClamped * 0.2);
        valueRef.current.style.color = `rgba(${vr},${vg},${vb},0.4)`;
      } else if (valueRef.current) {
        valueRef.current.style.color = "rgba(255,255,255,0.4)";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Drag handling
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      live.current.dragging = true;

      // Trigger scale bounce on grab
      sp.current.thumbScaleVel = 8;

      const newVal = pointerToValue(e.clientX);
      onChangeRef.current(newVal);

      const onPointerMove = (ev: PointerEvent) => {
        const v = pointerToValue(ev.clientX);
        onChangeRef.current(v);
      };

      const onPointerUp = () => {
        live.current.dragging = false;
        // Release bounce
        sp.current.thumbScaleVel = -6;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [disabled, pointerToValue]
  );

  const fraction = max > min ? (value - min) / (max - min) : 0;

  // Format display value
  const displayValue = step < 1 ? value.toFixed(Math.max(0, -Math.floor(Math.log10(step)))) : String(value);

  return (
    <div
      ref={wrapRef}
      className={`relative${className ? ` ${className}` : ""}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {/* Header row: label + value */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span
              ref={labelRef}
              className="text-sm pointer-events-none select-none"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {label}
            </span>
          )}
          {showValue && (
            <span
              ref={valueRef}
              className="text-xs font-mono pointer-events-none select-none"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {displayValue}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative w-full rounded-full cursor-pointer"
        style={{
          height: 4,
          backgroundColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
          willChange: "box-shadow",
          transition: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {/* Fill */}
        <div
          ref={fillRef}
          className="absolute top-0 left-0 h-full rounded-full pointer-events-none"
          style={{
            width: `${fraction * 100}%`,
            willChange: "width, background-color",
            transition: "none",
          }}
        />

        {/* Thumb */}
        <div
          ref={thumbRef}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 18,
            height: 18,
            top: "50%",
            left: `${fraction * 100}%`,
            transform: "translate(-50%, -50%) scale(1)",
            backgroundColor: "#ffffff",
            willChange: "transform, box-shadow, left",
            transition: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </div>
  );
};
