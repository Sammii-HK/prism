"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { QUIET_MS, SLOW_MS } from "./latency";

/**
 * The states of an AI response, and one source interface for where it comes from.
 *
 * The interface does not know whether a response is live or a replay: both
 * are a `StreamSource`, an async stream of events. The demo replays real
 * recordings with their real timing, so a visitor costs nothing, and a live
 * model would plug into the same hook unchanged.
 *
 * The timing rules are the latency states': nothing new is drawn for a
 * response that starts inside QUIET_MS, and once nothing has arrived for
 * SLOW_MS the response says it is still working and offers a way out.
 */

export type Source = { n: number; title: string; href: string };

export type StreamEvent =
  | { t: number; type: "text"; text: string }
  | { t: number; type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { t: number; type: "tool_result"; id: string; ok: boolean; summary: string; sources?: Source[] }
  | { t: number; type: "error"; message: string }
  | { t: number; type: "done" };

export type Recording = {
  id: string;
  title: string;
  prompt: string;
  /** How it was recorded, and anything injected. Shown beside the replay. */
  note: string;
  model: string;
  recordedAt: string;
  sources: Source[];
  events: StreamEvent[];
};

/** Anything that yields response events. Must stop when the signal aborts. */
export type StreamSource = (signal: AbortSignal) => AsyncIterable<StreamEvent>;

/**
 * Play a recording back at its recorded pace (scaled by `speed`), honouring
 * the abort signal between events. `cutAt` ends the stream early with an
 * error, to show a connection dropping mid-answer.
 */
export const replay =
  (recording: Recording, { speed = 1, cutAt }: { speed?: number; cutAt?: number } = {}): StreamSource =>
  (signal) => ({
    async *[Symbol.asyncIterator]() {
      const start = performance.now();
      for (const event of recording.events) {
        if (cutAt !== undefined && event.t >= cutAt) {
          await wait(start + cutAt / speed - performance.now(), signal);
          yield { t: cutAt, type: "error", message: "The connection dropped." } satisfies StreamEvent;
          return;
        }
        await wait(start + event.t / speed - performance.now(), signal);
        if (signal.aborted) return;
        yield event;
      }
    },
  });

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });

export type AssistantPhase =
  /** Nothing asked yet. */
  | "idle"
  /** Asked, inside the quiet window: nothing new is drawn. */
  | "waiting"
  /** Past the quiet window with nothing back yet. */
  | "thinking"
  /** A tool is running. */
  | "tool"
  /** Text is arriving. */
  | "streaming"
  | "done"
  /** Stopped by the user. What arrived is kept. */
  | "stopped"
  | "error";

export type ToolStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "failed";
  summary?: string;
};

type State = {
  phase: AssistantPhase;
  text: string;
  steps: ToolStep[];
  sources: Source[];
  error: string;
};

type Action = { type: "start" } | { type: "quiet-over" } | { type: "event"; event: StreamEvent } | { type: "stop" } | { type: "reset" };

const INITIAL: State = { phase: "idle", text: "", steps: [], sources: [], error: "" };

const busy = (phase: AssistantPhase) => phase === "waiting" || phase === "thinking" || phase === "tool" || phase === "streaming";

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "start":
      return { ...INITIAL, phase: "waiting" };
    case "quiet-over":
      return state.phase === "waiting" ? { ...state, phase: "thinking" } : state;
    case "stop":
      return busy(state.phase) ? { ...state, phase: "stopped", steps: state.steps.map((s) => (s.status === "running" ? { ...s, status: "failed", summary: "Stopped" } : s)) } : state;
    case "reset":
      return INITIAL;
    case "event": {
      if (!busy(state.phase)) return state; // a late event cannot move a settled response
      const e = action.event;
      switch (e.type) {
        case "text":
          return { ...state, phase: "streaming", text: state.text + e.text };
        case "tool_call":
          return { ...state, phase: "tool", steps: [...state.steps, { id: e.id, name: e.name, args: e.args, status: "running" }] };
        case "tool_result": {
          const sources = [...state.sources];
          for (const s of e.sources ?? []) if (!sources.some((x) => x.n === s.n)) sources.push(s);
          return {
            ...state,
            phase: "thinking",
            sources,
            steps: state.steps.map((s) => (s.id === e.id ? { ...s, status: e.ok ? "done" : "failed", summary: e.summary } : s)),
          };
        }
        case "error":
          return { ...state, phase: "error", error: e.message };
        case "done":
          return { ...state, phase: "done" };
      }
    }
  }
};

export interface AssistantOptions {
  quietMs?: number;
  slowMs?: number;
}

/**
 * Run a response through its states.
 *
 * @example
 * const a = useAssistant();
 * a.start(replay(recording, { speed: 3 }));
 */
export const useAssistant = ({ quietMs = QUIET_MS, slowMs = SLOW_MS }: AssistantOptions = {}) => {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [stalledS, setStalledS] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);
  const lastEventAt = useRef(0);
  const phaseRef = useRef(state.phase);
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const stop = useCallback(() => {
    run.current++;
    controller.current?.abort();
    dispatch({ type: "stop" });
  }, []);

  const reset = useCallback(() => {
    run.current++;
    controller.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  const start = useCallback(
    (source: StreamSource) => {
      controller.current?.abort();
      const id = ++run.current;
      const ctl = new AbortController();
      controller.current = ctl;
      dispatch({ type: "start" });
      lastEventAt.current = performance.now();
      const quiet = window.setTimeout(() => id === run.current && dispatch({ type: "quiet-over" }), quietMs);
      (async () => {
        try {
          for await (const event of source(ctl.signal)) {
            if (id !== run.current) return;
            lastEventAt.current = performance.now();
            dispatch({ type: "event", event });
          }
        } catch (err) {
          if (id === run.current) dispatch({ type: "event", event: { t: 0, type: "error", message: err instanceof Error ? err.message : "Something went wrong." } });
        } finally {
          window.clearTimeout(quiet);
        }
      })();
    },
    [quietMs]
  );

  // How long since anything arrived, once that passes slowMs. Ticks only while busy.
  useEffect(() => {
    if (!busy(state.phase)) return;
    const timer = window.setInterval(() => {
      const quietFor = performance.now() - lastEventAt.current;
      setStalledS(quietFor >= slowMs ? Math.floor(quietFor / 1000) : 0);
    }, 250);
    return () => {
      window.clearInterval(timer);
      setStalledS(0);
    };
  }, [state.phase, slowMs]);

  useEffect(() => () => controller.current?.abort(), []);

  return { ...state, busy: busy(state.phase), stalledS, start, stop, reset };
};
