"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useSystemReducedMotion } from "./async-button";
import { pastelColour } from "../primitives/gradient";
import {
  dampingForRatio, dampingRatio, fieldStats, fieldTarget, gridFor, gridPoints, isAtRest, naturalFrequency,
  predictedOvershoot, probeMove, regimeOf, stepSpring,
  type Regime, type SpringParams, type Vec,
} from "../spring-field-core";

export * from "../spring-field-core";

export interface SpringFieldRelease {
  /** Wall-clock ms from the pointer leaving until every element was at rest. */
  settleMs: number;
  /** How far the most-displaced element swung past rest, as a percentage of its starting offset. */
  overshootPct: number;
  /** The closed-form prediction for a spring released from rest at this damping ratio, percent. */
  predictedPct: number;
  zeta: number;
}

export interface SpringFieldObservation {
  zeta: number;
  regime: Regime;
  stiffness: number;
  damping: number;
  naturalHz: number;
  total: number;
  displaced: number;
  maxOffset: number;
  running: boolean;
  release: SpringFieldRelease | null;
}

interface Settings {
  stiffness: number;
  zeta: number;
  radius: number;
  strength: number;
  mode: "repel" | "attract";
  reduced: boolean;
}

const MASS = 1;
const PROBE_STEP = 24;
const DEFAULT_HEIGHT = 320;

const PRESETS = [
  { zeta: 0.2, name: "Loose" },
  { zeta: 0.5, name: "Lively" },
  { zeta: 1, name: "Critical" },
  { zeta: 2.5, name: "Heavy" },
] as const;

const btn =
  "rounded-lg border px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const Slider = ({
  id, label, value, min, max, step, unit, onChange,
}: { id: string; label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (n: number) => void }) => (
  <div className="min-w-0">
    <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-xs text-white/70">
      <span>{label}</span>
      <span className="text-white/90" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        {value}
        {unit}
      </span>
    </label>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-2 block h-6 w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      style={{ accentColor: "rgb(190,170,255)" }}
    />
  </div>
);

