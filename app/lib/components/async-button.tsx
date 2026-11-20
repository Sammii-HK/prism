"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { sliceTransitions, useLatency, type LatencyPhase } from "../hooks/latency";

/**
 * The states an async button can be in. They are the shared latency states
 * (hooks/latency.ts), minus the two a button has no use for: it never draws
 * a skeleton and it cannot be cancelled.
 */
export type AsyncButtonState = Extract<LatencyPhase, "idle" | "pending" | "slow" | "success" | "error">;

export type AsyncButtonEvent = "START" | "SLOW" | "RESOLVE" | "REJECT" | "RESET";

const BUTTON_STATES = ["idle", "pending", "slow", "success", "error"] as const satisfies readonly AsyncButtonState[];
const BUTTON_EVENTS = ["START", "SLOW", "RESOLVE", "REJECT", "RESET"] as const satisfies readonly AsyncButtonEvent[];

/**
 * Every legal transition, read straight from the shared latency machine.
 * Anything not listed is ignored, so a second press while pending cannot
 * start a second request and a late result cannot move a button that has
 * already reset.
 */
export const ASYNC_BUTTON_TRANSITIONS = sliceTransitions(BUTTON_STATES, BUTTON_EVENTS);

export const asyncButtonReducer = (state: AsyncButtonState, event: AsyncButtonEvent): AsyncButtonState =>
  ASYNC_BUTTON_TRANSITIONS[state][event] ?? state;

export interface AsyncButtonLabels {
  idle: string;
  pending: string;
  slow: string;
  success: string;
  error: string;
}

const DEFAULT_LABELS: AsyncButtonLabels = {
  idle: "Save changes",
  pending: "Saving",
  slow: "Still working, this is taking longer than usual",
  success: "Saved",
  error: "Failed. Press to try again",
};

export interface AsyncButtonProps {
  /** The work. Resolve for success, reject (or throw) for failure. */
  onPress: () => Promise<unknown>;
  /** Text for each state. Missing keys fall back to the defaults. */
  labels?: Partial<AsyncButtonLabels>;
  /** How long a request runs before the button says it is slow. */
  slowAfterMs?: number;
  /** How long "success" stays before the button returns to idle. */
  successHoldMs?: number;
  /** Force reduced motion on or off. Leave undefined to follow the system setting. */
  reducedMotion?: boolean;
  /** Called on every state change, with the event that caused it. */
  onStateChange?: (next: AsyncButtonState, event: AsyncButtonEvent) => void;
  className?: string;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReduced = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/** The system setting, kept live. The server snapshot is false, so first paint matches on both sides. */
export const useSystemReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );

const TINT: Record<AsyncButtonState, string> = {
  idle: "255,255,255",
  pending: "140,160,255",
  slow: "255,196,110",
  success: "130,220,170",
  error: "255,130,130",
};

/**
 * A button that tells the truth about waiting. It stays focusable while it
 * works, ignores presses it cannot honour, says out loud when a request is
 * slow, and offers a retry on failure. The visible state, the screen-reader
 * announcement and the colour all come from one small state machine.
 *
 * With reduced motion the moving progress bar becomes a still, partly filled
 * bar and the colour change is instant; the words carry the same information.
 *
 * @example
 * <AsyncButton onPress={() => fetch("/api/save", { method: "POST" })} />
 */
export const AsyncButton = ({
  onPress,
  labels,
  slowAfterMs = 1200,
  successHoldMs = 1600,
  reducedMotion,
  onStateChange,
  className = "",
}: AsyncButtonProps) => {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const text = { ...DEFAULT_LABELS, ...labels };

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const run = useCallback(() => Promise.resolve().then(onPress), [onPress]);
  const { phase, start } = useLatency({
    run,
    slowAfterMs,
    successHoldMs,
    onEvent: ({ event, to }) => onStateChangeRef.current?.(to as AsyncButtonState, event as AsyncButtonEvent),
  });
  const state = phase as AsyncButtonState;
  const press = start;

  const busy = state === "pending" || state === "slow";
  const tint = TINT[state];
  const label = text[state];

  return (
    <div className={`inline-flex flex-col items-stretch gap-2 ${className}`}>
      <style>{`
        @keyframes prism-async-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
      `}</style>
      <button
        type="button"
        onClick={press}
        aria-busy={busy}
        aria-disabled={busy}
        data-state={state}
        className="relative overflow-hidden rounded-xl px-6 py-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{
          background: `rgba(${tint},${state === "idle" ? 0.08 : 0.16})`,
          border: `1px solid rgba(${tint},${state === "idle" ? 0.2 : 0.5})`,
          cursor: busy ? "progress" : "pointer",
          transition: reduced ? "none" : "background 240ms, border-color 240ms",
        }}
      >
        <span className="relative z-10 block text-center">{label}</span>
        {busy && (
          <span
            aria-hidden
            className="absolute bottom-0 left-0 h-[3px]"
            style={
              reduced
                ? { width: state === "slow" ? "75%" : "40%", background: `rgb(${tint})` }
                : {
                    width: "40%",
                    background: `rgb(${tint})`,
                    animation: `prism-async-slide ${state === "slow" ? 2400 : 1100}ms linear infinite`,
                  }
            }
          />
        )}
      </button>
      {/* One polite announcement per state change; the visible label can be longer. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "idle" ? "" : text[state]}
      </span>
    </div>
  );
};
