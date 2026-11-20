"use client";
import { type ReactNode } from "react";
import { useSystemReducedMotion } from "./async-button";
import { useLatency, type LatencyLogEntry } from "../hooks/latency";

export {
  LATENCY_TRANSITIONS,
  latencyReducer,
  type LatencyEvent,
  type LatencyLogEntry,
  type LatencyPhase,
} from "../hooks/latency";

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
 * It runs on `useLatency` (hooks/latency.ts), the same states the async
 * button uses; the logic underneath is `latencyReducer`, a pure function.
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

  const { phase, busy, data, error: errorText, elapsedS, start, cancel } = useLatency({
    run: load,
    skeletonAfterMs,
    slowAfterMs,
    onEvent,
  });

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
        {phase === "idle" && <p className="text-sm text-white/50">Nothing loaded yet.</p>}

        {phase === "pending" &&
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
              onClick={() => phase === "slow" && cancel()}
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
