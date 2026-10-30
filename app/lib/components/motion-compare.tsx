"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSystemReducedMotion } from "./async-button";

export type MotionApproach = "css" | "linear" | "spring";

export const MOTION_APPROACHES: { id: MotionApproach; title: string; how: string }[] = [
  { id: "css", title: "CSS transition", how: "transition: transform 700ms ease. The browser runs the curve." },
  { id: "linear", title: "Linear rAF tween", how: "requestAnimationFrame, position = distance x elapsed / 700 ms." },
  { id: "spring", title: "Spring physics", how: "Damped spring integrated each frame (the library's approach). No fixed duration." },
];

/** One reading of the dot, taken inside a requestAnimationFrame callback. */
export interface TraceSample {
  /** Milliseconds since the run's first frame. */
  t: number;
  /** Rendered distance travelled from the start, in px. */
  x: number;
}

export interface MotionMeasurement {
  /** requestAnimationFrame callbacks from the first frame until the dot settled on the target. */
  frames: number;
  /** Mean gap between those frames, ms. */
  avgFrameMs: number;
  /** Longest gap between those frames, ms. */
  worstFrameMs: number;
  /** Separate excursions past the target by more than the tolerance. */
  overshoots: number;
  /** Furthest distance past the target, px (0 if it never passed it). */
  peakOvershootPx: number;
  /** Time of the first frame after which the dot stayed on the target, ms. */
  settleMs: number;
}

/**
 * Pure: turn the raw samples of a run into the numbers the table shows.
 * "Settled" means every sample from that point on is within `tolerance` px of
 * the target. Returns null if the dot never settled (or there are no samples),
 * so the UI never has a number it did not measure.
 */
export const analyseTrace = (samples: TraceSample[], target: number, tolerance = 0.5): MotionMeasurement | null => {
  if (samples.length === 0) return null;
  let settledAt = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i].x - target) <= tolerance) settledAt = i;
    else break;
  }
  if (settledAt < 0) return null;
  const used = samples.slice(0, settledAt + 1);
  let worst = 0;
  let sum = 0;
  for (let i = 1; i < used.length; i++) {
    const gap = used[i].t - used[i - 1].t;
    sum += gap;
    if (gap > worst) worst = gap;
  }
  let overshoots = 0;
  let peak = 0;
  let beyond = false;
  for (const s of used) {
    const over = s.x - target;
    if (over > tolerance) {
      if (!beyond) overshoots++;
      beyond = true;
      if (over > peak) peak = over;
    } else if (over < -tolerance) {
      beyond = false;
    }
  }
  return {
    frames: used.length,
    avgFrameMs: used.length > 1 ? sum / (used.length - 1) : 0,
    worstFrameMs: worst,
    overshoots,
    peakOvershootPx: peak,
    settleMs: used[used.length - 1].t,
  };
};

type Result = { kind: "measured"; m: MotionMeasurement } | { kind: "snapped" } | { kind: "failed" };

export interface MotionCompareProps {
  /** Duration of the CSS and linear versions, ms. */
  durationMs?: number;
  /** Spring stiffness. */
  stiffness?: number;
  /** Spring damping. */
  damping?: number;
  /** Force reduced motion on or off. Leave undefined to follow the system setting. */
  reducedMotion?: boolean;
  /** Called after each run is measured (or snapped under reduced motion). */
  onResult?: (approach: MotionApproach, m: MotionMeasurement | null) => void;
  className?: string;
}

const DOT = 20;
/** Where the target sits along the track, as a fraction of its width. */
const TARGET_AT = 0.82;
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/**
 * Three ways to move the same dot the same distance, each measured in your
 * browser. Every run reads the dot's rendered position in each animation
 * frame, then reports frames rendered, average and worst gap between frames,
 * how many times it passed the target, and when it settled. Until a run has
 * finished, its cells say "not measured yet": nothing here is pre-filled.
 *
 * Frame gaps come from requestAnimationFrame timestamps, so they reflect your
 * display and whatever else the page was doing, not the cost of the approach
 * in isolation.
 *
 * With reduced motion all three snap to the end with no animation, and the
 * table says that instead of showing numbers.
 *
 * @example
 * <MotionCompare durationMs={700} onResult={(a, m) => console.log(a, m)} />
 */
