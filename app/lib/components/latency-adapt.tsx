"use client";
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { useSystemReducedMotion } from "./async-button";

/**
 * What the region is showing.
 * - waiting: a request is out but under the skeleton threshold. Nothing new is drawn.
 * - skeleton: it has taken longer than the threshold, so a placeholder appears.
 * - slow: it has taken long enough that the region says so and offers a cancel.
 */
export type LatencyPhase = "idle" | "waiting" | "skeleton" | "slow" | "success" | "error" | "cancelled";

export type LatencyEvent = "START" | "SHOW_SKELETON" | "SLOW" | "RESOLVE" | "REJECT" | "CANCEL";

/**
 * Every legal transition. Anything not listed is ignored. Note that
 * waiting -> RESOLVE goes straight to success: a fast response never shows a
 * skeleton, so there is no flash of placeholder.
 */
export const LATENCY_TRANSITIONS: Record<LatencyPhase, Partial<Record<LatencyEvent, LatencyPhase>>> = {
  idle: { START: "waiting" },
  waiting: { SHOW_SKELETON: "skeleton", SLOW: "slow", RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  skeleton: { SLOW: "slow", RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  slow: { RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  success: { START: "waiting" },
  error: { START: "waiting" },
  cancelled: { START: "waiting" },
};

export const latencyReducer = (state: LatencyPhase, event: LatencyEvent): LatencyPhase =>
  LATENCY_TRANSITIONS[state][event] ?? state;

export interface LatencyLogEntry {
  /** Milliseconds since the request started (0 for START). */
  atMs: number;
  event: LatencyEvent;
  from: LatencyPhase;
  to: LatencyPhase;
}

export interface LatencyAdaptProps<T> {
  /** The request. Honour `signal` if you can; the component ignores late results either way. */
  load: (signal: AbortSignal) => Promise<T>;
  /** Draw the loaded data. */
  render: (data: T) => ReactNode;
  /** Placeholder shown once the wait passes `skeletonAfterMs`. A default is provided. */
  skeleton?: ReactNode;
  /** Wait this long before showing any placeholder. Avoids a flash on fast responses. */
  skeletonAfterMs?: number;
  /** After this long, say it is slow, show elapsed seconds and offer cancel. */
  slowAfterMs?: number;
  /** Text of the button that starts a request. */
  startLabel?: string;
  /** Force reduced motion on or off. Leave undefined to follow the system setting. */
  reducedMotion?: boolean;
  /** Every real state change, with time since the request started. */
  onEvent?: (entry: LatencyLogEntry) => void;
  className?: string;
}

const DefaultSkeleton = ({ animate }: { animate: boolean }) => (
  <div aria-hidden className="flex flex-col gap-3">
    {[88, 100, 64].map((w, i) => (
      <div
        key={i}
        className="h-4 rounded-md"
        style={{
          width: `${w}%`,
          background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
          backgroundSize: "200% 100%",
          animation: animate ? "prism-latency-shimmer 1400ms linear infinite" : "none",
        }}
      />
    ))}
  </div>
);

/**
 * A region that tells the truth about how long it has been waiting, and
 * changes what it shows to match:
 *
 *  - under `skeletonAfterMs` (150 ms): nothing changes, then content appears
 *    with no skeleton flash;
 *  - after that: a skeleton;
 *  - after `slowAfterMs` (2 s): a message with elapsed seconds and a Cancel;
 *  - on failure: an inline message with Retry.
 *
 * The logic is `latencyReducer`, a pure function you can test on its own.
 * With reduced motion the skeleton is still, with no shimmer and no fade.
 *
 * @example
 * <LatencyAdapt load={(signal) => fetch("/api/feed", { signal }).then((r) => r.json())} render={(d) => <Feed data={d} />} />
 */
export const LatencyAdapt = <T,>({
  load,
  render,
  skeleton,
  skeletonAfterMs = 150,
  slowAfterMs = 2000,
  startLabel = "Load",
  reducedMotion,
  onEvent,
  className = "",
}: LatencyAdaptProps<T>) => {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;

  const [phase, dispatchRaw] = useReducer(latencyReducer, "idle");
  const phaseRef = useRef<LatencyPhase>("idle");
  const [data, setData] = useState<{ value: T } | null>(null);
  const [errorText, setErrorText] = useState("");
  const [elapsedS, setElapsedS] = useState(0);

  const requestId = useRef(0);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const ticker = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const stopTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (ticker.current !== null) window.clearInterval(ticker.current);
    ticker.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopTimers();
      controller.current?.abort();
    };
  }, []);

  const send = useCallback((event: LatencyEvent) => {
    const from = phaseRef.current;
    const to = latencyReducer(from, event);
    if (to === from) return false;
    phaseRef.current = to;
    dispatchRaw(event);
    const atMs = event === "START" ? 0 : Math.round(performance.now() - startedAt.current);
    onEventRef.current?.({ atMs, event, from, to });
    return true;
  }, []);

  const start = useCallback(() => {
    const p = phaseRef.current;
    if (p === "waiting" || p === "skeleton" || p === "slow") return;
    stopTimers();
    startedAt.current = performance.now();
    if (!send("START")) return;
    const id = ++requestId.current;
    const ctl = new AbortController();
    controller.current = ctl;
    const live = () => mounted.current && id === requestId.current;
    timers.current.push(window.setTimeout(() => live() && send("SHOW_SKELETON"), skeletonAfterMs));
    timers.current.push(
      window.setTimeout(() => {
        if (!live()) return;
        send("SLOW");
        const tick = () => setElapsedS(Math.floor((performance.now() - startedAt.current) / 1000));
        tick();
        ticker.current = window.setInterval(tick, 250);
      }, slowAfterMs)
    );
    Promise.resolve()
      .then(() => load(ctl.signal))
      .then(
        (value) => {
          if (!live()) return;
          stopTimers();
          setData({ value });
          send("RESOLVE");
        },
        (err: unknown) => {
          if (!live()) return;
          stopTimers();
          setErrorText(err instanceof Error ? err.message : "Request failed");
          send("REJECT");
        }
      );
  }, [load, send, skeletonAfterMs, slowAfterMs]);

  const cancel = useCallback(() => {
    if (phaseRef.current !== "slow") return;
    requestId.current++; // a late result can no longer move the region
    stopTimers();
    controller.current?.abort();
    send("CANCEL");
  }, [send]);

  const busy = phase === "waiting" || phase === "skeleton" || phase === "slow";

  const status =
    phase === "skeleton"
      ? "Loading."
      : phase === "slow"
        ? "Still loading. This is taking longer than usual."
        : phase === "cancelled"
          ? "Cancelled."
          : phase === "success"
            ? "Loaded."
            : "";

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <style>{`
        @keyframes prism-latency-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes prism-latency-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <button
        type="button"
        onClick={start}
        aria-disabled={busy}
        data-phase={phase}
        className="self-start rounded-xl px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.24)",
          cursor: busy ? "progress" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {phase === "idle" ? startLabel : "Reload"}
      </button>

      <div
        aria-busy={busy}
        data-region-phase={phase}
        className="min-h-[132px] rounded-xl p-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {phase === "idle" && <p className="text-sm text-white/30">Nothing loaded yet.</p>}

        {phase === "waiting" &&
          (data ? (
            <div style={{ opacity: 0.55 }}>{render(data.value)}</div>
          ) : (
            <div aria-hidden className="h-[92px]" />
          ))}

        {phase === "skeleton" && (skeleton ?? <DefaultSkeleton animate={!reduced} />)}

        {phase === "slow" && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-white/80" data-testid="slow-message">
              Still waiting after {elapsedS} {elapsedS === 1 ? "second" : "seconds"}. This is taking longer than usual.
            </p>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ border: "1px solid rgba(255,196,110,0.6)", background: "rgba(255,196,110,0.12)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {phase === "success" && data && (
          <div style={{ animation: reduced ? "none" : "prism-latency-fade 160ms ease-out" }}>{render(data.value)}</div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-sm" style={{ color: "rgb(255,150,150)" }}>
              Could not load: {errorText}
            </p>
            <button
              type="button"
              onClick={start}
              className="rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ border: "1px solid rgba(255,130,130,0.6)", background: "rgba(255,130,130,0.12)" }}
            >
              Retry
            </button>
          </div>
        )}

        {phase === "cancelled" && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-white/60">Cancelled. Nothing was changed.</p>
            <button
              type="button"
              onClick={start}
              className="rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ border: "1px solid rgba(255,255,255,0.3)" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
};