export function SpringFieldPanel({
  embedded = false,
  forceReduced = false,
  onObserve,
  height = DEFAULT_HEIGHT,
}: {
  embedded?: boolean;
  forceReduced?: boolean;
  onObserve?: (o: SpringFieldObservation) => void;
  /** Height of the field in px. */
  height?: number;
}) {
  const HEIGHT = height;
  const heightRef = useRef(height);
  const uid = useId();
  const systemReduced = useSystemReducedMotion();
  const reduced = forceReduced || systemReduced;

  const [stiffness, setStiffness] = useState(220);
  const [zeta, setZeta] = useState(0.35);
  const [radius, setRadius] = useState(130);
  const [strength, setStrength] = useState(46);
  const [mode, setMode] = useState<"repel" | "attract">("repel");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<Settings>({ stiffness, zeta, radius, strength, mode, reduced });
  const kickRef = useRef<() => void>(() => {});
  const onObserveRef = useRef(onObserve);
  const [readout, setReadout] = useState<SpringFieldObservation | null>(null);

  useEffect(() => {
    onObserveRef.current = onObserve;
    heightRef.current = height;
  }, [onObserve, height]);

  // Push settings to the engine, then wake it so a settled field reacts to the change.
  useEffect(() => {
    settingsRef.current = { stiffness, zeta, radius, strength, mode, reduced };
    kickRef.current();
  }, [stiffness, zeta, radius, strength, mode, reduced]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let rest: Vec[] = [];
    let ox = new Float32Array(0);
    let oy = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let pointer: Vec | null = null;
    let raf = 0;
    let last = 0;
    let lastEmit = 0;
    let release: { idx: number; ux: number; uy: number; m0: number; t0: number; minS: number; zeta: number } | null = null;
    let lastRelease: SpringFieldRelease | null = null;

    const paramsOf = (): SpringParams => {
      const s = settingsRef.current;
      return { stiffness: s.stiffness, mass: MASS, damping: dampingForRatio(s.zeta, s.stiffness, MASS) };
    };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = wrap.clientWidth;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.round(heightRef.current * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${heightRef.current}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gap = width < 480 ? 22 : 28;
      const spec = gridFor(width, heightRef.current, gap);
      const mx = (width - spec.cols * gap) / 2;
      const my = (heightRef.current - spec.rows * gap) / 2;
      rest = gridPoints(spec).map((p) => ({ x: p.x + mx, y: p.y + my }));
      ox = new Float32Array(rest.length);
      oy = new Float32Array(rest.length);
      vx = new Float32Array(rest.length);
      vy = new Float32Array(rest.length);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, heightRef.current);
      const s = settingsRef.current;
      for (let i = 0; i < rest.length; i++) {
        const m = Math.hypot(ox[i], oy[i]);
        const k = Math.min(1, m / Math.max(1, s.strength));
        const c = pastelColour((rest[i].x / width) * 100, (rest[i].y / heightRef.current) * 100, 0);
        const x = rest[i].x + ox[i];
        const y = rest[i].y + oy[i];
        if (m > 1) {
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.12 + 0.3 * k})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rest[i].x, rest[i].y);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.beginPath();
          ctx.arc(rest[i].x, rest[i].y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.55 + 0.45 * k})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.1 + 2.6 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      if (pointer) {
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const emit = (now: number, running: boolean, force = false) => {
      if (!force && now - lastEmit < 120) return;
      lastEmit = now;
      const offsets: Vec[] = [];
      for (let i = 0; i < rest.length; i++) offsets.push({ x: ox[i], y: oy[i] });
      const st = fieldStats(offsets);
      const p = paramsOf();
      const z = dampingRatio(p);
      const o: SpringFieldObservation = {
        zeta: z,
        regime: regimeOf(z),
        stiffness: p.stiffness,
        damping: p.damping,
        naturalHz: naturalFrequency(p) / (2 * Math.PI),
        total: rest.length,
        displaced: st.displaced,
        maxOffset: st.maxOffset,
        running,
        release: lastRelease,
      };
      setReadout(o);
      onObserveRef.current?.(o);
    };

    const startRelease = () => {
      let idx = -1;
      let best = 0;
      for (let i = 0; i < rest.length; i++) {
        const m = Math.hypot(ox[i], oy[i]);
        if (m > best) {
          best = m;
          idx = i;
        }
      }
      release =
        idx >= 0 && best >= 4 && !settingsRef.current.reduced
          ? { idx, ux: ox[idx] / best, uy: oy[idx] / best, m0: best, t0: performance.now(), minS: 1, zeta: settingsRef.current.zeta }
          : null;
    };

    const frame = (now: number) => {
      raf = 0;
      const s = settingsRef.current;
      const p = paramsOf();
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let allRest = true;
      for (let i = 0; i < rest.length; i++) {
        const t = fieldTarget(rest[i], pointer, s.radius, s.strength, s.mode);
        if (s.reduced) {
          ox[i] = t.x;
          oy[i] = t.y;
          vx[i] = 0;
          vy[i] = 0;
          continue;
        }
        const sx = stepSpring({ x: ox[i], v: vx[i] }, t.x, p, dt);
        const sy = stepSpring({ x: oy[i], v: vy[i] }, t.y, p, dt);
        ox[i] = sx.x;
        vx[i] = sx.v;
        oy[i] = sy.x;
        vy[i] = sy.v;
        if (!isAtRest(sx, t.x) || !isAtRest(sy, t.y)) allRest = false;
      }
      if (release && pointer === null) {
        const sProj = (ox[release.idx] * release.ux + oy[release.idx] * release.uy) / release.m0;
        if (sProj < release.minS) release.minS = sProj;
      }
      draw();
      const settled = allRest && pointer === null;
      if (release && pointer === null && allRest) {
        lastRelease = {
          settleMs: now - release.t0,
          overshootPct: Math.max(0, -release.minS) * 100,
          predictedPct: predictedOvershoot(release.zeta) * 100,
          zeta: release.zeta,
        };
        release = null;
        emit(now, false, true);
      } else {
        emit(now, !settled && !(s.reduced && pointer === null), settled);
      }
      if (!settled && !(s.reduced && pointer === null)) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    kickRef.current = kick;

    const setPointer = (p: Vec | null) => {
      if (p === null && pointer !== null) startRelease();
      if (p !== null) release = null;
      pointer = p;
      kick();
    };

    const local = (e: PointerEvent): Vec => {
      const r = wrap.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => setPointer(local(e));
    const onLeave = () => {
      if (document.activeElement !== wrap) setPointer(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPointer(null);
        return;
      }
      const from = pointer ?? { x: width / 2, y: heightRef.current / 2 };
      const next = probeMove(from, e.key, PROBE_STEP, width, heightRef.current);
      if (!next) return;
      e.preventDefault();
      setPointer(next);
    };
    const onFocus = () => {
      if (!pointer) setPointer({ x: width / 2, y: heightRef.current / 2 });
    };
    const onBlur = () => setPointer(null);

    build();
    draw();
    emit(performance.now(), false, true);
    const ro = new ResizeObserver(() => {
      build();
      draw();
      emit(performance.now(), false, true);
    });
    ro.observe(wrap);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("keydown", onKey);
    wrap.addEventListener("focus", onFocus);
    wrap.addEventListener("blur", onBlur);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      kickRef.current = () => {};
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("keydown", onKey);
      wrap.removeEventListener("focus", onFocus);
      wrap.removeEventListener("blur", onBlur);
    };
  }, []);

  const damping = dampingForRatio(zeta, stiffness, MASS);
  const r = readout;

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6">
      {!embedded && <p className="text-xs uppercase tracking-widest text-white/25">spring-field</p>}
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-label="Spring field. Move the pointer over it, or focus it and use the arrow keys to move a probe. Escape lets go."
        data-testid="spring-field"
        className="relative w-full min-w-0 cursor-crosshair overflow-hidden rounded-xl border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ height: HEIGHT, borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", touchAction: "pan-y" }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="block" />
      </div>

      <p className="font-mono text-[12.5px] leading-relaxed text-white/80" data-testid="spring-readout" aria-live="off">
        {r
          ? `damping ratio ${r.zeta.toFixed(2)} (${r.regime}) · ${r.displaced} of ${r.total} dots displaced · largest offset ${r.maxOffset.toFixed(1)} px`
          : "starting"}
      </p>

      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Slider id={`${uid}-k`} label="Stiffness k" value={stiffness} min={40} max={800} step={10} onChange={setStiffness} />
        <Slider id={`${uid}-z`} label="Damping ratio ζ" value={zeta} min={0.1} max={3} step={0.05} onChange={(n) => setZeta(Math.round(n * 100) / 100)} />
        <Slider id={`${uid}-r`} label="Field radius" value={radius} min={60} max={220} step={5} unit=" px" onChange={setRadius} />
        <Slider id={`${uid}-s`} label="Field strength" value={strength} min={10} max={80} step={2} unit=" px" onChange={setStrength} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="Damping presets" className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.zeta}
              type="button"
              className={btn}
              aria-pressed={zeta === p.zeta}
              onClick={() => setZeta(p.zeta)}
              style={{
                borderColor: zeta === p.zeta ? "rgba(190,170,255,0.8)" : "rgba(255,255,255,0.24)",
                background: zeta === p.zeta ? "rgba(190,170,255,0.18)" : "rgba(255,255,255,0.06)",
              }}
            >
              {p.name} · ζ {p.zeta}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Field mode" className="flex gap-2">
          {(["repel", "attract"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={btn}
              onClick={() => setMode(m)}
              style={{
                borderColor: mode === m ? "rgba(190,170,255,0.8)" : "rgba(255,255,255,0.24)",
                background: mode === m ? "rgba(190,170,255,0.18)" : "rgba(255,255,255,0.06)",
              }}
            >
              {m === "repel" ? "Repel" : "Attract"}
            </button>
          ))}
        </div>
      </div>
      <p className="max-w-xl text-xs leading-relaxed text-white/60">
        Damping coefficient c = {damping.toFixed(1)} for k = {stiffness}, m = {MASS}. Every dot is its own spring.
        {reduced ? " Reduced motion is on: dots move straight to their target with no spring." : ""}
      </p>
    </div>
  );
}