export const MotionCompare = ({
  durationMs = 700,
  stiffness = 170,
  damping = 14,
  reducedMotion,
  onResult,
  className = "",
}: MotionCompareProps) => {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;

  const [results, setResults] = useState<Partial<Record<MotionApproach, Result>>>({});
  const [running, setRunning] = useState<MotionApproach | null>(null);
  const [announce, setAnnounce] = useState("");

  const tracks = useRef<Partial<Record<MotionApproach, HTMLDivElement | null>>>({});
  const dots = useRef<Partial<Record<MotionApproach, HTMLDivElement | null>>>({});
  const busy = useRef(false);
  const mounted = useRef(true);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runOne = useCallback(
    async (kind: MotionApproach): Promise<Result> => {
      const track = tracks.current[kind];
      const dot = dots.current[kind];
      if (!track || !dot) return { kind: "failed" };
      // Leave room past the target so an overshoot stays inside the card.
      const distance = track.clientWidth * TARGET_AT - DOT;
      const place = (x: number) => {
        dot.style.transform = `translateX(${x}px)`;
      };

      // Return to the start with no transition in the way.
      dot.style.transition = "none";
      place(0);
      void dot.getBoundingClientRect();

      if (reduced) {
        place(distance);
        return { kind: "snapped" };
      }

      const originLeft = () => dot.getBoundingClientRect().left - track.getBoundingClientRect().left;
      const samples: TraceSample[] = [];
      const first = await nextFrame();
      if (!mounted.current) return { kind: "failed" };

      if (kind === "css") {
        dot.style.transition = `transform ${durationMs}ms ease`;
        place(distance);
      }
      let p = 0;
      let v = 0;
      let prev = first;
      const maxMs = 4000;
      let ts = first;
      // Each iteration is one animation frame.
      for (;;) {
        // The first sample is the frame on which the move starts.
        if (kind === "linear") place(distance * Math.min(1, (ts - first) / durationMs));
        if (kind === "spring") {
          const dt = Math.min(0.05, (ts - prev) / 1000);
          const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
          const h = dt / steps;
          for (let i = 0; i < steps; i++) {
            v += (stiffness * (1 - p) - damping * v) * h;
            p += v * h;
          }
          place(distance * p);
        }
        samples.push({ t: ts - first, x: originLeft() });
        prev = ts;
        const tail = samples.slice(-6);
        const stable = tail.length === 6 && tail.every((s) => Math.abs(s.x - distance) <= 0.5);
        if (stable || ts - first > maxMs || !mounted.current) break;
        ts = await nextFrame();
      }
      const m = analyseTrace(samples, distance);
      return m ? { kind: "measured", m } : { kind: "failed" };
    },
    [reduced, durationMs, stiffness, damping]
  );

  const run = useCallback(
    async (kinds: MotionApproach[]) => {
      if (busy.current) return;
      busy.current = true;
      for (const kind of kinds) {
        if (!mounted.current) break;
        setRunning(kind);
        // Forget the old number the moment a new run starts.
        setResults((r) => ({ ...r, [kind]: undefined }));
        const res = await runOne(kind);
        if (!mounted.current) break;
        setResults((r) => ({ ...r, [kind]: res }));
        onResultRef.current?.(kind, res.kind === "measured" ? res.m : null);
        const title = MOTION_APPROACHES.find((a) => a.id === kind)!.title;
        setAnnounce(
          res.kind === "measured"
            ? `${title} measured: ${res.m.frames} frames, ${res.m.overshoots} overshoots.`
            : res.kind === "snapped"
              ? `${title} snapped with no animation.`
              : `${title} could not be measured.`
        );
        if (kinds.length > 1) await new Promise((r) => setTimeout(r, 250));
      }
      busy.current = false;
      if (mounted.current) setRunning(null);
    },
    [runOne]
  );

  const ms = (n: number) => `${n.toFixed(1)} ms`;
  const isRunning = running !== null;

  return (
    <div className={`flex w-full flex-col gap-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(["css", "linear", "spring"])}
          aria-disabled={isRunning}
          className="rounded-xl px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.28)",
            cursor: isRunning ? "progress" : "pointer",
          }}
        >
          {isRunning ? "Running" : "Run all three, one after another"}
        </button>
        {reduced && (
          <p data-testid="reduced-note" className="text-sm" style={{ color: "rgb(255,196,110)" }}>
            Reduced motion is on: all three snap to the end with no animation, so there is nothing to measure.
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-5">
        {MOTION_APPROACHES.map((a) => {
          const res = results[a.id];
          const m = res?.kind === "measured" ? res.m : null;
          const cell = (value: string | null) => {
            if (m && value !== null) return value;
            if (res?.kind === "snapped") return "snapped";
            if (res?.kind === "failed") return "failed";
            return "not measured yet";
          };
          return (
            <li key={a.id} data-approach={a.id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white/90">{a.title}</h3>
                  <p className="text-xs text-white/40">{a.how}</p>
                </div>
                <button
                  type="button"
                  onClick={() => run([a.id])}
                  aria-disabled={isRunning}
                  aria-label={`Run ${a.title} only`}
                  className="rounded-lg px-3 py-1 text-xs text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{ border: "1px solid rgba(255,255,255,0.2)", cursor: isRunning ? "progress" : "pointer" }}
                >
                  Run
                </button>
              </div>
              <div
                ref={(el) => {
                  tracks.current[a.id] = el;
                }}
                className="relative h-5"
                style={{ borderBottom: "1px dashed rgba(255,255,255,0.18)" }}
              >
                <div
                  aria-hidden
                  className="absolute top-0 h-5 w-px"
                  style={{ left: `calc(${TARGET_AT * 100}% - ${DOT / 2}px)`, background: "rgba(255,255,255,0.3)" }}
                />
                <div
                  ref={(el) => {
                    dots.current[a.id] = el;
                  }}
                  aria-hidden
                  className="absolute left-0 top-0 rounded-full"
                  style={{ width: DOT, height: DOT, background: "rgb(140,160,255)", boxShadow: "0 0 14px rgba(140,160,255,0.5)" }}
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                {(
                  [
                    ["Frames", m ? String(m.frames) : null],
                    ["Avg frame", m ? ms(m.avgFrameMs) : null],
                    ["Worst frame", m ? ms(m.worstFrameMs) : null],
                    ["Overshoots", m ? `${m.overshoots}${m.peakOvershootPx > 0 ? ` (peak ${m.peakOvershootPx.toFixed(1)} px)` : ""}` : null],
                    ["Settled at", m ? `${Math.round(m.settleMs)} ms` : null],
                  ] as [string, string | null][]
                ).map(([k, v]) => (
                  <div key={k} data-stat={k}>
                    <dt className="text-white/30">{k}</dt>
                    <dd className="font-mono text-white/80">{cell(v)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
};
