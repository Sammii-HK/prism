"use client";
import { useEffect, useId, useRef, useState } from "react";
import { reducedMotionNow } from "../../lib/hooks/reduced-motion";
import { rgb, type RGB } from "./music";

type KnobProps = {
  label: string;
  /** Normalised value, 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  /** What a screen reader hears and the readout shows, e.g. "1.20 kHz". */
  valueText: string;
  /** Arc colour. */
  tint: RGB;
  /** Double-click resets here. */
  defaultValue?: number;
  size?: number;
};

const SWEEP = 135; // degrees either side of top
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const point = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
};

/**
 * A rotary control Prism doesn't ship: drag up or right to turn it, arrows
 * and Page keys from the keyboard. The pointer and arc spring to the value,
 * so a preset change visibly sweeps the knob instead of teleporting it.
 */
export const Knob = ({ label, value, onChange, valueText, tint, defaultValue, size = 64 }: KnobProps) => {
  const labelId = useId();
  const pointerRef = useRef<SVGGElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const spring = useRef({ pos: value, vel: 0, target: value, raf: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: number } | null>(null);
  // The spring owns the drawn position after mount; React only sets the first frame.
  const [initial] = useState(value);

  const c = 32;
  const r = 24;
  const arc = `M ${point(c, c, r, -SWEEP)} A ${r} ${r} 0 1 1 ${point(c, c, r, SWEEP)}`;

  // Spring the drawn position toward the value.
  useEffect(() => {
    const s = spring.current;
    s.target = value;

    const paint = () => {
      pointerRef.current?.setAttribute("transform", `rotate(${(-SWEEP + s.pos * SWEEP * 2).toFixed(2)} ${c} ${c})`);
      arcRef.current?.setAttribute("stroke-dasharray", `${Math.max(0.0001, s.pos).toFixed(4)} 2`);
    };

    const tick = () => {
      if (reducedMotionNow()) {
        s.pos = s.target;
        s.vel = 0;
      } else {
        s.vel += (s.target - s.pos) * 0.18;
        s.vel *= 0.62;
        s.pos += s.vel;
      }
      paint();
      if (Math.abs(s.target - s.pos) > 0.0005 || Math.abs(s.vel) > 0.0005) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.pos = s.target;
        paint();
        s.raf = 0;
      }
    };

    if (!s.raf) s.raf = requestAnimationFrame(tick);
  }, [value]);

  useEffect(() => {
    const s = spring.current;
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: value };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // Up and right both turn it up; shift for fine control.
    const travel = e.clientX - d.x + (d.y - e.clientY);
    onChange(clamp01(d.start + travel / (e.shiftKey ? 720 : 200)));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = value + step;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = value - step;
    else if (e.key === "PageUp") next = value + 0.1;
    else if (e.key === "PageDown") next = value - 0.1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp01(next));
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText}
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        className="relative cursor-ns-resize touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
          <defs>
            <radialGradient id={`${labelId}-cap`} cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </radialGradient>
          </defs>
          <path d={arc} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} strokeLinecap="round" />
          <path
            ref={arcRef}
            d={arc}
            fill="none"
            stroke={rgb(tint, 0.9)}
            strokeWidth={3}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${Math.max(0.0001, initial)} 2`}
            style={{ filter: `drop-shadow(0 0 4px ${rgb(tint, 0.45)})` }}
          />
          <circle cx={c} cy={c} r={17} fill={`url(#${labelId}-cap)`} stroke="rgba(255,255,255,0.1)" />
          <g ref={pointerRef} transform={`rotate(${-SWEEP + initial * SWEEP * 2} ${c} ${c})`}>
            <line x1={c} y1={c - 15} x2={c} y2={c - 8} stroke="rgba(255,255,255,0.85)" strokeWidth={2} strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <div className="text-center">
        <p id={labelId} className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
          {label}
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-white/75" aria-hidden="true">
          {valueText}
        </p>
      </div>
    </div>
  );
};
