"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { curveLUT, type CurvePoint } from "./grade";
import { pastelColour } from "../../lib/primitives/gradient";

const MAX_POINTS = 7;
const SIZE = 256;

type Props = {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  histogram: Uint32Array | null;
};

const sortPoints = (p: CurvePoint[]) => [...p].sort((a, b) => a.x - b.x);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Tone curve editor, rebuilt from ScapeStudio's canvas version.
 *
 * Each control point is a focusable slider: arrow keys move it (Shift for ten
 * at a time), Delete removes it, and `+` adds a point in the widest gap.
 * Dragging uses pointer capture, so it works the same with a finger. Points
 * don't spring: on a precision control the value is exactly where you put it.
 */
export const CurvesEditor = ({ points, onChange, histogram }: Props) => {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const pointRefs = useRef<Array<SVGCircleElement | null>>([]);
  const sorted = useMemo(() => sortPoints(points), [points]);
  // The newest points, updated as soon as we emit a change, so a second key
  // press before React re-renders builds on the first instead of repeating it.
  const latest = useRef(sorted);
  useEffect(() => {
    latest.current = sorted;
  }, [sorted]);
  const emit = (next: CurvePoint[]) => {
    latest.current = next;
    onChange(next);
  };

  const curvePath = useMemo(() => {
    const lut = curveLUT(sorted);
    let d = "";
    for (let x = 0; x < 256; x++) d += `${x === 0 ? "M" : "L"}${x} ${255 - lut[x]}`;
    return d;
  }, [sorted]);

  const histogramPath = useMemo(() => {
    if (!histogram) return "";
    let max = 0;
    // Ignore the extreme bins so a clipped black or white doesn't flatten the rest.
    for (let i = 2; i < 254; i++) max = Math.max(max, histogram[i]);
    if (!max) return "";
    let d = "M0 256";
    for (let i = 0; i < 256; i++) d += `L${i} ${256 - Math.min(1, histogram[i] / max) * 200}`;
    return `${d}L255 256Z`;
  }, [histogram]);

  const toCurve = (clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.round(clamp(((clientX - rect.left) / rect.width) * 255, 0, 255)),
      y: Math.round(clamp((1 - (clientY - rect.top) / rect.height) * 255, 0, 255)),
    };
  };

  /** Move point `i` to `to`, keeping endpoints pinned to the edges and interior points between neighbours. */
  const moveTo = (i: number, to: CurvePoint) => {
    const next = [...latest.current];
    const last = next.length - 1;
    const x = i === 0 ? 0 : i === last ? 255 : clamp(to.x, next[i - 1].x + 1, next[i + 1].x - 1);
    next[i] = { x, y: clamp(to.y, 0, 255) };
    emit(next);
  };

  const addPoint = (at: CurvePoint) => {
    const cur = latest.current;
    if (cur.length >= MAX_POINTS) return null;
    if (cur.some((p) => Math.abs(p.x - at.x) < 3)) return null;
    const next = sortPoints([...cur, at]);
    emit(next);
    return next.findIndex((p) => p === at);
  };

  const removePoint = (i: number) => {
    const cur = latest.current;
    if (i === 0 || i === cur.length - 1) return;
    emit(cur.filter((_, j) => j !== i));
    // Keep focus in the editor: move to the neighbour on the left.
    requestAnimationFrame(() => pointRefs.current[i - 1]?.focus());
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const at = toCurve(e.clientX, e.clientY);
    // Hit-test existing points first, in screen pixels so it feels the same at any size.
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = rect.width / SIZE;
    let hit = -1;
    let best = 14;
    sorted.forEach((p, i) => {
      const d = Math.hypot((p.x - at.x) * scale, (255 - p.y - (255 - at.y)) * scale);
      if (d < best) {
        best = d;
        hit = i;
      }
    });
    const index = hit >= 0 ? hit : addPoint(at);
    if (index === null || index < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(index);
    pointRefs.current[index]?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    moveTo(dragging, toCurve(e.clientX, e.clientY));
  };

  const onPointerUp = () => setDragging(null);

  const onPointKey = (i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const p = latest.current[i];
    const moves: Record<string, CurvePoint> = {
      ArrowUp: { x: p.x, y: p.y + step },
      ArrowDown: { x: p.x, y: p.y - step },
      ArrowLeft: { x: p.x - step, y: p.y },
      ArrowRight: { x: p.x + step, y: p.y },
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveTo(i, moves[e.key]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removePoint(i);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      addInWidestGap();
    } else if (e.key === "Home") {
      e.preventDefault();
      pointRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      pointRefs.current[sorted.length - 1]?.focus();
    }
  };

  const addInWidestGap = () => {
    const sorted = latest.current;
    let gap = 0;
    let at = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = sorted[i + 1].x - sorted[i].x;
      if (g > gap) {
        gap = g;
        at = i;
      }
    }
    const x = Math.round((sorted[at].x + sorted[at + 1].x) / 2);
    const y = Math.round(curveLUT(sorted)[x]);
    const index = addPoint({ x, y });
    if (index !== null && index >= 0) requestAnimationFrame(() => pointRefs.current[index]?.focus());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060606]">
        <svg
          ref={svgRef}
          viewBox="-6 -6 268 268"
          className="h-full w-full touch-none select-none"
          style={{ cursor: dragging !== null ? "grabbing" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="group"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
        >
          {histogramPath && <path d={histogramPath} fill="rgba(255,255,255,0.07)" />}
          {[64, 128, 192].map((g) => (
            <g key={g} stroke="rgba(255,255,255,0.06)" strokeWidth="0.75">
              <line x1={g} y1="0" x2={g} y2="255" />
              <line x1="0" y1={g} x2="255" y2={g} />
            </g>
          ))}
          <line x1="0" y1="255" x2="255" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" strokeDasharray="3 4" />
          <path d={curvePath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinejoin="round" />
          {sorted.map((p, i) => {
            const c = pastelColour((p.x / 255) * 100, (1 - p.y / 255) * 100, 0);
            const active = dragging === i || focused === i;
            const edge = i === 0 || i === sorted.length - 1;
            return (
              <circle
                key={i}
                ref={(el) => {
                  pointRefs.current[i] = el;
                }}
                cx={p.x}
                cy={255 - p.y}
                r={active ? 7 : 5.5}
                fill={active ? `rgb(${c.r} ${c.g} ${c.b})` : "#f5f5f5"}
                stroke="#060606"
                strokeWidth="2"
                tabIndex={0}
                role="slider"
                aria-label={edge ? (i === 0 ? "Black point" : "White point") : `Curve point ${i}`}
                aria-valuemin={0}
                aria-valuemax={255}
                aria-valuenow={p.y}
                aria-valuetext={`input ${p.x}, output ${p.y}`}
                onKeyDown={onPointKey(i)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused((f) => (f === i ? null : f))}
                className="outline-none"
                style={{ filter: active ? `drop-shadow(0 0 6px rgb(${c.r} ${c.g} ${c.b}))` : undefined }}
              />
            );
          })}
        </svg>
        {focused !== null && sorted[focused] && (
          <span className="pointer-events-none absolute bottom-2.5 right-3 font-mono text-[11px] tabular-nums text-white/60">
            {sorted[focused].x} → {sorted[focused].y}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-label`} className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
          Tone curve
        </p>
        <button
          type="button"
          onClick={addInWidestGap}
          disabled={sorted.length >= MAX_POINTS}
          className="rounded-lg px-2 py-1 font-mono text-[11px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"
        >
          + Add point
        </button>
      </div>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-white/50">
        Drag to shape, or tab to a point and use the arrow keys (Shift for bigger steps). Delete removes a point.
      </p>
    </div>
  );
};
