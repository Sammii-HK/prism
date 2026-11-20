"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

/**
 * Latency states: one honest lifecycle for anything that waits on a request.
 *
 * It is a state, not a component. The async button and the loading region
 * both run on it, and anything else that waits (a select that fetches its
 * options, a search box, a save bar) can take the same hook and get the same
 * timing rules for free:
 *
 * - pending: a request is out but under the skeleton threshold, so nothing
 *   new is drawn. A fast response never flashes a placeholder.
 * - skeleton: it has passed that threshold (only if you ask for one).
 * - slow: it has taken long enough that the interface should say so.
 * - success / error / cancelled: settled. START runs it again, RESET clears it.
 */
/** Under this, show nothing new: a fast response never flashes a placeholder. Shared by every waiting surface. */
export const QUIET_MS = 400;
/** Past this with no progress, say it is slow and offer a way out. */
export const SLOW_MS = 2000;

export type LatencyPhase = "idle" | "pending" | "skeleton" | "slow" | "success" | "error" | "cancelled";

export type LatencyEvent = "START" | "SHOW_SKELETON" | "SLOW" | "RESOLVE" | "REJECT" | "CANCEL" | "RESET";

/** Every legal transition. Anything not listed is ignored, so a late result cannot move a settled state. */
export const LATENCY_TRANSITIONS: Record<LatencyPhase, Partial<Record<LatencyEvent, LatencyPhase>>> = {
  idle: { START: "pending" },
  pending: { SHOW_SKELETON: "skeleton", SLOW: "slow", RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  skeleton: { SLOW: "slow", RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  slow: { RESOLVE: "success", REJECT: "error", CANCEL: "cancelled" },
  success: { START: "pending", RESET: "idle" },
  error: { START: "pending", RESET: "idle" },
  cancelled: { START: "pending", RESET: "idle" },
};

export const latencyReducer = (state: LatencyPhase, event: LatencyEvent): LatencyPhase =>
  LATENCY_TRANSITIONS[state][event] ?? state;

/**
 * The part of the machine one component uses: only these phases, reached
 * only by these events. A component that never shows a skeleton or never
 * cancels draws its own machine from this, and it is still the shared one.
 */
export const sliceTransitions = <P extends LatencyPhase, E extends LatencyEvent>(phases: readonly P[], events: readonly E[]) =>
  Object.fromEntries(
    phases.map((from) => [
      from,
      Object.fromEntries(
        Object.entries(LATENCY_TRANSITIONS[from]).filter(
          ([event, to]) => events.includes(event as E) && phases.includes(to as P)
        )
      ),
    ])
  ) as Record<P, Partial<Record<E, P>>>;

export const isBusy = (phase: LatencyPhase) => phase === "pending" || phase === "skeleton" || phase === "slow";

export interface LatencyLogEntry {
  /** Milliseconds since the request started (0 for START). */
  atMs: number;
  event: LatencyEvent;
  from: LatencyPhase;
  to: LatencyPhase;
}

export interface LatencyOptions<T> {
  /** The request. Honour `signal` if you can; late results are ignored either way. */
  run: (signal: AbortSignal) => Promise<T>;
  /** Show a skeleton after this long. Leave undefined to never show one. */
  skeletonAfterMs?: number;
  /** Say it is slow after this long. */
  slowAfterMs?: number;
  /** Return to idle this long after success. Leave undefined to stay on success. */
  successHoldMs?: number;
  /** Every real state change, with time since the request started. */
  onEvent?: (entry: LatencyLogEntry) => void;
}

/**
 * Run a request through the latency states.
 *
 * @example
 * const { phase, start } = useLatency({ run: (signal) => fetch("/api", { signal }), slowAfterMs: 1500 });
 */
export const useLatency = <T>({ run, skeletonAfterMs, slowAfterMs = SLOW_MS, successHoldMs, onEvent }: LatencyOptions<T>) => {
  const [phase, dispatch] = useReducer(latencyReducer, "idle");
  const phaseRef = useRef<LatencyPhase>("idle");
  const [data, setData] = useState<{ value: T } | null>(null);
  const [error, setError] = useState("");
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

  /** Dispatch only legal events, and report real changes. */
  const send = useCallback((event: LatencyEvent) => {
    const from = phaseRef.current;
    const to = latencyReducer(from, event);
    if (to === from) return false;
    phaseRef.current = to;
    dispatch(event);
    const atMs = event === "START" ? 0 : Math.round(performance.now() - startedAt.current);
    onEventRef.current?.({ atMs, event, from, to });
    return true;
  }, []);

  const start = useCallback(() => {
    if (isBusy(phaseRef.current)) return;
    stopTimers();
    startedAt.current = performance.now();
    if (!send("START")) return;
    const id = ++requestId.current;
    const ctl = new AbortController();
    controller.current = ctl;
    const live = () => mounted.current && id === requestId.current;

    if (skeletonAfterMs !== undefined) {
      timers.current.push(window.setTimeout(() => live() && send("SHOW_SKELETON"), skeletonAfterMs));
    }
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
      .then(() => run(ctl.signal))
      .then(
        (value) => {
          if (!live()) return;
          stopTimers();
          setData({ value });
          send("RESOLVE");
          if (successHoldMs !== undefined) {
            timers.current.push(window.setTimeout(() => live() && send("RESET"), successHoldMs));
          }
        },
        (err: unknown) => {
          if (!live()) return;
          stopTimers();
          setError(err instanceof Error ? err.message : "Request failed");
          send("REJECT");
        }
      );
  }, [run, send, skeletonAfterMs, slowAfterMs, successHoldMs]);

  const cancel = useCallback(() => {
    if (!isBusy(phaseRef.current)) return;
    requestId.current++; // a late result can no longer move the state
    stopTimers();
    controller.current?.abort();
    send("CANCEL");
  }, [send]);

  const reset = useCallback(() => {
    requestId.current++;
    stopTimers();
    send("RESET");
  }, [send]);

  return { phase, busy: isBusy(phase), data, error, elapsedS, start, cancel, reset };
};
